import { fetchTechCrunch } from './fetchers/techcrunch'
import { fetchTheVerge } from './fetchers/theverge'
import { fetchHackerNews } from './fetchers/hackernews'
import { fetchChainFeeds } from './fetchers/chainfeeds'
import type { Article } from './fetchers/types'

const PER_SOURCE_LIMIT = 15
const TITLE_SIMILARITY_THRESHOLD = 0.65

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'be', 'how', 'why',
  'what', 'when', 'who', 'its', 'it', 'as', 'this', 'that', 'has', 'have',
])

function titleWords(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9一-鿿\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w)),
  )
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = titleWords(a)
  const wordsB = titleWords(b)
  if (wordsA.size === 0 && wordsB.size === 0) return 1
  let intersectionSize = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) intersectionSize++
  }
  const unionSize = wordsA.size + wordsB.size - intersectionSize
  return unionSize > 0 ? intersectionSize / unionSize : 0
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    return u.toString().toLowerCase().replace(/\/$/, '')
  } catch {
    return url.toLowerCase()
  }
}

export interface PipelineOptions {
  hoursBack: number
  skipSummary: boolean
}

export async function runPipeline(options: PipelineOptions): Promise<Article[]> {
  const { hoursBack } = options
  const sourceNames = ['TechCrunch', 'The Verge', 'Hacker News', 'ChainFeeds'] as const

  const results = await Promise.allSettled([
    fetchTechCrunch(hoursBack),
    fetchTheVerge(hoursBack),
    fetchHackerNews(hoursBack),
    fetchChainFeeds(hoursBack),
  ])

  const articles: Article[] = []
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value.slice(0, PER_SOURCE_LIMIT))
    } else {
      console.warn(`[warn] ${sourceNames[i]} fetch failed: ${(result.reason as Error).message}`)
    }
  }

  // Pass 1: URL dedup (strip query params and hash)
  const seenUrls = new Set<string>()
  const urlDeduped = articles.filter(a => {
    const normalized = normalizeUrl(a.url)
    if (seenUrls.has(normalized)) return false
    seenUrls.add(normalized)
    return true
  })

  // Pass 2: title similarity dedup — keep first occurrence (highest-priority source)
  const titleDeduped: Article[] = []
  for (const article of urlDeduped) {
    const isDuplicate = titleDeduped.some(
      existing => jaccardSimilarity(existing.title, article.title) >= TITLE_SIMILARITY_THRESHOLD,
    )
    if (!isDuplicate) titleDeduped.push(article)
  }

  return titleDeduped.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}
