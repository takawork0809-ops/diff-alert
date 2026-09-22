"""
楽天市場 商品ページ ステルススクレイピングスクリプト

セットアップ:
    pip install -r requirements.txt
    playwright install chromium

使い方:
    python rakuten_scraper.py https://item.rakuten.co.jp/shop/item/
    python rakuten_scraper.py https://item.rakuten.co.jp/shop/item/ --no-headless  # デバッグ用にブラウザ表示

備考:
    - 楽天の利用規約上、スクレイピングが制限される場合があります。継続的・商用利用する場合は
      「楽天ウェブサービス(RMS) Ichiba Item Search API」など公式APIの利用を推奨します。
    - ショップごとにページ構造が異なるため、価格・在庫の取得は
      JSON-LD(構造化データ) → CSSセレクタ → 本文テキスト正規表現 の順でフォールバックします。
    - FastAPI等から使う場合は scrape_rakuten_item() をそのまま await してください。
      戻り値は RakutenProduct(dataclass) で、.to_dict() でJSON化できます。
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

_STEALTH_MODE = None
try:
    from playwright_stealth import stealth_async  # playwright-stealth 1.x
    _STEALTH_MODE = "func"
except ImportError:
    try:
        from playwright_stealth import Stealth  # playwright-stealth 2.x
        _STEALTH_MODE = "class"
    except ImportError:
        _STEALTH_MODE = None


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

STOCK_IN = "在庫あり"
STOCK_OUT = "在庫なし"
SOLD_OUT = "売り切れ"
STOCK_UNKNOWN = "不明"


@dataclass
class RakutenProduct:
    url: str
    product_name: Optional[str] = None
    price: Optional[int] = None
    stock_status: str = STOCK_UNKNOWN
    fetched_at: str = ""
    success: bool = False
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


async def _apply_stealth(page: Page) -> None:
    """playwright-stealth を適用（バージョン差異を吸収）。失敗しても処理は続行する。"""
    try:
        if _STEALTH_MODE == "func":
            await stealth_async(page)
        elif _STEALTH_MODE == "class":
            await Stealth().apply_stealth_async(page)
        else:
            print("[WARN] playwright-stealth が見つかりません。手動設定のみ適用します。", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] stealth適用に失敗しました: {e}", file=sys.stderr)

    # stealthライブラリの有無に関わらず適用する保険的な対策
    await page.add_init_script(
        """
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        window.chrome = { runtime: {} };
        """
    )


def _parse_price(text: str) -> Optional[int]:
    if not text:
        return None
    match = re.search(r"([\d,]+)\s*円", text)
    if match:
        try:
            return int(match.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


def _parse_stock_text(text: str) -> Optional[str]:
    if not text:
        return None
    if any(k in text for k in ("売り切れ", "完売")):
        return SOLD_OUT
    if any(k in text for k in ("在庫なし", "在庫切れ", "品切れ")):
        return STOCK_OUT
    if "在庫あり" in text:
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


async def _extract_from_microdata(page: Page) -> dict:
    """schema.org microdata(itemprop属性)からの抽出を試みる。
    JSON-LDを使わず旧来のmicrodata形式を採用している楽天ショップテンプレートが多いため、
    JSON-LDに次ぐ2番目に信頼できるルートとして扱う。
    """
    result: dict = {}
    scope = '[itemtype*="schema.org/Product"]'
    try:
        if await page.locator(scope).count() == 0:
            return result

        name_loc = page.locator(f'{scope} [itemprop="name"]').first
        if await name_loc.count():
            content = await name_loc.get_attribute("content")
            if content:
                result["product_name"] = content.strip()

        price_loc = page.locator(f'{scope} [itemprop="price"]').first
        if await price_loc.count():
            content = await price_loc.get_attribute("content")
            if content:
                try:
                    result["price"] = int(float(content))
                except ValueError:
                    pass

        availability_loc = page.locator(f'{scope} [itemprop="availability"]').first
        if await availability_loc.count():
            content = (await availability_loc.get_attribute("content") or "").lower()
            if "instock" in content:
                result["stock_status"] = STOCK_IN
            elif "outofstock" in content or "soldout" in content:
                result["stock_status"] = STOCK_OUT
    except Exception:
        pass
    return result


async def _extract_product_name(page: Page) -> Optional[str]:
    for selector in ("h1", 'meta[property="og:title"]', "title"):
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
    for selector in (
        "#priceCalculationConfirmedAmount",
        ".price2",
        ".price",
        '[class*="price"]',
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

    # 最終フォールバック: ページ全体のテキストから正規表現で検索
    try:
        body_text = await page.locator("body").inner_text(timeout=5000)
        return _parse_price(body_text)
    except Exception:
        return None


async def _extract_stock_status(page: Page) -> str:
    for selector in ('[class*="stock"]', '[class*="zaiko"]', "body"):
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

    # 明示的な在庫テキストが無い場合、購入ボタンの有無から推測する
    try:
        body_text = await page.locator("body").inner_text(timeout=5000)
        if any(k in body_text for k in ("購入手続きへ", "かごに追加", "買い物かごに入れる")):
            return STOCK_IN
        if any(k in body_text for k in ("入荷お知らせ", "再入荷")):
            return STOCK_OUT
    except Exception:
        pass

    return STOCK_UNKNOWN


async def scrape_rakuten_item(url: str, headless: bool = True, timeout_ms: int = 30000) -> RakutenProduct:
    """
    楽天市場の商品ページから商品名・価格(税込)・在庫状況を取得する。

    FastAPI等のエンドポイントから呼び出す際は、この関数をそのまま await して
    RakutenProduct を受け取り、.to_dict() でレスポンスJSON化できる。
    """
    result = RakutenProduct(url=url, fetched_at=datetime.now().isoformat())

    if "item.rakuten.co.jp" not in url:
        result.error = "URLが item.rakuten.co.jp 配下ではありません"
        return result

    async with async_playwright() as p:
        browser = None
        try:
            browser = await p.chromium.launch(
                headless=headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
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
                await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
                await page.wait_for_timeout(1500)  # 動的コンテンツの描画待ち
            except PlaywrightTimeoutError:
                result.error = f"ページ読み込みがタイムアウトしました ({timeout_ms}ms)"
                return result

            # 構造化データを優先: JSON-LD -> microdata -> CSS/正規表現フォールバック
            jsonld_data = await _extract_from_jsonld(page)
            microdata = await _extract_from_microdata(page)

            result.product_name = (
                jsonld_data.get("product_name")
                or microdata.get("product_name")
                or await _extract_product_name(page)
            )
            result.price = jsonld_data.get("price") or microdata.get("price")
            if result.price is None:
                result.price = await _extract_price(page)
            result.stock_status = (
                jsonld_data.get("stock_status")
                or microdata.get("stock_status")
                or await _extract_stock_status(page)
            )

            errors = []
            if not result.product_name:
                errors.append("商品名を特定できませんでした。")
            if result.price is None:
                errors.append("価格を特定できませんでした。")
            if errors:
                result.error = " ".join(errors)

            result.success = bool(result.product_name and result.price is not None)
            return result

        except Exception as e:
            result.error = f"予期しないエラー: {type(e).__name__}: {e}"
            return result
        finally:
            if browser:
                await browser.close()


def print_result(result: RakutenProduct) -> None:
    print("=" * 50)
    print(f"URL       : {result.url}")
    print(f"商品名     : {result.product_name or '取得失敗'}")
    print(f"価格(税込) : {f'¥{result.price:,}' if result.price is not None else '取得失敗'}")
    print(f"在庫状況   : {result.stock_status}")
    print(f"取得日時   : {result.fetched_at}")
    print(f"成功       : {result.success}")
    if result.error:
        print(f"エラー     : {result.error.strip()}")
    print("=" * 50)


async def _main_async(url: str, headless: bool) -> RakutenProduct:
    result = await scrape_rakuten_item(url, headless=headless)
    print_result(result)
    return result


def main():
    parser = argparse.ArgumentParser(description="楽天市場 商品ページ ステルススクレイパー")
    parser.add_argument("url", help="楽天市場の商品ページURL (例: https://item.rakuten.co.jp/shop/item/)")
    parser.add_argument("--no-headless", action="store_true", help="ブラウザを表示して実行する（デバッグ用）")
    args = parser.parse_args()

    asyncio.run(_main_async(args.url, headless=not args.no_headless))


if __name__ == "__main__":
    main()
