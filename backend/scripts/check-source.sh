#!/usr/bin/env bash
set -euo pipefail

SOURCE_NAME="${1:-股掌柜-7x24聚合消息}"
LOOKBACK_HOURS="${2:-12}"
STATS_URL="${CRAWLER_STATS_URL:-https://invest.791127.xyz/api/crawler/stats}"

if [[ -n "${SINCE:-}" ]]; then
  SINCE_TIME="$SINCE"
else
  if date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
    SINCE_TIME="$(date -u -d "${LOOKBACK_HOURS} hours ago" +"%Y-%m-%dT%H:%M:%SZ")"
  else
    SINCE_TIME="$(python3 - <<PY
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) - timedelta(hours=${LOOKBACK_HOURS})).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
)"
  fi
fi

stats_json="$(curl -sk "$STATS_URL")"
source_json="$(printf '%s\n' "$stats_json" | jq -c --arg source "$SOURCE_NAME" '.stats.sourceDetails[] | select(.name == $source)' | head -n 1)"

if [[ -z "${source_json:-}" ]]; then
  echo "未找到新闻源: ${SOURCE_NAME}" >&2
  exit 1
fi

last_fetch="$(printf '%s\n' "$source_json" | jq -r '.lastFetch')"
last_count="$(printf '%s\n' "$source_json" | jq -r '.lastCount')"
total_count="$(printf '%s\n' "$source_json" | jq -r '.totalCount')"
status="$(printf '%s\n' "$source_json" | jq -r '.status')"

log_block="$(docker logs investment-backend --since "$SINCE_TIME" 2>&1 | grep -A15 -B5 "$SOURCE_NAME" || true)"

api_returned="$(printf '%s\n' "$log_block" | grep -c "API返回" || true)"
parsed_count="$(printf '%s\n' "$log_block" | grep -c "成功解析" || true)"
duplicate_count="$(printf '%s\n' "$log_block" | grep -c "跳过重复新闻" || true)"
no_new_count="$(printf '%s\n' "$log_block" | grep -c "未获取到新新闻" || true)"
timeout_count="$(printf '%s\n' "$log_block" | grep -c "ETIMEDOUT" || true)"
failed_count="$(printf '%s\n' "$log_block" | grep -c "抓取失败" || true)"
saved_count="$(printf '%s\n' "$log_block" | sed -nE 's/.*保存 ([0-9]+) 条.*/\1/p' | awk '{sum += $1} END {print sum + 0}')"

verdict="状态不明确"
if [[ "$timeout_count" -gt 0 && "$api_returned" -eq 0 && "$parsed_count" -eq 0 ]]; then
  verdict="抓取失败：请求层超时"
elif [[ "$saved_count" -gt 0 || "$last_count" -gt 0 ]]; then
  verdict="最近抓到并入库"
elif [[ "$api_returned" -gt 0 || "$parsed_count" -gt 0 ]]; then
  if [[ "$duplicate_count" -gt 0 && "$saved_count" -eq 0 ]]; then
    verdict="最近抓到了原始数据，但被去重了"
  else
    verdict="最近抓到了原始数据，但没有新增入库"
  fi
elif [[ "$no_new_count" -gt 0 ]]; then
  verdict="最近没有解析到新内容"
elif [[ "$last_count" -eq 0 ]]; then
  verdict="任务跑了，但这次没有新增"
fi

echo "source: ${SOURCE_NAME}"
echo "lastFetch: ${last_fetch}"
echo "lastCount: ${last_count}"
echo "totalCount: ${total_count}"
echo "status: ${status}"
echo "logsSince: ${LOOKBACK_HOURS}h"
echo "apiReturned: ${api_returned}"
echo "parsed: ${parsed_count}"
echo "saved: ${saved_count}"
echo "duplicate: ${duplicate_count}"
echo "noNew: ${no_new_count}"
echo "timeout: ${timeout_count}"
echo "failed: ${failed_count}"
echo "verdict: ${verdict}"

echo "--- recent log tail ---"
if [[ -n "${log_block}" ]]; then
  printf '%s\n' "$log_block" | tail -n 20
else
  echo "未找到该源的近期日志块"
fi
