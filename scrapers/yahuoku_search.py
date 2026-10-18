"""ヤフオクの検索結果ページから、即決価格のある出品だけを取得する。

即決価格がある場合のみ仕入れ対象とする(入札は終了時の価格が読めないため)。

使い方(単体確認):
    python -m scrapers.yahuoku_search "ポケモンカード BOX"
"""

import asyncio
import json
import sys
from urllib.parse import quote

from playwright.async_api import Browser, async_playwright

from scrapers.common import fetch_page

SEARCH_URL = "https://auctions.yahoo.co.jp/search/search?p={kw}&va={kw}&buynow=1"
ITEM_URL = "https://auctions.yahoo.co.jp/jp/auction/{id}"

# 2026年10月以降の画面は、ページ内のデータ(__NEXT_DATA__)に検索結果が入っている。見た目のHTMLより変更に強い。
_NEXT_DATA_JS = "(() => { const e = document.getElementById('__NEXT_DATA__'); return e ? e.textContent : null; })()"


def _to_int(v) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _remaining(left_seconds: float) -> str:
    sec = int(left_seconds)
    if sec <= 0:
        return "終了"
    if sec >= 86400:
        return f"{sec // 86400}日"
    if sec >= 3600:
        return f"{sec // 3600}時間"
    return f"{max(sec // 60, 1)}分"


def _listing_items(raw: str) -> list:
    """__NEXT_DATA__ から検索結果の一覧を取り出す。構造が変わっていたら例外にして、呼び出し側に警告させる。"""
    try:
        data = json.loads(raw)
        return data["props"]["pageProps"]["initialState"]["search"]["items"]["listing"]["items"]
    except (KeyError, TypeError, ValueError) as e:
        raise RuntimeError(f"ヤフオクの検索結果の形式が変わった可能性があります: {e!r}")


async def search_yahuoku(browser: Browser, keyword: str, limit: int = 30) -> list:
    """戻り値: [{source, title, url, price(=即決価格), current_price, remaining, in_stock}]。"""
    async with fetch_page(browser, SEARCH_URL.format(kw=quote(keyword)), "a[href*='/jp/auction/']") as page:
        raw = await page.evaluate(_NEXT_DATA_JS)
    if not raw:
        raise RuntimeError("ヤフオクの検索結果ページを読み込めませんでした(__NEXT_DATA__ がありません)")

    items = []
    for r in _listing_items(raw):
        buynow = _to_int(r.get("buyNowPrice"))
        remaining = _remaining(r.get("leftTime") or 0)
        if not r.get("title") or not r.get("auctionId") or buynow <= 0:
            continue
        items.append(
            {
                "source": "yahuoku",
                "title": r["title"].strip(),
                "url": ITEM_URL.format(id=r["auctionId"]),
                "price": buynow,
                "current_price": _to_int(r.get("price")),
                "remaining": remaining,
                "in_stock": remaining != "終了",
            }
        )
        if len(items) >= limit:
            break
    return items


async def _cli(keyword: str) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            items = await search_yahuoku(browser, keyword, limit=10)
        finally:
            await browser.close()
    print(json.dumps(items, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(_cli(sys.argv[1] if len(sys.argv) > 1 else "ポケモンカード BOX"))
