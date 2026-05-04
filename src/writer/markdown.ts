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
