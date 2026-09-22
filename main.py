"""
Amazonせどり 差益計算スクリプト（複数商品一括処理版）

products.csv (asin, rakuten_url, target_margin, category の4列) を読み込み、
各行についてAmazon販売価格と楽天仕入れ価格をスクレイピングで取得し、
カテゴリ別のAmazon手数料+FBA固定手数料を差し引いた純利益を計算して1行ずつ出力する。
あわせて結果をSupabase(price_historyテーブル)に保存し、
純利益がtarget_marginを超えた商品はResend経由でメール通知する。

products.csv の例:
    asin,rakuten_url,target_margin,category
    B0CX4MPDQ5,https://item.rakuten.co.jp/xxx/,2000,game
    B0XXXXXXX,https://item.rakuten.co.jp/yyy/,3000,apparel

カテゴリ別手数料率: game 8% / apparel 15% / electronics 8% / other(未指定含む) 10%

セットアップ:
    pip install -r requirements.txt
    playwright install chromium
    cp .env.example .env  # SUPABASE_URL / SUPABASE_KEY / RESEND_API_KEY を設定

使い方:
    python main.py
    python main.py --csv other_products.csv
    python main.py --no-headless  # デバッグ用にブラウザ表示
"""

import argparse
import asyncio
import csv
import os
import sys

import resend
from dotenv import load_dotenv
from supabase import create_client

from amazon_scraper import scrape_amazon
from rakuten_scraper import scrape_rakuten_item

load_dotenv()

DEFAULT_CSV_PATH = "products.csv"
ALERT_EMAIL_TO = "taka.work0809@gmail.com"
# Resendでドメイン未認証でも送れるテスト用送信元。RESEND_FROM_EMAILで上書き可能。
DEFAULT_FROM_EMAIL = "onboarding@resend.dev"

# カテゴリ別Amazon販売手数料率（簡易版。未知のカテゴリは"other"を適用）
CATEGORY_FEE_RATES = {
    "game": 0.08,
    "apparel": 0.15,
    "electronics": 0.08,
    "other": 0.10,
}
FBA_FEE = 500  # 固定（簡易版）


async def scrape_rakuten(url: str, headless: bool = True) -> dict:
    """rakuten_scraper.py の scrape_rakuten_item() を流用したラッパー。戻り値はdict。"""
    result = await scrape_rakuten_item(url, headless=headless)
    return result.to_dict()


async def _scrape_both(asin: str, rakuten_url: str, headless: bool) -> tuple[dict, dict]:
    # Amazon/楽天のブラウザを同時に立ち上げるとリソース競合で片方の取得が不安定になることがあるため、
    # 並列(gather)ではなく逐次実行にしてブラウザ間の干渉を避ける。
    amazon_result = await scrape_amazon(asin, headless=headless)
    rakuten_result = await scrape_rakuten(rakuten_url, headless=headless)
    return amazon_result, rakuten_result


def calculate_profit(amazon_price: int, rakuten_price: int, target_margin: int, category: str) -> dict:
    gross_profit = amazon_price - rakuten_price
    profit_rate = (gross_profit / amazon_price * 100) if amazon_price else 0.0

    fee_rate = CATEGORY_FEE_RATES.get(category, CATEGORY_FEE_RATES["other"])
    fee = amazon_price * fee_rate + FBA_FEE
    net_margin = gross_profit - fee
    recommended = net_margin >= target_margin

    return {
        "profit": gross_profit,
        "profit_rate": profit_rate,
        "fee": fee,
        "net_margin": net_margin,
        "recommended": recommended,
    }


def get_supabase_client():
    """SUPABASE_URL/KEYが未設定ならNoneを返し、呼び出し側で保存をスキップする。"""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("[WARN] SUPABASE_URL/SUPABASE_KEY が未設定のためSupabase保存をスキップします。", file=sys.stderr)
        return None
    return create_client(url, key)


def save_price_history(client, asin: str, amazon_price: int, rakuten_price: int, margin: int, margin_rate: float) -> None:
    if client is None:
        return
    try:
        client.table("price_history").insert(
            {
                "asin": asin,
                "amazon_price": amazon_price,
                "rakuten_price": rakuten_price,
                "margin": margin,
                "margin_rate": round(margin_rate, 1),
            }
        ).execute()
    except Exception as e:
        print(f"[WARN] Supabaseへの保存に失敗しました: {e}", file=sys.stderr)


def send_margin_alert_email(
    product_name: str, amazon_price: int, rakuten_price: int, margin: int, margin_rate: float, rakuten_url: str
) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        print("[WARN] RESEND_API_KEY が未設定のためメール通知をスキップします。", file=sys.stderr)
        return

    resend.api_key = api_key
    from_email = os.environ.get("RESEND_FROM_EMAIL", DEFAULT_FROM_EMAIL)
    subject = f"【差益アラート】¥{margin:,}の仕入れチャンスが見つかりました"
    body = (
        f"商品名：{product_name}\n"
        f"Amazon価格：¥{amazon_price:,}\n"
        f"楽天仕入れ価格：¥{rakuten_price:,}\n"
        f"差益：¥{margin:,}（{margin_rate:.1f}%）\n"
        f"楽天URL：{rakuten_url}\n"
    )
    try:
        resend.Emails.send(
            {
                "from": from_email,
                "to": [ALERT_EMAIL_TO],
                "subject": subject,
                "text": body,
            }
        )
    except Exception as e:
        print(f"[WARN] メール通知の送信に失敗しました: {e}", file=sys.stderr)


def read_products(csv_path: str) -> list[dict]:
    products = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            products.append(
                {
                    "asin": row["asin"].strip(),
                    "rakuten_url": row["rakuten_url"].strip(),
                    "target_margin": int(row["target_margin"]),
                    "category": (row.get("category") or "other").strip() or "other",
                }
            )
    return products


def format_line(index: int, product: dict, amazon: dict, rakuten: dict, calc: dict) -> str:
    prefix = f"商品{index}"

    if not amazon.get("success") or amazon.get("price") is None:
        return f"{prefix}: Amazon取得失敗 ({amazon.get('error') or '不明なエラー'}) [ASIN: {product['asin']}]"

    if not rakuten.get("success") or rakuten.get("price") is None:
        return (
            f"{prefix}: Amazon¥{amazon['price']:,} - 楽天取得失敗 "
            f"({rakuten.get('error') or '不明なエラー'})"
        )

    mark = "✅" if calc["recommended"] else "❌"
    return (
        f"{prefix}: Amazon¥{amazon['price']:,} - 楽天¥{rakuten['price']:,}\n"
        f"　粗利: ¥{calc['profit']:,} / 手数料: ¥{calc['fee']:,.0f} / 純利益: ¥{calc['net_margin']:,.0f} {mark}"
    )


async def _main_async(csv_path: str, headless: bool) -> None:
    products = read_products(csv_path)
    supabase_client = get_supabase_client()

    for i, product in enumerate(products, start=1):
        amazon_result, rakuten_result = await _scrape_both(
            product["asin"], product["rakuten_url"], headless
        )

        calc = None
        if (
            amazon_result.get("success")
            and amazon_result.get("price") is not None
            and rakuten_result.get("success")
            and rakuten_result.get("price") is not None
        ):
            calc = calculate_profit(
                amazon_result["price"], rakuten_result["price"], product["target_margin"], product["category"]
            )

            save_price_history(
                supabase_client,
                product["asin"],
                amazon_result["price"],
                rakuten_result["price"],
                calc["profit"],
                calc["profit_rate"],
            )

            if calc["recommended"]:
                send_margin_alert_email(
                    amazon_result.get("product_name") or product["asin"],
                    amazon_result["price"],
                    rakuten_result["price"],
                    calc["profit"],
                    calc["profit_rate"],
                    product["rakuten_url"],
                )

        print(format_line(i, product, amazon_result, rakuten_result, calc))


def main():
    parser = argparse.ArgumentParser(description="Amazonせどり 差益計算スクリプト（複数商品一括処理版）")
    parser.add_argument("--csv", default=DEFAULT_CSV_PATH, help="商品リストCSVのパス")
    parser.add_argument("--no-headless", action="store_true", help="ブラウザを表示して実行する（デバッグ用）")
    args = parser.parse_args()

    asyncio.run(_main_async(args.csv, headless=not args.no_headless))


if __name__ == "__main__":
    main()
