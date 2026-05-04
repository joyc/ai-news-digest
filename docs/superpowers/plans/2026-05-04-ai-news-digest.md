# AI 新闻聚合 CLI 工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 TypeScript CLI 工具，从 3 个 RSS 源抓取 AI 新闻，调用本地 Ollama 生成一句话摘要，输出 Markdown 日报到 `output/`。

**Architecture:** 分层管道：并发 fetcher → pipeline 去重排序 → 串行 Ollama summarizer → Markdown writer。每层有独立接口，可单独测试和替换。

**Tech Stack:** TypeScript 5, tsx 4, fast-xml-parser 4, Vitest 2, Node 18+ 原生 fetch, Ollama REST API (`http://localhost:11434`)

---

## 文件结构

```
ai-news-digest/
├── src/
│   ├── index.ts                    # CLI 入口，参数解析，调用 pipeline
│   ├── pipeline.ts                 # 并发协调、去重、排序
│   ├── fetchers/
│   │   ├── types.ts                # Article 接口
│   │   ├── rss.ts                  # 通用 RSS 解析器（fetchRSS）
│   │   ├── rss.test.ts
│   │   ├── techcrunch.ts           # fetchTechCrunch 包装
│   │   ├── theverge.ts             # fetchTheVerge 包装
│   │   └── hackernews.ts           # fetchHackerNews 包装
│   ├── pipeline.test.ts
│   ├── summarizer/
│   │   ├── ollama.ts               # Ollama REST 调用
│   │   └── ollama.test.ts
│   └── writer/
│       ├── markdown.ts             # renderMarkdown + writeReport
│       └── markdown.test.ts
├── output/                         # 生成的日报（gitignored）
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
└── cron.example.sh
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "ai-news-digest",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fast-xml-parser": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 创建 `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: 创建 `.gitignore`**

```
node_modules/
dist/
output/
logs/
```

- [ ] **Step 5: 安装依赖**

```bash
npm install
```

Expected: `node_modules/` 创建，含 `fast-xml-parser`、`tsx`、`typescript`、`vitest`。

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore package-lock.json
git commit -m "chore: project scaffold"
```

---

## Task 2: Article 类型 + RSS 通用解析器

**Files:**
- Create: `src/fetchers/types.ts`
- Create: `src/fetchers/rss.ts`
- Create: `src/fetchers/rss.test.ts`

- [ ] **Step 1: 写失败测试 `src/fetchers/rss.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRSS } from './rss'

const RECENT_DATE = new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString()
const OLD_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toUTCString()

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Recent AI Article</title>
      <link>https://example.com/recent</link>
      <pubDate>${RECENT_DATE}</pubDate>
    </item>
    <item>
      <title>Old Article</title>
      <link>https://example.com/old</link>
      <pubDate>${OLD_DATE}</pubDate>
    </item>
    <item>
      <title>Missing pubDate</title>
      <link>https://example.com/nodate</link>
    </item>
  </channel>
</rss>`

const SINGLE_ITEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Only Article</title>
      <link>https://example.com/only</link>
      <pubDate>${RECENT_DATE}</pubDate>
    </item>
  </channel>
</rss>`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(SAMPLE_XML),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRSS', () => {
  it('returns only articles within the time window', async () => {
    const articles = await fetchRSS('https://example.com/feed', 'TestSource', 24)
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('Recent AI Article')
    expect(articles[0].url).toBe('https://example.com/recent')
    expect(articles[0].source).toBe('TestSource')
    expect(articles[0].publishedAt).toBeInstanceOf(Date)
  })

  it('throws when fetch returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(fetchRSS('https://example.com/feed', 'TestSource', 24))
      .rejects.toThrow('HTTP 503')
  })

  it('handles single item (non-array) in XML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SINGLE_ITEM_XML),
    }))
    const articles = await fetchRSS('https://example.com/feed', 'TestSource', 24)
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('Only Article')
  })

  it('skips items missing required fields', async () => {
    const articles = await fetchRSS('https://example.com/feed', 'TestSource', 24)
    const urls = articles.map(a => a.url)
    expect(urls).not.toContain('https://example.com/nodate')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/fetchers/rss.test.ts
```

Expected: FAIL — `Cannot find module './rss'`

- [ ] **Step 3: 创建 `src/fetchers/types.ts`**

```typescript
export interface Article {
  title: string
  url: string
  publishedAt: Date
  source: string
  summary?: string
}
```

- [ ] **Step 4: 创建 `src/fetchers/rss.ts`**

```typescript
import { XMLParser } from 'fast-xml-parser'
import type { Article } from './types'

const parser = new XMLParser({ ignoreAttributes: false })

export async function fetchRSS(
  url: string,
  source: string,
  hoursBack: number,
): Promise<Article[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const xml = await response.text()
  const parsed = parser.parse(xml) as Record<string, unknown>
  const channel = (parsed?.rss as Record<string, unknown>)?.channel as Record<string, unknown>
  const rawItems = channel?.item ?? []
  const items = Array.isArray(rawItems) ? rawItems : [rawItems]

  const articles: Article[] = []
  for (const item of items as Record<string, unknown>[]) {
    const title = item['title']?.toString().trim()
    const itemUrl = item['link']?.toString().trim()
    const pubDateStr = item['pubDate']?.toString()

    if (!title || !itemUrl || !pubDateStr) continue

    const publishedAt = new Date(pubDateStr)
    if (isNaN(publishedAt.getTime())) continue
    if (publishedAt < cutoff) continue

    articles.push({ title, url: itemUrl, publishedAt, source })
  }

  return articles
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/fetchers/rss.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/fetchers/types.ts src/fetchers/rss.ts src/fetchers/rss.test.ts
git commit -m "feat: Article type and RSS parser"
```

---

## Task 3: 三个 Fetcher 入口文件

**Files:**
- Create: `src/fetchers/techcrunch.ts`
- Create: `src/fetchers/theverge.ts`
- Create: `src/fetchers/hackernews.ts`

这三个文件是纯 URL 常量 + 委托调用，rss.ts 的测试已覆盖核心逻辑，无需重复测试。

- [ ] **Step 1: 创建 `src/fetchers/techcrunch.ts`**

```typescript
import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://techcrunch.com/category/artificial-intelligence/feed/'

export const fetchTechCrunch = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'TechCrunch', hoursBack)
```

- [ ] **Step 2: 创建 `src/fetchers/theverge.ts`**

```typescript
import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'

export const fetchTheVerge = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'The Verge', hoursBack)
```

- [ ] **Step 3: 创建 `src/fetchers/hackernews.ts`**

```typescript
import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://hnrss.org/newest?q=AI&count=30'

export const fetchHackerNews = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'Hacker News', hoursBack)
```

- [ ] **Step 4: Commit**

```bash
git add src/fetchers/techcrunch.ts src/fetchers/theverge.ts src/fetchers/hackernews.ts
git commit -m "feat: TechCrunch, The Verge, Hacker News fetchers"
```

---

## Task 4: Pipeline（去重 + 排序 + 并发）

**Files:**
- Create: `src/pipeline.ts`
- Create: `src/pipeline.test.ts`

- [ ] **Step 1: 写失败测试 `src/pipeline.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPipeline } from './pipeline'
import { fetchTechCrunch } from './fetchers/techcrunch'
import { fetchTheVerge } from './fetchers/theverge'
import { fetchHackerNews } from './fetchers/hackernews'
import type { Article } from './fetchers/types'

vi.mock('./fetchers/techcrunch')
vi.mock('./fetchers/theverge')
vi.mock('./fetchers/hackernews')

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  title: 'Test Article',
  url: 'https://example.com/1',
  publishedAt: new Date('2026-05-04T08:00:00Z'),
  source: 'TechCrunch',
  ...overrides,
})

beforeEach(() => {
  vi.mocked(fetchTechCrunch).mockResolvedValue([])
  vi.mocked(fetchTheVerge).mockResolvedValue([])
  vi.mocked(fetchHackerNews).mockResolvedValue([])
})

describe('runPipeline', () => {
  it('merges and sorts articles by publishedAt descending', async () => {
    const newer = makeArticle({
      url: 'https://example.com/newer',
      publishedAt: new Date('2026-05-04T09:00:00Z'),
      source: 'The Verge',
    })
    const older = makeArticle({
      url: 'https://example.com/older',
      publishedAt: new Date('2026-05-04T07:00:00Z'),
    })
    vi.mocked(fetchTechCrunch).mockResolvedValue([older])
    vi.mocked(fetchTheVerge).mockResolvedValue([newer])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result[0].url).toBe('https://example.com/newer')
    expect(result[1].url).toBe('https://example.com/older')
  })

  it('deduplicates articles by url', async () => {
    const a = makeArticle({ url: 'https://example.com/same' })
    const b = makeArticle({ url: 'https://example.com/same', source: 'Hacker News' })
    vi.mocked(fetchTechCrunch).mockResolvedValue([a])
    vi.mocked(fetchHackerNews).mockResolvedValue([b])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result).toHaveLength(1)
  })

  it('continues and returns other sources when one source fails', async () => {
    vi.mocked(fetchTechCrunch).mockRejectedValue(new Error('timeout'))
    vi.mocked(fetchTheVerge).mockResolvedValue([
      makeArticle({ url: 'https://example.com/verge', source: 'The Verge' }),
    ])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('The Verge')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/pipeline.test.ts
```

Expected: FAIL — `Cannot find module './pipeline'`

- [ ] **Step 3: 创建 `src/pipeline.ts`**

```typescript
import { fetchTechCrunch } from './fetchers/techcrunch'
import { fetchTheVerge } from './fetchers/theverge'
import { fetchHackerNews } from './fetchers/hackernews'
import type { Article } from './fetchers/types'

export interface PipelineOptions {
  hoursBack: number
  skipSummary: boolean
}

export async function runPipeline(options: PipelineOptions): Promise<Article[]> {
  const { hoursBack } = options
  const sourceNames = ['TechCrunch', 'The Verge', 'Hacker News'] as const

  const results = await Promise.allSettled([
    fetchTechCrunch(hoursBack),
    fetchTheVerge(hoursBack),
    fetchHackerNews(hoursBack),
  ])

  const articles: Article[] = []
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    } else {
      console.warn(`[warn] ${sourceNames[i]} fetch failed: ${(result.reason as Error).message}`)
    }
  }

  const seen = new Set<string>()
  const deduped = articles.filter(a => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  return deduped.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/pipeline.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.ts src/pipeline.test.ts
git commit -m "feat: pipeline with dedup and sort"
```

---

## Task 5: Ollama Summarizer

**Files:**
- Create: `src/summarizer/ollama.ts`
- Create: `src/summarizer/ollama.test.ts`

- [ ] **Step 1: 写失败测试 `src/summarizer/ollama.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { summarize } from './ollama'
import type { Article } from '../fetchers/types'

const article: Article = {
  title: 'OpenAI announces GPT-5 with 10x performance improvement',
  url: 'https://example.com/gpt5',
  publishedAt: new Date('2026-05-04T08:00:00Z'),
  source: 'TechCrunch',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ response: '  OpenAI 发布 GPT-5，性能提升10倍。  ' }),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('summarize', () => {
  it('returns trimmed summary string from Ollama response', async () => {
    const result = await summarize(article)
    expect(result).toBe('OpenAI 发布 GPT-5，性能提升10倍。')
  })

  it('sends title in prompt body with stream: false', async () => {
    await summarize(article)
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['prompt']).toContain(article.title)
    expect(body['stream']).toBe(false)
  })

  it('throws when Ollama returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(summarize(article)).rejects.toThrow('Ollama HTTP 500')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/summarizer/ollama.test.ts
```

Expected: FAIL — `Cannot find module './ollama'`

- [ ] **Step 3: 创建 `src/summarizer/ollama.ts`**

```typescript
import type { Article } from '../fetchers/types'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

export async function summarize(article: Article): Promise<string> {
  const prompt = `请用一句话（50字以内）总结以下新闻标题的核心内容，用中文回答：\n\n${article.title}`

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)

  const data = await response.json() as { response: string }
  return data.response.trim()
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/summarizer/ollama.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/summarizer/ollama.ts src/summarizer/ollama.test.ts
git commit -m "feat: Ollama summarizer"
```

---

## Task 6: Markdown Writer

**Files:**
- Create: `src/writer/markdown.ts`
- Create: `src/writer/markdown.test.ts`

- [ ] **Step 1: 写失败测试 `src/writer/markdown.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { renderMarkdown, writeReport } from './markdown'
import type { Article } from '../fetchers/types'

const articles: Article[] = [
  {
    title: 'GPT-5 Released',
    url: 'https://example.com/gpt5',
    publishedAt: new Date('2026-05-04T09:00:00Z'),
    source: 'TechCrunch',
    summary: 'OpenAI 发布 GPT-5。',
  },
  {
    title: 'Google Gemini Update',
    url: 'https://example.com/gemini',
    publishedAt: new Date('2026-05-04T07:00:00Z'),
    source: 'The Verge',
  },
]

const generatedAt = new Date('2026-05-04T10:00:00Z')

describe('renderMarkdown', () => {
  it('contains date header', () => {
    const md = renderMarkdown(articles, generatedAt)
    expect(md).toContain('# AI 新闻日报 · 2026-05-04')
  })

  it('contains article count', () => {
    const md = renderMarkdown(articles, generatedAt)
    expect(md).toContain('共 2 篇文章')
  })

  it('renders summary when present', () => {
    const md = renderMarkdown(articles, generatedAt)
    expect(md).toContain('**摘要：** OpenAI 发布 GPT-5。')
  })

  it('omits summary line when absent', () => {
    const md = renderMarkdown([articles[1]], generatedAt)
    expect(md).not.toContain('**摘要：**')
  })

  it('shows "暂无新文章" when articles array is empty', () => {
    const md = renderMarkdown([], generatedAt)
    expect(md).toContain('暂无新文章')
  })

  it('contains article link and source', () => {
    const md = renderMarkdown(articles, generatedAt)
    expect(md).toContain('[GPT-5 Released](https://example.com/gpt5)')
    expect(md).toContain('**来源：** TechCrunch')
  })
})

describe('writeReport', () => {
  it('writes dated file and latest.md to outputDir', async () => {
    const outDir = join(tmpdir(), `digest-test-${Date.now()}`)
    const dated = await writeReport(articles, outDir)

    expect(dated).toMatch(/\d{4}-\d{2}-\d{2}\.md$/)

    const datedContent = await readFile(dated, 'utf-8')
    expect(datedContent).toContain('# AI 新闻日报')

    const latestContent = await readFile(join(outDir, 'latest.md'), 'utf-8')
    expect(latestContent).toContain('# AI 新闻日报')
  })

  it('creates outputDir if it does not exist', async () => {
    const outDir = join(tmpdir(), `digest-test-new-${Date.now()}`)
    await expect(writeReport(articles, outDir)).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/writer/markdown.test.ts
```

Expected: FAIL — `Cannot find module './markdown'`

- [ ] **Step 3: 创建 `src/writer/markdown.ts`**

```typescript
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Article } from '../fetchers/types'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function toDateTimeStr(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

export function renderMarkdown(articles: Article[], generatedAt: Date): string {
  const dateStr = toDateStr(generatedAt)
  const timeStr = toDateTimeStr(generatedAt)
  const sources = [...new Set(articles.map(a => a.source))].join(' · ')

  const header = [
    `# AI 新闻日报 · ${dateStr}`,
    '',
    `> 共 ${articles.length} 篇文章，来源：${sources || '无'}`,
    `> 生成时间：${timeStr}`,
    '',
    '---',
    '',
  ].join('\n')

  if (articles.length === 0) {
    return header + '暂无新文章。\n'
  }

  const items = articles.map(a => {
    const lines = [
      `### [${a.title}](${a.url})`,
      `**来源：** ${a.source} · ${toDateTimeStr(a.publishedAt)}`,
    ]
    if (a.summary) lines.push(`**摘要：** ${a.summary}`)
    lines.push('')
    return lines.join('\n')
  })

  return header + items.join('---\n\n')
}

export async function writeReport(articles: Article[], outputDir: string): Promise<string> {
  await mkdir(outputDir, { recursive: true })

  const now = new Date()
  const content = renderMarkdown(articles, now)
  const dated = join(outputDir, `${toDateStr(now)}.md`)
  const latest = join(outputDir, 'latest.md')

  await Promise.all([
    writeFile(dated, content, 'utf-8'),
    writeFile(latest, content, 'utf-8'),
  ])

  return dated
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/writer/markdown.test.ts
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/writer/markdown.ts src/writer/markdown.test.ts
git commit -m "feat: Markdown writer"
```

---

## Task 7: CLI 入口 + Cron 示例

**Files:**
- Create: `src/index.ts`
- Create: `cron.example.sh`

- [ ] **Step 1: 创建 `src/index.ts`**

```typescript
import { runPipeline } from './pipeline'
import { summarize } from './summarizer/ollama'
import { writeReport } from './writer/markdown'
import { join } from 'node:path'

const args = process.argv.slice(2)
const skipSummary = args.includes('--no-summary')
const hoursIndex = args.indexOf('--hours')
const hoursBack = hoursIndex !== -1
  ? Math.max(1, parseInt(args[hoursIndex + 1], 10) || 24)
  : 24

async function main(): Promise<void> {
  console.log(`[info] Fetching articles from last ${hoursBack} hour(s)...`)

  const articles = await runPipeline({ hoursBack, skipSummary })
  console.log(`[info] Found ${articles.length} articles`)

  if (!skipSummary && articles.length > 0) {
    console.log('[info] Generating summaries with Ollama (this may take a while)...')
    for (const article of articles) {
      try {
        article.summary = await summarize(article)
        process.stdout.write('.')
      } catch {
        // Ollama unavailable or timed out — skip summary silently
      }
    }
    console.log()
  }

  const outputDir = join(process.cwd(), 'output')
  const reportPath = await writeReport(articles, outputDir)
  console.log(`[info] Report written to ${reportPath}`)
}

main().catch(e => {
  console.error('[error]', (e as Error).message)
  process.exit(1)
})
```

- [ ] **Step 2: 创建 `cron.example.sh`**

```bash
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
```

- [ ] **Step 3: TypeScript 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无输出（无类型错误）

- [ ] **Step 4: Commit**

```bash
git add src/index.ts cron.example.sh
git commit -m "feat: CLI entry point and cron example"
```

---

## Task 8: 全量测试 + 冒烟测试

- [ ] **Step 1: 运行全量测试套件**

```bash
npx vitest run
```

Expected: 全部通过（rss.test.ts × 4, pipeline.test.ts × 3, ollama.test.ts × 3, markdown.test.ts × 7）= 17 tests

- [ ] **Step 2: 冒烟测试（需要网络，跳过 Ollama）**

```bash
npx tsx src/index.ts --no-summary
```

Expected 输出：
```
[info] Fetching articles from last 24 hour(s)...
[info] Found N articles
[info] Report written to /path/to/output/2026-05-04.md
```

- [ ] **Step 3: 验证输出文件**

```bash
ls output/
```

Expected: `2026-05-04.md` 和 `latest.md`

- [ ] **Step 4: 检查日报内容**

```bash
head -15 output/latest.md
```

Expected: 以 `# AI 新闻日报 ·` 开头，含文章数量和至少一条文章标题。

- [ ] **Step 5: 测试 `--hours` 参数**

```bash
npx tsx src/index.ts --no-summary --hours 48
```

Expected:
```
[info] Fetching articles from last 48 hour(s)...
```

- [ ] **Step 6: 最终 Commit**

```bash
git add .
git commit -m "feat: complete AI news digest CLI"
```

---

## 环境变量参考

| 变量 | 默认值 | 说明 |
|---|---|---|
| `OLLAMA_MODEL` | `llama3.2` | 使用的 Ollama 模型名，可改为 `qwen2.5:7b` 等 |

## 运行前提

- Node 18+（`node --version` 确认）
- 运行摘要功能时需启动 Ollama：`ollama serve`，并拉取模型：`ollama pull llama3.2`
