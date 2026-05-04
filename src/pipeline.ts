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
