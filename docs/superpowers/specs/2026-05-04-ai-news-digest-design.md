# AI 新闻聚合 CLI 工具 — 设计文档

**日期：** 2026-05-04
**状态：** 已确认，待实现

---

## 概述

一个 TypeScript CLI 工具，每日从三个 RSS 源抓取最近 24 小时的 AI 相关文章，调用本地 Ollama 模型为每篇文章生成一句话中文摘要，输出 Markdown 格式日报到 `output/` 目录。前期本地使用，后期作为 Vercel 网站或 Telegram Bot 的数据源。

---

## 架构与文件结构

```
ai-news-digest/
├── src/
│   ├── index.ts              # CLI 入口，解析参数，调用 pipeline
│   ├── pipeline.ts           # 串联 fetch → filter → summarize → write
│   ├── fetchers/
│   │   ├── types.ts          # Article 接口定义
│   │   ├── techcrunch.ts     # TechCrunch AI RSS
│   │   ├── theverge.ts       # The Verge AI RSS
│   │   └── hackernews.ts     # Hacker News RSS
│   ├── summarizer/
│   │   └── ollama.ts         # 调用本地 Ollama，生成一句话摘要
│   └── writer/
│       └── markdown.ts       # 渲染并写入 output/YYYY-MM-DD.md
├── output/                   # 生成的日报
├── package.json
├── tsconfig.json
└── cron.example.sh           # cron 配置示例
```

**核心数据类型：**

```typescript
interface Article {
  title: string
  url: string
  publishedAt: Date
  source: string        // "TechCrunch" | "The Verge" | "Hacker News"
  summary?: string      // Ollama 填充
}
```

---

## 数据流与各层职责

```
index.ts
  └─▶ pipeline.ts
        ├─▶ fetchers/*   并发抓取3个 RSS 源
        │     └─▶ 过滤：publishedAt > now - 24h
        │     └─▶ 去重：按 url 去重
        ├─▶ 按 publishedAt 倒序排列
        ├─▶ summarizer/ollama.ts   逐篇调用 Ollama（可配置跳过）
        └─▶ writer/markdown.ts    写入 output/YYYY-MM-DD.md + output/latest.md
```

| 层 | 输入 | 输出 | 职责 |
|---|---|---|---|
| fetcher | RSS URL | `Article[]` | 抓取、解析、时间过滤 |
| pipeline | — | `Article[]` | 并发协调、去重、排序 |
| summarizer | `Article` | `string` | 调 Ollama，返回摘要 |
| writer | `Article[]` | 文件 | 渲染 Markdown，写磁盘 |

**关键决策：**
- fetcher 并发执行（`Promise.all`），单个源失败不影响其他源
- Ollama 调用串行执行，避免本地模型过载
- 同时输出 `output/latest.md`，方便后续 Vercel/Telegram 读取最新日报

---

## 输出格式

```markdown
# AI 新闻日报 · 2026-05-04

> 共 18 篇文章，来源：TechCrunch · The Verge · Hacker News
> 生成时间：2026-05-04 10:30

---

### [文章标题](https://...)
**来源：** TechCrunch · 2026-05-04 09:15
**摘要：** 一句话中文摘要。
```

---

## 错误处理

| 场景 | 处理方式 |
|---|---|
| RSS 源请求超时/失败 | 跳过该源，打印 `[warn]`，继续处理其他源 |
| 文章发布时间解析失败 | 丢弃该文章，打印警告 |
| Ollama 未启动 / 调用失败 | 跳过摘要（`summary` 留空），不中断整体流程 |
| 24小时内无文章 | 写入日报并注明"暂无新文章" |
| output/ 目录不存在 | 自动创建 |

---

## CLI 参数

```bash
npx tsx src/index.ts              # 正常运行
npx tsx src/index.ts --no-summary # 跳过 Ollama 摘要（快速模式）
npx tsx src/index.ts --hours 48   # 自定义时间窗口（默认24h）
```

---

## 依赖选型

**运行时：**
- `fast-xml-parser` — 解析 RSS XML（零依赖，TypeScript 友好）
- Node 18+ 原生 `fetch` — HTTP 请求，无需 axios
- Ollama REST API（`http://localhost:11434`）— 无需额外 SDK

**开发：**
- `tsx ^4.x`
- `typescript ^5.x`
- `@types/node ^20.x`

---

## Cron 配置

```bash
# 每天早上 8:00 生成日报
0 8 * * * cd /path/to/ai-news-digest && npx tsx src/index.ts >> logs/cron.log 2>&1
```

---

## 扩展路径（本次不实现）

- **Vercel 数据源**：在 `writer/` 加 `json.ts`，输出 `output/latest.json`
- **Telegram Bot**：pipeline 完成后调用 `notifier/telegram.ts`
- **更多 RSS 源**：在 `fetchers/` 新增文件，在 pipeline 中注册即可
- **替换 AI 服务**：仅需替换 `summarizer/ollama.ts`，其他层不受影响

---

## RSS 源

| 来源 | URL |
|---|---|
| TechCrunch AI | `https://techcrunch.com/category/artificial-intelligence/feed/` |
| The Verge AI | `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml` |
| Hacker News | `https://hnrss.org/newest?q=AI&count=30` |
