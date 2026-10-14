"""Amazonの検索結果ページから、スポンサー広告を除いた上位商品の価格を取得する。

使い方(単体確認):
    python -m scrapers.amazon_search "ポケモンカード BOX"
"""

import asyncio
import json
import sys
from urllib.parse import quote

from playwright.async_api import Browser, async_playwright

from scrapers.common import fetch_page, parse_yen

SEARCH_URL = "https://www.amazon.co.jp/s?k={kw}"

_EXTRACT_JS = """() => [...document.querySelectorAll('[data-component-type="s-search-result"]')].map(c => {
  const h = c.querySelector('h2');
  const p = c.querySelector('.a-price .a-offscreen');
  return {
    asin: c.getAttribute('data-asin'),
    name: h && h.textContent.trim(),
    price: p && p.textContent,
    sponsored: !!c.querySelector('.puis-sponsored-label-text, [aria-label*="スポンサー"]'),
  };
})"""


async def search_amazon(browser: Browser, keyword: str, top: int = 5) -> list:
    """広告でなく価格のある上位 top 件を返す。戻り値: [{asin, title, price}]"""
    async with fetch_page(browser, SEARCH_URL.format(kw=quote(keyword)), '[data-component-type="s-search-result"]') as page:
        rows = await page.evaluate(_EXTRACT_JS)

    results = []
    for r in rows:
        price = parse_yen(r.get("price")) if r.get("price") and any(s in r["price"] for s in "¥￥") else None
        if r.get("sponsored") or not r.get("asin") or not r.get("name") or not price:
            continue
        results.append({"asin": r["asin"], "title": r["name"], "price": price})
        if len(results) >= top:
            break
    return results


async def _cli(keyword: str) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            items = await search_amazon(browser, keyword)
        finally:
            await browser.close()
    print(json.dumps(items, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(_cli(sys.argv[1] if len(sys.argv) > 1 else "ポケモンカード BOX"))
