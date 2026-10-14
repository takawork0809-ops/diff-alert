"""検索スクレイパー共通部品。ステルス設定とUser-Agentは rakuten_scraper.py のものを流用する。"""

import asyncio
import random
import re
from contextlib import asynccontextmanager
from typing import Optional

from playwright.async_api import Browser, Page

from rakuten_scraper import _apply_stealth, USER_AGENT

MIN_WAIT_SECONDS = 3
MAX_WAIT_SECONDS = 5


async def polite_sleep() -> None:
    """アクセス間隔(3〜5秒)。サーバー負荷軽減と、人間らしいアクセスのために必ず挟む。"""
    await asyncio.sleep(random.uniform(MIN_WAIT_SECONDS, MAX_WAIT_SECONDS))


@asynccontextmanager
async def fetch_page(browser: Browser, url: str, wait_selector: str, timeout_ms: int = 40000):
    """URLを開き、wait_selector が出るまで待ってから Page を渡す。終了時にコンテキストを閉じる。"""
    ctx = await browser.new_context(user_agent=USER_AGENT, locale="ja-JP")
    try:
        page: Page = await ctx.new_page()
        await _apply_stealth(page)
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        try:
            await page.wait_for_selector(wait_selector, timeout=15000)
        except Exception:
            pass  # 結果0件のページなど。呼び出し側で空リストとして扱う
        await page.wait_for_timeout(1500)
        yield page
    finally:
        await ctx.close()


def parse_yen(text: Optional[str]) -> Optional[int]:
    """「¥5,900」「5,900円」「￥3,480」などから整数の円を取り出す。"""
    if not text:
        return None
    m = re.search(r"(?:[¥￥]\s*)?([\d,]+)", text)
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None
