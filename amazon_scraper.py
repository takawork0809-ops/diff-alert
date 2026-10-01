"""
Amazon.co.jp 商品ページ ステルススクレイピングスクリプト

セットアップ:
    pip install -r requirements.txt
    playwright install chromium

使い方:
    python amazon_scraper.py B0CX4MPDQ5
    python amazon_scraper.py B0CX4MPDQ5 --no-headless  # デバッグ用にブラウザ表示

備考:
    - ステルス設定(_apply_stealth)とUser-Agentは rakuten_scraper.py のものをそのまま流用する。
    - 価格・在庫の取得は JSON-LD(構造化データ) → CSSセレクタ → 本文テキスト正規表現 の順でフォールバックする。
"""

import argparse
import asyncio
import json
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional

from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeoutError

from rakuten_scraper import _apply_stealth, USER_AGENT, STOCK_IN, STOCK_OUT, STOCK_UNKNOWN

SOLD_OUT = "売り切れ"

# ボット検知ページ等から無関係な小さい数字を「価格」として誤抽出してしまうことがあるため、
# この金額未満は現実的なAmazon価格としてありえないとみなし、取得失敗として扱う。
MIN_PLAUSIBLE_PRICE = 100


@dataclass
class AmazonProduct:
    asin: str
    url: str
    product_name: Optional[str] = None
    price: Optional[int] = None
    stock_status: str = STOCK_UNKNOWN
    fetched_at: str = ""
    success: bool = False
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _parse_price(text: str) -> Optional[int]:
    if not text:
        return None
    match = re.search(r"[\d,]+", text)
    if match:
        try:
            return int(match.group(0).replace(",", ""))
        except ValueError:
            return None
    return None


def _parse_stock_text(text: str) -> Optional[str]:
    if not text:
        return None
    if any(k in text for k in ("在庫切れ", "現在お取り扱いできません")):
        return STOCK_OUT
    if "一時的に在庫切れ" in text:
        return STOCK_OUT
    if "在庫あり" in text:
        return STOCK_IN
    if "残り" in text and "点" in text:
        return STOCK_IN
    return None


async def _extract_from_jsonld(page: Page) -> dict:
    """JSON-LD構造化データ(schema.org Product)からの抽出を試みる。最も信頼できるルート。"""
    result: dict = {}
    try:
        scripts = await page.locator('script[type="application/ld+json"]').all_text_contents()
    except Exception:
        return result

    for raw in scripts:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        candidates = data if isinstance(data, list) else [data]
        for item in candidates:
            if not isinstance(item, dict) or item.get("@type") != "Product":
                continue

            if item.get("name"):
                result["product_name"] = item["name"]

            offers = item.get("offers")
            if isinstance(offers, list):
                offers = offers[0] if offers else None
            if isinstance(offers, dict):
                price = offers.get("price")
                if price is not None:
                    try:
                        result["price"] = int(float(price))
                    except (TypeError, ValueError):
                        pass

                availability = (offers.get("availability") or "").lower()
                if "instock" in availability:
                    result["stock_status"] = STOCK_IN
                elif "outofstock" in availability or "soldout" in availability:
                    result["stock_status"] = STOCK_OUT
    return result


async def _extract_product_name(page: Page) -> Optional[str]:
    for selector in ("#productTitle", 'meta[property="og:title"]', "title"):
        try:
            locator = page.locator(selector).first
            if await locator.count() == 0:
                continue
            if selector.startswith("meta"):
                content = await locator.get_attribute("content")
                if content:
                    return content.strip()
            else:
                text = await locator.inner_text(timeout=3000)
                if text:
                    return text.strip()
        except (PlaywrightTimeoutError, Exception):
            continue
    return None


async def _extract_price(page: Page) -> Optional[int]:
    # 「買い物かご(バイボックス)」領域に限定したセレクタをまず試す。
    for selector in (
        "#corePrice_feature_div .a-price .a-offscreen",
        "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
        ".apexPriceToPay .a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
    ):
        try:
            locator = page.locator(selector).first
            if await locator.count() == 0:
                continue
            text = await locator.inner_text(timeout=3000)
            price = _parse_price(text)
            if price:
                return price
        except (PlaywrightTimeoutError, Exception):
            continue

    # 注意: 以前はここに "#ppd .a-price .a-offscreen" や ".a-price .a-offscreen" を
    # 広めのフォールバックとして使っていたが、関連商品/おすすめ商品等の無関係な価格
    # (本体価格と無関係だが¥100以上で"もっともらしく見える"値)を誤って拾う事例が
    # 複数回確認されたため廃止した。間違った価格を保存・通知するリスクの方が、
    # 取得失敗として諦めるリスクより大きいと判断し、安全側に倒している。

    return None


async def _extract_stock_status(page: Page) -> str:
    for selector in ("#availability", "#outOfStockBuyBox", "body"):
        try:
            locator = page.locator(selector).first
            if await locator.count() == 0:
                continue
            text = await locator.inner_text(timeout=3000)
            status = _parse_stock_text(text)
            if status:
                return status
        except (PlaywrightTimeoutError, Exception):
            continue

    # 明示的な在庫テキストが無い場合、カート/購入ボタンの有無から推測する
    try:
        body_text = await page.locator("body").inner_text(timeout=5000)
        if any(k in body_text for k in ("カートに入れる", "今すぐ買う")):
            return STOCK_IN
    except Exception:
        pass

    return STOCK_UNKNOWN


async def scrape_amazon(asin: str, headless: bool = True, timeout_ms: int = 30000) -> dict:
    """
    Amazon.co.jp の商品ページから商品名・Amazon価格(税込)・在庫状況を取得する。
    戻り値は dict (AmazonProduct.to_dict())。
    """
    url = f"https://www.amazon.co.jp/dp/{asin}"
    result = AmazonProduct(asin=asin, url=url, fetched_at=datetime.now().isoformat())

    async with async_playwright() as p:
        browser = None
        try:
            browser = await p.chromium.launch(
                headless=headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-gpu",
                ],
            )
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 800},
                locale="ja-JP",
                timezone_id="Asia/Tokyo",
                extra_http_headers={"Accept-Language": "ja-JP,ja;q=0.9"},
            )
            page = await context.new_page()
            await _apply_stealth(page)

            try:
                response = await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
                # 固定で1.5秒待つだけだと、CPUが遅い実行環境(Railway等)では価格欄の
                # 描画がまだ終わっていないことがあるため、価格欄 or 商品タイトルが
                # 実際に現れるまで(最大8秒)待ってから、念のため少し追加で待つ。
                try:
                    await page.wait_for_selector(
                        "#corePrice_feature_div, #productTitle", timeout=8000
                    )
                except PlaywrightTimeoutError:
                    pass
                await page.wait_for_timeout(1000)
            except PlaywrightTimeoutError:
                result.error = f"ページ読み込みがタイムアウトしました ({timeout_ms}ms)"
                return result.to_dict()

            if await page.locator('form[action="/errors_page/validateCaptcha"]').count():
                result.error = "Amazonのボット検知(CAPTCHA)によりブロックされました。IPやUAを変えて再試行してください。"
                return result.to_dict()

            page_title = await page.title()
            if response is not None and response.status == 404 and page_title == "ページが見つかりません":
                result.error = (
                    "Amazonにボット/自動アクセスとして判定されブロックされました"
                    "(404応答)。実行環境のIPやブラウザフィンガープリントが原因の可能性があります。"
                    "ASINが正しいか、時間を置く・別ネットワークで再試行することも確認してください。"
                )
                return result.to_dict()

            jsonld_data = await _extract_from_jsonld(page)

            result.product_name = jsonld_data.get("product_name") or await _extract_product_name(page)
            result.price = jsonld_data.get("price")
            if result.price is None:
                result.price = await _extract_price(page)
            result.stock_status = jsonld_data.get("stock_status") or await _extract_stock_status(page)

            errors = []
            if not result.product_name:
                errors.append("商品名を特定できませんでした。")
            if result.price is not None and result.price < MIN_PLAUSIBLE_PRICE:
                # ボット検知ページ等からの誤抽出とみなし、価格を無効化する。
                errors.append(
                    f"取得した価格(¥{result.price})が不自然に低いため、誤抽出(ボット検知ページ等)の可能性があり無効化しました。"
                )
                result.price = None
            if result.price is None:
                errors.append("価格を特定できませんでした。")
            if errors:
                # 原因調査用の簡易診断情報(実際にサーバーへ何が返ってきているか)を付与する。
                # 本文冒頭(ナビゲーション文言)だけでは手がかりが薄いため、"¥"を含む
                # 箇所があればその前後も合わせて抜き出す。
                try:
                    diag_title = await page.title()
                    diag_status = response.status if response is not None else "?"
                    body_text = await page.locator("body").inner_text(timeout=3000)
                    diag_head = body_text[:100].replace("\n", " ")
                    yen_idx = body_text.find("¥")
                    diag_yen = (
                        body_text[max(0, yen_idx - 30) : yen_idx + 30].replace("\n", " ")
                        if yen_idx != -1
                        else "(¥を含む箇所なし)"
                    )
                    price_locator = page.locator(".a-price .a-offscreen")
                    price_el_count = await price_locator.count()
                    # 候補の価格テキストを先頭から最大8個並べて記録する。
                    # どのインデックスが本体価格なのかを特定するための手がかりにする。
                    candidates = []
                    for i in range(min(price_el_count, 8)):
                        try:
                            candidates.append(await price_locator.nth(i).inner_text(timeout=1000))
                        except Exception:
                            candidates.append("?")
                    errors.append(
                        f"[診断] status={diag_status} title={diag_title!r} "
                        f"body先頭={diag_head!r} ¥周辺={diag_yen!r} "
                        f".a-price要素数={price_el_count} 候補={candidates!r}"
                    )
                except Exception:
                    pass
                result.error = " ".join(errors)

            result.success = bool(result.product_name and result.price is not None)
            return result.to_dict()

        except Exception as e:
            result.error = f"予期しないエラー: {type(e).__name__}: {e}"
            return result.to_dict()
        finally:
            if browser:
                await browser.close()


def print_result(result: dict) -> None:
    price_text = f"¥{result['price']:,}" if result["price"] is not None else "取得失敗"
    print("=" * 50)
    print(f"ASIN      : {result['asin']}")
    print(f"URL       : {result['url']}")
    print(f"商品名     : {result['product_name'] or '取得失敗'}")
    print(f"価格(税込) : {price_text}")
    print(f"在庫状況   : {result['stock_status']}")
    print(f"取得日時   : {result['fetched_at']}")
    print(f"成功       : {result['success']}")
    if result.get("error"):
        print(f"エラー     : {result['error'].strip()}")
    print("=" * 50)


async def _main_async(asin: str, headless: bool) -> dict:
    result = await scrape_amazon(asin, headless=headless)
    print_result(result)
    return result


def main():
    parser = argparse.ArgumentParser(description="Amazon.co.jp 商品ページ ステルススクレイパー")
    parser.add_argument("asin", help="Amazon ASIN (例: B0CX4MPDQ5)")
    parser.add_argument("--no-headless", action="store_true", help="ブラウザを表示して実行する（デバッグ用）")
    args = parser.parse_args()

    asyncio.run(_main_async(args.asin, headless=not args.no_headless))


if __name__ == "__main__":
    main()
