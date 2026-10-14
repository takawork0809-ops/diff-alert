"""ヤフオクの検索結果ページから、即決価格のある出品だけを取得する。

即決価格がある場合のみ仕入れ対象とする(入札は終了時の価格が読めないため)。

使い方(単体確認):
    python -m scrapers.yahuoku_search "ポケモンカード BOX"
"""

import asyncio
import json
import sys
import time
from urllib.parse import quote

from playwright.async_api import Browser, async_playwright

from scrapers.common import fetch_page

SEARCH_URL = "https://auctions.yahoo.co.jp/search/search?p={kw}&va={kw}&buynow=1"

_EXTRACT_JS = """() => [...document.querySelectorAll('li.Product')].map(li => {
  const link = li.querySelector('a.Product__titleLink');
  const bonus = li.querySelector('.Product__bonus');
  return {
    id: bonus && bonus.dataset.auctionId,
    title: link && link.dataset.auctionTitle,
    url: link && link.href,
    price: bonus && bonus.dataset.auctionPrice,
    buynow: bonus && bonus.dataset.auctionBuynowprice,
    end: bonus && bonus.dataset.auctionEndtime,
  };
})"""


def _to_int(v) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _remaining(end_ts: int) -> str:
    sec = end_ts - int(time.time())
    if sec <= 0:
        return "終了"
    if sec >= 86400:
        return f"{sec // 86400}日"
    if sec >= 3600:
        return f"{sec // 3600}時間"
    return f"{max(sec // 60, 1)}分"


async def search_yahuoku(browser: Browser, keyword: str, limit: int = 30) -> list:
    """戻り値: [{source, title, url, price(=即決価格), current_price, remaining, in_stock}]。"""
    async with fetch_page(browser, SEARCH_URL.format(kw=quote(keyword)), "li.Product") as page:
        rows = await page.evaluate(_EXTRACT_JS)

    items = []
    for r in rows:
        buynow = _to_int(r.get("buynow"))
        end_ts = _to_int(r.get("end"))
        if not r.get("title") or not r.get("url") or buynow <= 0:
            continue
        remaining = _remaining(end_ts)
        items.append(
            {
                "source": "yahuoku",
                "title": r["title"].strip(),
                "url": r["url"].split("?")[0],
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
