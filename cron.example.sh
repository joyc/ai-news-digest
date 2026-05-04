#!/bin/sh
# AI 新闻日报 — cron 配置示例
#
# 每天早上 8:00 自动生成日报
# 使用方法：
#   1. 运行 `crontab -e`，粘贴以下行（替换路径）：
#      0 8 * * * /bin/sh /path/to/ai-news-digest/cron.example.sh >> /path/to/ai-news-digest/logs/cron.log 2>&1
#   2. 如需跳过 Ollama 摘要，在 npx tsx 命令后追加 --no-summary

cd "$(dirname "$0")"
mkdir -p logs
npx tsx src/index.ts
