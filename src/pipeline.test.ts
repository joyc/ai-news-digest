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
