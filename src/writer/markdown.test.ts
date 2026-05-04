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
