"""
自動スカウトの通知: 未通知の found_items をユーザーごとにまとめて、1日1通のメールで送る。

使い方:
    python notify.py            # 未通知分を送信し、送った分に notified_at を記録する
    python notify.py --dry-run  # 送らずに、送る内容だけ表示する
SUPABASE_KEY には service_role キーが必要(全ユーザーの行を読むため)。
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from typing import Optional

import resend
from dotenv import load_dotenv

from main import get_supabase_client

load_dotenv()

FROM_EMAIL_DEFAULT = "onboarding@resend.dev"
SOURCE_LABELS = {"mercari": "メルカリ", "yahuoku": "ヤフオク"}
MAX_ITEMS_IN_MAIL = 30  # 件数が多い日でもメールが長くなりすぎないように、純利益の高い順に絞る


def _user_email(client, user_id: str) -> Optional[str]:
    try:
        return client.auth.admin.get_user_by_id(user_id).user.email
    except Exception as e:
        print(f"[WARN] ユーザーのメールアドレスを取得できませんでした: {e}", file=sys.stderr)
        return None


def build_message(items: list) -> tuple:
    """(件名, 本文) を作る。items は純利益の高い順に並べておく。"""
    shown = items[:MAX_ITEMS_IN_MAIL]
    lines = [f"条件に合う商品が{len(items)}件見つかりました。", ""]
    for i, it in enumerate(shown, 1):
        lines += [
            f"■ {i}. {it['item_title']}",
            f"  仕入れ先：{SOURCE_LABELS.get(it['source'], it['source'])}",
            f"  仕入れ価格：¥{it['item_price']:,}",
            f"  Amazon推定価格：¥{it['amazon_price']:,}",
            f"  純利益(手数料込み)：¥{it['estimated_profit']:,}",
            f"  商品URL：{it['item_url']}",
            "",
        ]
    if len(items) > len(shown):
        lines.append(f"(ほか{len(items) - len(shown)}件は、ダッシュボードでご確認ください)")
        lines.append("")
    lines += [
        "※ Amazonの価格は検索結果から推定した目安です。同じ商品か(型番・状態・セット内容)は、必ずご自身で確認してください。",
        "※ 一覧はダッシュボードでも見られます: https://sagakuradar.com/dashboard",
    ]
    return f"【差益レーダー】今日のお宝{len(items)}件", "\n".join(lines)


def notify_all(client, dry_run: bool = False) -> None:
    rows = (
        client.table("found_items")
        .select("*")
        .is_("notified_at", "null")
        .order("estimated_profit", desc=True)
        .execute()
        .data
        or []
    )
    if not rows:
        print("通知する新着はありません。")
        return

    by_user: dict = {}
    for r in rows:
        by_user.setdefault(r["user_id"], []).append(r)

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key and not dry_run:
        print("[WARN] RESEND_API_KEY が未設定のためメール通知をスキップします。", file=sys.stderr)
        return
    resend.api_key = api_key
    from_email = os.environ.get("RESEND_FROM_EMAIL", FROM_EMAIL_DEFAULT)

    for user_id, items in by_user.items():
        to = _user_email(client, user_id)
        if not to:
            continue
        subject, body = build_message(items)
        if dry_run:
            print(f"--- to: {to}\n{subject}\n{body}\n")
            continue
        try:
            resend.Emails.send({"from": from_email, "to": [to], "subject": subject, "text": body})
        except Exception as e:
            print(f"[WARN] メール送信に失敗しました({to}): {e}", file=sys.stderr)
            continue  # 送れなかった分は notified_at を付けず、次回に再送する
        now = datetime.now(timezone.utc).isoformat()
        client.table("found_items").update({"notified_at": now}).in_("id", [i["id"] for i in items]).execute()
        print(f"通知しました: {to} ({len(items)}件)")


def main() -> None:
    parser = argparse.ArgumentParser(description="自動スカウトのまとめメール通知")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    client = get_supabase_client()
    if client is None:
        sys.exit("Supabaseの設定がありません。")
    notify_all(client, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
