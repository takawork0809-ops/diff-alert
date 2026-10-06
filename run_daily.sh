#!/bin/bash
# 毎朝のlaunchdから呼ばれる実行用スクリプト。結果は logs/daily.log に追記する。
cd "$(dirname "$0")" || exit 1
mkdir -p logs
echo "=== $(date '+%Y-%m-%d %H:%M:%S') start ===" >> logs/daily.log
/opt/homebrew/bin/python3.9 -u main.py >> logs/daily.log 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') end (exit $?) ===" >> logs/daily.log
