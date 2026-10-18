#!/bin/bash
# 毎朝のlaunchdから呼ばれる実行用スクリプト。結果は logs/daily.log に追記する。
#   1) main.py        : products.csv の商品を取得 → Supabase(price_history)保存 → メール通知
#   2) update_prices.py: ダッシュボード登録商品(monitored_products)の価格・純利益を更新
#   3) scout.py        : 登録された条件(watch_conditions)でメルカリ・ヤフオクを検索 → Amazon照合 → found_items保存 → まとめメール
#   4) user_report.py  : 毎週月曜だけ、ユーザー集計(登録数・利用状況・有料契約)を、メールで送る
cd "$(dirname "$0")" || exit 1
mkdir -p logs
PY=/opt/homebrew/bin/python3.9

echo "=== $(date '+%Y-%m-%d %H:%M:%S') start main.py ===" >> logs/daily.log
$PY -u main.py >> logs/daily.log 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') end main.py (exit $?) ===" >> logs/daily.log

echo "=== $(date '+%Y-%m-%d %H:%M:%S') start update_prices.py ===" >> logs/daily.log
$PY -u update_prices.py >> logs/daily.log 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') end update_prices.py (exit $?) ===" >> logs/daily.log

echo "=== $(date '+%Y-%m-%d %H:%M:%S') start scout.py ===" >> logs/daily.log
$PY -u scout.py >> logs/daily.log 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') end scout.py (exit $?) ===" >> logs/daily.log

# 毎週月曜(date +%u が 1)だけ、ユーザー集計をメールで送る。除外するアカウントは .env の REPORT_EXCLUDE_EMAILS で指定する。
if [ "$(date +%u)" = "1" ]; then
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') start user_report.py ===" >> logs/daily.log
  $PY -u user_report.py --mail >> logs/daily.log 2>&1
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') end user_report.py (exit $?) ===" >> logs/daily.log
fi
