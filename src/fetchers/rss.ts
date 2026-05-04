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
