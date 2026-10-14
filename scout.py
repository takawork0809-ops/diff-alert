"""
自動スカウト: 登録された条件(キーワード)でメルカリ・ヤフオクを検索し、
Amazon価格と照合して純利益が条件以上の商品を found_items に保存する。

処理の流れ:
    watch_conditions(is_active) → メルカリ/ヤフオク検索 → 商品名でAmazonを検索して価格を照合
    → 純利益 >= min_profit なら found_items に保存 → notify.py で1日1通のまとめメール

使い方:
    python scout.py                                  # 条件をSupabaseから読み、保存と通知まで行う
    python scout.py --keyword "ポケモンカード BOX" --min-profit 1000 --dry-run
                                                     # Supabaseを使わず、検索・照合・計算だけ試す
    python scout.py --no-notify                      # 保存まで行い、メールは送らない
"""

import argparse
import asyncio
import re
import sys
import unicodedata
from typing import Optional

try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

from dotenv import load_dotenv
from playwright.async_api import async_playwright

from main import calculate_profit, get_supabase_client
from scrapers.amazon_search import search_amazon
from scrapers.common import polite_sleep
from scrapers.mercari_search import search_mercari
from scrapers.yahuoku_search import search_yahuoku

load_dotenv()

SEARCHERS = {"mercari": search_mercari, "yahuoku": search_yahuoku}
SOURCE_LABELS = {"mercari": "メルカリ", "yahuoku": "ヤフオク"}
MAX_ITEMS_PER_SOURCE = 12   # 1条件・1仕入れ先あたり、Amazon照合まで行う件数(Amazon検索の回数を抑える)
MIN_SIMILARITY = 0.6        # 商品名の一致度がこれ未満なら「別の商品」とみなして捨てる
MAX_PRICE_RATIO = 3.0       # Amazon価格が仕入れ価格のこの倍率を超えたら、取り違え(別の商品・まとめ売りなど)とみなして捨てる
AMAZON_QUERY_MAX_CHARS = 60

_NOISE = re.compile(
    r"【[^】]*】|\[[^\]]*\]|\([^)]*\)|送料無料|新品|未使用|未開封|中古|美品|即決|匿名配送|早い者勝ち|プロフ必読|おまけ|激レア|超希少"
)


def _normalize(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "").lower()


def amazon_query(title: str) -> str:
    """出品タイトルから宣伝文句を除いて、Amazonの検索語にする。"""
    q = _NOISE.sub(" ", _normalize(title))
    q = re.sub(r"\s+", " ", q).strip()
    return q[:AMAZON_QUERY_MAX_CHARS] or _normalize(title)[:AMAZON_QUERY_MAX_CHARS]


def similarity(a: str, b: str) -> float:
    """文字2-gramのDice係数(0〜1)。日本語は単語に分けにくいので文字単位で比べる。"""

    def grams(s: str) -> set:
        s = re.sub(r"[\s　]+", "", _NOISE.sub("", _normalize(s)))
        return {s[i : i + 2] for i in range(len(s) - 1)}

    ga, gb = grams(a), grams(b)
    if not ga or not gb:
        return 0.0
    return 2 * len(ga & gb) / (len(ga) + len(gb))


_QTY = re.compile(r"(\d+)\s*(パック|個|本|枚|箱|袋|点|セット|box|ボックス)")


def quantity_mismatch(a: str, b: str) -> bool:
    """「9パック」と「30パック」のように、同じ単位の数量が食い違っていたら True。"""
    qa = {unit: int(n) for n, unit in _QTY.findall(_normalize(a))}
    qb = {unit: int(n) for n, unit in _QTY.findall(_normalize(b))}
    return any(unit in qb and qb[unit] != n for unit, n in qa.items())


def best_amazon_match(item_title: str, candidates: list) -> Optional[dict]:
    best, best_score = None, 0.0
    for c in candidates:
        if quantity_mismatch(item_title, c["title"]):
            continue
        score = similarity(item_title, c["title"])
        if score > best_score:
            best, best_score = c, score
    if best is None or best_score < MIN_SIMILARITY:
        return None
    return {**best, "similarity": best_score}


async def scout_condition(browser, cond: dict, amazon_cache: dict) -> list:
    """1つの条件について、基準を満たす商品のリストを返す。"""
    found = []
    for source in cond["sources"]:
        searcher = SEARCHERS.get(source)
        if searcher is None:
            continue
        try:
            items = await searcher(browser, cond["keyword"], limit=MAX_ITEMS_PER_SOURCE)
        except Exception as e:
            print(f"  [WARN] {SOURCE_LABELS.get(source, source)}の検索に失敗: {e}", file=sys.stderr)
            continue
        print(f"  {SOURCE_LABELS[source]}: {len(items)}件取得")
        await polite_sleep()

        for item in items:
            if not item.get("in_stock", True):
                continue
            query = amazon_query(item["title"])
            if query not in amazon_cache:
                try:
                    amazon_cache[query] = await search_amazon(browser, query)
                except Exception as e:
                    print(f"  [WARN] Amazon検索に失敗({query[:20]}…): {e}", file=sys.stderr)
                    amazon_cache[query] = []
                await polite_sleep()
            match = best_amazon_match(item["title"], amazon_cache[query])
            if match is None:
                print(f"    - 照合なし: {item['title'][:30]} ¥{item['price']:,}")
                continue

            if match["price"] > item["price"] * MAX_PRICE_RATIO:
                print(f"    - 価格差が大きすぎるため除外: {item['title'][:28]} ¥{item['price']:,} → Amazon ¥{match['price']:,}")
                continue

            calc = calculate_profit(match["price"], item["price"], cond["min_profit"], cond["category"])
            net = int(round(calc["net_margin"]))
            mark = "✅" if calc["recommended"] else "  "
            print(
                f"  {mark} {SOURCE_LABELS[source]} ¥{item['price']:,} → Amazon ¥{match['price']:,} "
                f"純利益¥{net:,} (一致度{match['similarity']:.2f}) {item['title'][:28]}"
            )
            if calc["recommended"]:
                found.append(
                    {
                        "source": source,
                        "item_title": item["title"],
                        "item_url": item["url"],
                        "item_price": item["price"],
                        "amazon_title": match["title"],
                        "amazon_price": match["price"],
                        "amazon_asin": match["asin"],
                        "estimated_profit": net,
                    }
                )
    return found


def load_conditions(client) -> list:
    rows = client.table("watch_conditions").select("*").eq("is_active", True).execute().data or []
    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "keyword": r["keyword"],
            "min_profit": int(r["min_profit"]),
            "sources": [s for s in (r.get("sources") or []) if s in SEARCHERS],
            "category": r.get("category") or "other",
        }
        for r in rows
    ]


def save_found(client, cond: dict, found: list) -> int:
    """found_items に保存する。同じ条件・同じURLは重複登録しない(unique制約+upsert)。"""
    if not found:
        return 0
    rows = [{"condition_id": cond["id"], "user_id": cond["user_id"], **f} for f in found]
    res = (
        client.table("found_items")
        .upsert(rows, on_conflict="condition_id,item_url", ignore_duplicates=True)
        .execute()
    )
    return len(res.data or [])


async def run(conditions: list, client, headless: bool = True) -> None:
    amazon_cache: dict = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        try:
            for i, cond in enumerate(conditions, 1):
                print(f"[{i}/{len(conditions)}] 「{cond['keyword']}」 最低純利益¥{cond['min_profit']:,} {cond['sources']}")
                found = await scout_condition(browser, cond, amazon_cache)
                if client is not None:
                    saved = save_found(client, cond, found)
                    print(f"  → 基準を満たす{len(found)}件、新規保存{saved}件")
                else:
                    print(f"  → 基準を満たす{len(found)}件(dry-run: 保存しません)")
        finally:
            await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="自動スカウト(メルカリ・ヤフオク→Amazon差益)")
    parser.add_argument("--keyword", help="指定すると、DBを使わずにこの条件だけ試す(--dry-run相当)")
    parser.add_argument("--min-profit", type=int, default=1000)
    parser.add_argument("--sources", default="mercari,yahuoku")
    parser.add_argument("--category", default="other", choices=["electronics", "game", "apparel", "other"])
    parser.add_argument("--dry-run", action="store_true", help="Supabaseに保存せず、結果の表示だけ行う")
    parser.add_argument("--no-notify", action="store_true", help="メール通知をしない")
    parser.add_argument("--no-headless", action="store_true")
    args = parser.parse_args()

    client = None
    if args.keyword:
        conditions = [
            {
                "id": None,
                "user_id": None,
                "keyword": args.keyword,
                "min_profit": args.min_profit,
                "sources": [s.strip() for s in args.sources.split(",") if s.strip() in SEARCHERS],
                "category": args.category,
            }
        ]
    else:
        client = get_supabase_client()
        if client is None:
            sys.exit("Supabaseの設定がありません。--keyword を付けるとDBなしで試せます。")
        conditions = load_conditions(client)
        if not conditions:
            print("有効な条件がありません。")
            return

    if args.dry_run:
        client = None
    asyncio.run(run(conditions, client, headless=not args.no_headless))

    if client is not None and not args.no_notify:
        from notify import notify_all

        notify_all(client)


if __name__ == "__main__":
    main()
