"""
楽天ウェブサービス Ichiba Item Search API クライアント

rakuten_scraper.py のスクレイピング版と同じ RakutenProduct(dataclass) を返すため、
呼び出し側(FastAPI等)はスクレイピング版とAPI版を意識せず差し替えられる。

事前準備:
    1. https://webservice.rakuten.co.jp/ で楽天会員としてアプリ登録し、
       applicationId と accessKey を取得する
    2. 環境変数 RAKUTEN_APPLICATION_ID / RAKUTEN_ACCESS_KEY に設定する
       （または呼び出し時に引数で渡す）

使い方:
    python rakuten_api.py https://item.rakuten.co.jp/shop/item/

注意:
    - 楽天ウェブサービス利用規約により、取得したデータを使って
      楽天アフィリエイト経由以外の方法で収益を得ることは原則禁止されている
      （会社が別途許可した場合を除く）。収益化方針が固まったら要確認
      (https://webservice.rakuten.co.jp/guide/rule 第10条)。
    - エンドポイントはバージョン管理されており、将来的にURLの更新が必要になる可能性がある。
      現行版: IchibaItem/Search/20260701
"""

import argparse
import asyncio
import os
import re
import sys
from datetime import datetime
from typing import Optional

import httpx

from rakuten_scraper import RakutenProduct, STOCK_IN, STOCK_OUT, STOCK_UNKNOWN, print_result

API_ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"


def extract_item_code_from_url(url: str) -> Optional[str]:
    """https://item.rakuten.co.jp/shop/item/ 形式のURLから 'shop:item' 形式のitemCodeを作る"""
    match = re.search(r"item\.rakuten\.co\.jp/([^/]+)/([^/?#]+)", url)
    if not match:
        return None
    shop_code, item_id = match.groups()
    return f"{shop_code}:{item_id}"


async def fetch_rakuten_item_via_api(
    url_or_item_code: str,
    application_id: Optional[str] = None,
    access_key: Optional[str] = None,
    timeout: float = 10.0,
) -> RakutenProduct:
    """
    Ichiba Item Search API から商品名・価格(税込)・在庫状況を取得する。
    rakuten_scraper.scrape_rakuten_item() と同じ RakutenProduct を返すので、
    呼び出し側のコードを変えずにスクレイピング版と差し替え可能。

    url_or_item_code: https://item.rakuten.co.jp/shop/item/ 形式のURL、
                       または 'shop:item' 形式のitemCode、どちらでも可。
    """
    application_id = application_id or os.environ.get("RAKUTEN_APPLICATION_ID")
    access_key = access_key or os.environ.get("RAKUTEN_ACCESS_KEY")

    if url_or_item_code.startswith("http"):
        item_code = extract_item_code_from_url(url_or_item_code)
        original_url = url_or_item_code
    else:
        item_code = url_or_item_code
        original_url = ""

    result = RakutenProduct(url=original_url or url_or_item_code, fetched_at=datetime.now().isoformat())

    if not application_id:
        result.error = "RAKUTEN_APPLICATION_ID が設定されていません"
        return result
    if not item_code:
        result.error = f"itemCodeを特定できませんでした: {url_or_item_code}"
        return result

    params = {
        "applicationId": application_id,
        "itemCode": item_code,
        "formatVersion": 2,
    }
    if access_key:
        params["accessKey"] = access_key

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(API_ENDPOINT, params=params)
    except httpx.TimeoutException:
        result.error = f"APIリクエストがタイムアウトしました ({timeout}秒)"
        return result
    except httpx.HTTPError as e:
        result.error = f"APIリクエストに失敗しました: {e}"
        return result

    if resp.status_code == 429:
        result.error = "APIのレート制限を超えました (429)"
        return result
    if resp.status_code != 200:
        result.error = f"APIエラー: status={resp.status_code} body={resp.text[:200]}"
        return result

    try:
        data = resp.json()
    except ValueError:
        result.error = "APIレスポンスのJSON解析に失敗しました"
        return result

    items = data.get("items") or data.get("Items") or []
    if not items:
        result.error = f"商品が見つかりませんでした (itemCode={item_code})"
        return result

    item = items[0]
    result.product_name = item.get("itemName")
    result.price = item.get("itemPrice")

    availability = item.get("availability")
    if availability == 1:
        result.stock_status = STOCK_IN
    elif availability == 0:
        result.stock_status = STOCK_OUT
    else:
        result.stock_status = STOCK_UNKNOWN

    result.url = item.get("itemUrl") or result.url
    result.success = bool(result.product_name and result.price is not None)
    return result


async def _main_async(url_or_item_code: str) -> RakutenProduct:
    result = await fetch_rakuten_item_via_api(url_or_item_code)
    print_result(result)
    return result


def main():
    parser = argparse.ArgumentParser(description="楽天ウェブサービス Ichiba Item Search API クライアント")
    parser.add_argument("url_or_item_code", help="商品ページURL、または 'shop:item' 形式のitemCode")
    args = parser.parse_args()

    if not os.environ.get("RAKUTEN_APPLICATION_ID"):
        print(
            "[ERROR] 環境変数 RAKUTEN_APPLICATION_ID が未設定です。"
            " https://webservice.rakuten.co.jp/ でアプリ登録して取得してください。",
            file=sys.stderr,
        )
        sys.exit(1)

    asyncio.run(_main_async(args.url_or_item_code))


if __name__ == "__main__":
    main()
