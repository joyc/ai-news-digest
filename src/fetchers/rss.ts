import { XMLParser } from 'fast-xml-parser'
import type { Article } from './types'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

function extractText(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const text = (value as Record<string, unknown>)['#text']?.toString().trim()
    return text || undefined
  }
  return undefined
}

function extractAtomLink(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const href = (item as Record<string, unknown>)['@_href']?.toString().trim()
      if (href) return href
    }
    return undefined
  }
  if (typeof value === 'object') {
    return (value as Record<string, unknown>)['@_href']?.toString().trim() || undefined
  }
  return undefined
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchRSS(
  url: string,
  source: string,
  hoursBack: number,
): Promise<Article[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const xml = await response.text()
  const parsed = parser.parse(xml) as Record<string, unknown>

  const isAtom = !!parsed?.feed
  let rawItems: unknown[]

  if (isAtom) {
    const feed = parsed.feed as Record<string, unknown>
    const entries = feed?.entry ?? []
    rawItems = Array.isArray(entries) ? entries : [entries]
  } else {
    const channel = (parsed?.rss as Record<string, unknown>)?.channel as Record<string, unknown>
    const items = channel?.item ?? []
    rawItems = Array.isArray(items) ? items : [items]
  }

  const articles: Article[] = []
  for (const raw of rawItems as Record<string, unknown>[]) {
    const title = extractText(raw['title'])
    const itemUrl = isAtom
      ? extractAtomLink(raw['link'])
      : extractText(raw['link'])
    const dateStr = isAtom
      ? (raw['updated']?.toString() ?? raw['published']?.toString())
      : raw['pubDate']?.toString()
    const rawDesc = isAtom
      ? (extractText(raw['summary']) ?? extractText(raw['content']))
      : extractText(raw['description'])

    if (!title || !itemUrl || !dateStr) continue

    const publishedAt = new Date(dateStr)
    if (isNaN(publishedAt.getTime())) continue
    if (publishedAt < cutoff) continue

    const description = rawDesc
      ? stripHtml(rawDesc).slice(0, 500) || undefined
      : undefined

    articles.push({ title, url: itemUrl, publishedAt, source, description })
  }

  return articles
}
