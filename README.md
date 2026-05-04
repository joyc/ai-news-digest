# AI 新闻日报

每日自动从多个 RSS 源抓取 AI 相关文章，调用本地 Ollama 生成一句话摘要，输出 Markdown 格式日报。

## 功能

- 并发抓取 3 个 RSS 源，过滤最近 24 小时的文章
- 按发布时间倒序排列，自动去重
- 调用本地 Ollama 为每篇文章生成一句话中文摘要
- 输出带日期的 Markdown 日报到 `output/`，同时生成 `output/latest.md`

**数据源：**
- [TechCrunch AI](https://techcrunch.com/category/artificial-intelligence/)
- [The Verge AI](https://www.theverge.com/ai-artificial-intelligence)
- [Hacker News AI](https://hnrss.org/newest?q=AI&count=30)

## 快速开始

**前置条件：** Node.js 18+，[Ollama](https://ollama.com)（生成摘要时需要）

```bash
# 安装依赖
npm install

# 快速运行（跳过 Ollama 摘要）
npx tsx src/index.ts --no-summary

# 完整运行（需先启动 Ollama）
ollama pull llama3.2
ollama serve
npx tsx src/index.ts
```

日报生成在 `output/YYYY-MM-DD.md`。

## CLI 参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--no-summary` | 跳过 Ollama 摘要，快速模式 | 关闭 |
| `--hours <n>` | 抓取最近 n 小时的文章 | 24 |

```bash
npx tsx src/index.ts --no-summary --hours 48
```

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `OLLAMA_MODEL` | 使用的 Ollama 模型 | `llama3.2` |

```bash
OLLAMA_MODEL=qwen2.5:7b npx tsx src/index.ts
```

## 定时运行

参考 `cron.example.sh`，在 `crontab -e` 中添加：

```bash
# 每天早上 8:00 生成日报
0 8 * * * /bin/sh /path/to/ai-news-digest/cron.example.sh >> /path/to/ai-news-digest/logs/cron.log 2>&1
```

## 项目结构

```
src/
  index.ts          # CLI 入口
  pipeline.ts       # 并发抓取、去重、排序
  fetchers/
    rss.ts          # 通用 RSS 解析器
    techcrunch.ts   # TechCrunch AI
    theverge.ts     # The Verge AI
    hackernews.ts   # Hacker News
  summarizer/
    ollama.ts       # Ollama 摘要生成
  writer/
    markdown.ts     # Markdown 输出
output/             # 生成的日报
```

## 开发

```bash
npm test            # 运行测试（18 个单元测试）
npx tsc --noEmit    # 类型检查
```

## 扩展

- **添加 RSS 源**：在 `src/fetchers/` 新增文件，在 `src/pipeline.ts` 注册
- **替换 AI 服务**：仅需修改 `src/summarizer/ollama.ts`
- **Vercel / Telegram**：在 `src/writer/` 添加新的输出格式
