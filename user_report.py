"""
ユーザー集計レポート: 無料プランの利用状況を見て、有料プランの受付を始めるかを判断するための数字を出す。

見る指標:
    新規登録のペース / 条件を登録した割合 / 無料の上限に達した人 / お宝が見つかった人 / 最近ログインした人 / 有料契約

使い方:
    python user_report.py                                  # 画面に表示する(メールアドレスは表示しない)
    python user_report.py --exclude a@x.com,b@x.com        # 自分のアカウントを除いた「外部ユーザー」の数字も出す
    python user_report.py --mail                           # 同じ内容を、通知先(ALERT_EMAIL_TO)にメールする
環境変数 REPORT_EXCLUDE_EMAILS(カンマ区切り)でも、除外するアカウントを指定できる。
SUPABASE_KEY には service_role キーが必要(全ユーザーを読むため)。
"""

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv

from main import ALERT_EMAIL_TO, get_supabase_client

load_dotenv()

FREE_LIMIT = 3  # 無料プランの条件数の上限(web/lib/plans.ts の PLANS.free.limit と同じ値)
JST = timezone(timedelta(hours=9))


def _dt(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def fetch_all_users(client) -> list:
    users, page = [], 1
    while True:
        batch = client.auth.admin.list_users(page=page, per_page=1000)
        users.extend(batch)
        if len(batch) < 1000:
            return users
        page += 1


def _pct(n: int, d: int) -> str:
    return f"{n / d * 100:.0f}%" if d else "-"


def build_section(title: str, users: list, conds: list, found: list, subs: list, now: datetime) -> list:
    ids = {u.id for u in users}
    cond_by_user = Counter(c["user_id"] for c in conds if c["user_id"] in ids)
    found_users = {f["user_id"] for f in found if f["user_id"] in ids}
    found_recent = [f for f in found if f["user_id"] in ids and (_dt(f["found_at"]) or now) >= now - timedelta(days=7)]
    paid = [s for s in subs if s["user_id"] in ids and s.get("status") in ("active", "trialing", "past_due")]

    total = len(users)
    created = [_dt(u.created_at) for u in users]
    signed_7 = sum(1 for d in created if d and d >= now - timedelta(days=7))
    signed_30 = sum(1 for d in created if d and d >= now - timedelta(days=30))
    confirmed = sum(1 for u in users if u.email_confirmed_at)
    active_7 = sum(1 for u in users if (_dt(u.last_sign_in_at) or datetime.min.replace(tzinfo=timezone.utc)) >= now - timedelta(days=7))
    with_cond = sum(1 for u in users if cond_by_user.get(u.id, 0) > 0)
    at_limit = sum(1 for u in users if cond_by_user.get(u.id, 0) >= FREE_LIMIT)

    lines = [f"■ {title}", f"  登録ユーザー: {total}人(直近7日 +{signed_7} / 直近30日 +{signed_30})"]
    lines.append(f"  メール認証済み: {confirmed}人({_pct(confirmed, total)})")
    lines.append(f"  直近7日にログイン: {active_7}人({_pct(active_7, total)})")
    lines.append(f"  条件を登録した: {with_cond}人({_pct(with_cond, total)}) / 条件の総数 {sum(cond_by_user.values())}件")
    lines.append(f"  無料の上限({FREE_LIMIT}件)に達した: {at_limit}人  ← 有料プランの需要の目安")
    lines.append(f"  お宝が見つかった: {len(found_users)}人({_pct(len(found_users), total)}) / 直近7日の件数 {len(found_recent)}件")
    by_plan = Counter(s.get("plan") for s in paid)
    lines.append(f"  有料の契約: {len(paid)}件" + (f"({', '.join(f'{k} {v}' for k, v in by_plan.items())})" if paid else ""))
    return lines


def daily_signups(users: list, now: datetime, days: int = 14) -> list:
    counts = Counter((_dt(u.created_at) or now).astimezone(JST).date() for u in users)
    today = now.astimezone(JST).date()
    rows = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        rows.append(f"  {d.strftime('%m/%d')} {'█' * counts.get(d, 0)} {counts.get(d, 0)}")
    return rows


def build_report(client, exclude: set) -> str:
    now = datetime.now(timezone.utc)
    users = fetch_all_users(client)
    conds = client.table("watch_conditions").select("user_id").execute().data or []
    found = client.table("found_items").select("user_id,found_at").execute().data or []
    try:
        subs = client.table("subscriptions").select("user_id,plan,status").execute().data or []
    except Exception:
        subs = []

    lines = [f"差益レーダー ユーザー集計({now.astimezone(JST).strftime('%Y-%m-%d %H:%M')} JST)", ""]
    lines += build_section("全体", users, conds, found, subs, now)
    if exclude:
        external = [u for u in users if (u.email or "").lower() not in exclude]
        lines += [""] + build_section(f"外部ユーザー(除外 {len(users) - len(external)}アカウント)", external, conds, found, subs, now)
        users_for_daily = external
    else:
        users_for_daily = users
    lines += ["", "新規登録(直近14日、日本時間" + ("・外部のみ" if exclude else "") + ")"] + daily_signups(users_for_daily, now)
    return "\n".join(lines)


def send_mail(text: str) -> None:
    import resend

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        sys.exit("RESEND_API_KEY が未設定のため、メールを送れません。")
    resend.api_key = api_key
    resend.Emails.send(
        {
            "from": os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
            "to": [os.environ.get("OPS_ALERT_EMAIL") or ALERT_EMAIL_TO],
            "subject": "【差益レーダー】ユーザー集計",
            "text": text,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="無料プランの利用状況の集計")
    parser.add_argument("--exclude", default=os.environ.get("REPORT_EXCLUDE_EMAILS", ""), help="除外するメールアドレス(カンマ区切り)")
    parser.add_argument("--mail", action="store_true", help="結果をメールで送る")
    args = parser.parse_args()

    client = get_supabase_client()
    if client is None:
        sys.exit("Supabaseの設定がありません。")
    exclude = {e.strip().lower() for e in args.exclude.split(",") if e.strip()}
    report = build_report(client, exclude)
    print(report)
    if args.mail:
        send_mail(report)
        print("\nメールを送りました。")


if __name__ == "__main__":
    main()
