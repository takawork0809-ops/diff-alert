"""
ダッシュボードの登録商品(monitored_products)の価格を更新するスクリプト

全ユーザーの登録商品について、Amazon販売価格と楽天仕入れ価格を取得し、
手数料込みの純利益を計算して monitored_products を更新する。
純利益が目標(target_margin)に初めて届いた商品は、登録ユーザーのメールアドレスへ通知する。

main.py(products.csv用)の関数を再利用しており、main.py自体は変更しない。
SUPABASE_KEY には service_role キーが必要(全ユーザーの行を更新するため)。

使い方:
    python update_prices.py              # 更新して、チャンス到達時はメール通知
    python update_prices.py --dry-run    # 取得と計算だけ行い、DB更新・通知はしない
    python update_prices.py --no-notify  # 更新はするが、メール通知はしない
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

from typing import Optional

import resend

import main as core  # calculate_profit / get_supabase_client / タイムアウト付きスクレイピング

FROM_EMAIL_DEFAULT = core.DEFAULT_FROM_EMAIL


def fetch_products(client) -> list[dict]:
    return client.table("monitored_products").select("*").order("created_at").execute().data or []


def user_email(client, user_id: str, cache: dict) -> Optional[str]:
    if user_id not in cache:
        try:
            cache[user_id] = client.auth.admin.get_user_by_id(user_id).user.email
        except Exception as e:
            print(f"[WARN] ユーザーのメールアドレスを取得できませんでした: {e}", file=sys.stderr)
            cache[user_id] = None
    return cache[user_id]


def send_alert(to_email: str, name: str, amazon: int, rakuten: int, net: int, url: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        print("[WARN] RESEND_API_KEY が未設定のためメール通知をスキップします。", file=sys.stderr)
        return
    resend.api_key = api_key
    body = (
        f"商品名：{name}\n"
        f"Amazon価格：¥{amazon:,}\n"
        f"楽天仕入れ価格：¥{rakuten:,}\n"
        f"純利益(手数料込み)：¥{net:,}\n"
        f"楽天URL：{url}\n"
    )
    try:
        resend.Emails.send(
            {
                "from": os.environ.get("RESEND_FROM_EMAIL", FROM_EMAIL_DEFAULT),
                "to": [to_email],
                "subject": f"【差益アラート】¥{net:,}の仕入れチャンスが見つかりました",
                "text": body,
            }
        )
    except Exception as e:
        print(f"[WARN] メール通知の送信に失敗しました({to_email}): {e}", file=sys.stderr)


async def run(dry_run: bool, notify: bool, headless: bool) -> None:
    client = core.get_supabase_client()
    if client is None:
        print("Supabaseに接続できません(.envを確認してください)。")
        return

    products = fetch_products(client)
    print(f"対象: {len(products)}商品")

    amazon_cache: dict[str, dict] = {}
    rakuten_cache: dict[str, dict] = {}
    email_cache: dict[str, Optional[str]] = {}
    updated = failed = alerts = 0

    for i, p in enumerate(products, start=1):
        label = f"[{i}/{len(products)}] {p['asin']}"
        # 同じ商品を複数ユーザーが登録していても、1回の実行内では取得を使い回す。
        if p["asin"] not in amazon_cache:
            amazon_cache[p["asin"]] = await core._scrape_amazon_safe(p["asin"], headless)
        if p["rakuten_url"] not in rakuten_cache:
            rakuten_cache[p["rakuten_url"]] = await core._scrape_rakuten_safe(p["rakuten_url"], headless)
        amazon, rakuten = amazon_cache[p["asin"]], rakuten_cache[p["rakuten_url"]]

        if not (amazon.get("success") and amazon.get("price") is not None):
            print(f"{label}: Amazon取得失敗 ({str(amazon.get('error'))[:80]})")
            failed += 1
            continue
        if not (rakuten.get("success") and rakuten.get("price") is not None):
            print(f"{label}: 楽天取得失敗 ({str(rakuten.get('error'))[:80]})")
            failed += 1
            continue

        calc = core.calculate_profit(amazon["price"], rakuten["price"], p["target_margin"], p["category"])
        net = int(round(calc["net_margin"]))
        chance = net >= p["target_margin"]
        prev = p.get("last_net_margin")
        newly_chance = chance and (prev is None or prev < p["target_margin"])
        name = p.get("product_name") or amazon.get("product_name")
        mark = "✅" if chance else "❌"
        print(f"{label}: Amazon¥{amazon['price']:,} 楽天¥{rakuten['price']:,} 純利益¥{net:,} {mark}"
              f"{' (新規チャンス)' if newly_chance else ''}")

        if dry_run:
            continue

        update = {
            "last_amazon_price": amazon["price"],
            "last_rakuten_price": rakuten["price"],
            "last_net_margin": net,
            "last_checked_at": datetime.now(timezone.utc).isoformat(),
        }
        if not p.get("product_name") and name:
            update["product_name"] = name
        try:
            client.table("monitored_products").update(update).eq("id", p["id"]).execute()
            updated += 1
        except Exception as e:
            print(f"[WARN] {label}: 更新に失敗しました: {e}", file=sys.stderr)
            failed += 1
            continue

        if notify and newly_chance:
            to = user_email(client, p["user_id"], email_cache)
            if to:
                send_alert(to, name or p["asin"], amazon["price"], rakuten["price"], net, p["rakuten_url"])
                alerts += 1

    print(f"完了: 更新{updated}件 / 失敗{failed}件 / 通知{alerts}件" + (" (dry-run)" if dry_run else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description="ダッシュボード登録商品の価格更新")
    parser.add_argument("--dry-run", action="store_true", help="取得と計算だけ行い、DB更新・通知はしない")
    parser.add_argument("--no-notify", action="store_true", help="メール通知をしない")
    parser.add_argument("--no-headless", action="store_true", help="ブラウザを表示して実行する(デバッグ用)")
    args = parser.parse_args()
    asyncio.run(run(args.dry_run, not args.no_notify, not args.no_headless))


if __name__ == "__main__":
    main()
