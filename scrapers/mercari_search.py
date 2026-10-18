"""メルカリの検索結果ページから、販売中の商品を取得する。

使い方(単体確認):
    python -m scrapers.mercari_search "ポケモンカード BOX"
"""

import asyncio
import json
import re
import sys
from typing import Optional
from urllib.parse import quote

from playwright.async_api import Browser, async_playwright

from scrapers.common import fetch_page

# shipping_payer_id=2: 送料込み(出品者負担)だけ。着払い(購入者負担)は、送料の分だけ利益が減るのに計算に入らないため、除く。
SEARCH_URL = "https://jp.mercari.com/search?keyword={kw}&status=on_sale&shipping_payer_id=2&sort=created_time&order=desc"
BASE_URL = "https://jp.mercari.com"

_EXTRACT_JS = """() => [...document.querySelectorAll('[data-testid="item-cell"]')].map(c => {
  const a = c.querySelector('a[href*="/item/"]');
  const t = c.querySelector('[data-testid="thumbnail-item-name"]');
  return { href: a && a.getAttribute('href'), name: t && t.textContent, text: c.innerText };
})"""


async def search_mercari(browser: Browser, keyword: str, limit: int = 30) -> list:
    """戻り値: [{source, title, url, price, in_stock}]。価格が読めない行は捨てる。"""
    async with fetch_page(browser, SEARCH_URL.format(kw=quote(keyword)), '[data-testid="item-cell"]') as page:
        rows = await page.evaluate(_EXTRACT_JS)

    items = []
    for r in rows:
        if not r.get("href") or not r.get("name"):
            continue
        m = re.search(r"[¥￥]\s*([\d,]+)", r.get("text") or "")
        if not m:
            continue
        items.append(
            {
                "source": "mercari",
                "title": r["name"].strip(),
                "url": BASE_URL + r["href"].split("?")[0],
                "price": int(m.group(1).replace(",", "")),
                "in_stock": True,  # status=on_sale で絞っているため
            }
        )
        if len(items) >= limit:
            break
    return items


async def _cli(keyword: str) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            items = await search_mercari(browser, keyword, limit=10)
        finally:
            await browser.close()
    print(json.dumps(items, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(_cli(sys.argv[1] if len(sys.argv) > 1 else "ポケモンカード BOX"))
