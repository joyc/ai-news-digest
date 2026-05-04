import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPipeline } from './pipeline'
import { fetchTechCrunch } from './fetchers/techcrunch'
import { fetchTheVerge } from './fetchers/theverge'
import { fetchHackerNews } from './fetchers/hackernews'
import { fetchChainFeeds } from './fetchers/chainfeeds'
import type { Article } from './fetchers/types'

vi.mock('./fetchers/techcrunch')
vi.mock('./fetchers/theverge')
vi.mock('./fetchers/hackernews')
vi.mock('./fetchers/chainfeeds')

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  title: 'Test Article About Artificial Intelligence',
  url: 'https://example.com/1',
  publishedAt: new Date('2026-05-04T08:00:00Z'),
  source: 'TechCrunch',
  ...overrides,
})

beforeEach(() => {
  vi.mocked(fetchTechCrunch).mockResolvedValue([])
  vi.mocked(fetchTheVerge).mockResolvedValue([])
  vi.mocked(fetchHackerNews).mockResolvedValue([])
  vi.mocked(fetchChainFeeds).mockResolvedValue([])
})

describe('runPipeline', () => {
  it('merges and sorts articles by publishedAt descending', async () => {
    const newer = makeArticle({
      url: 'https://example.com/newer',
      title: 'Google Releases New AI Model Today',
      publishedAt: new Date('2026-05-04T09:00:00Z'),
      source: 'The Verge',
    })
    const older = makeArticle({
      url: 'https://example.com/older',
      title: 'OpenAI Announces GPT Five Release',
      publishedAt: new Date('2026-05-04T07:00:00Z'),
    })
    vi.mocked(fetchTechCrunch).mockResolvedValue([older])
    vi.mocked(fetchTheVerge).mockResolvedValue([newer])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result[0].url).toBe('https://example.com/newer')
    expect(result[1].url).toBe('https://example.com/older')
  })

  it('deduplicates articles by normalized url (strips query params)', async () => {
    const a = makeArticle({ url: 'https://example.com/article?utm_source=tc' })
    const b = makeArticle({ url: 'https://example.com/article?utm_source=hn', source: 'Hacker News' })
    vi.mocked(fetchTechCrunch).mockResolvedValue([a])
    vi.mocked(fetchHackerNews).mockResolvedValue([b])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result).toHaveLength(1)
  })

  it('deduplicates articles with similar titles (Jaccard >= 0.65)', async () => {
    const a = makeArticle({
      url: 'https://tc.com/openai-gpt5',
      title: 'OpenAI Releases GPT Five With New Features',
    })
    const b = makeArticle({
      url: 'https://hn.com/item?id=123',
      title: 'OpenAI Releases GPT Five With New Features',
      source: 'Hacker News',
    })
    vi.mocked(fetchTechCrunch).mockResolvedValue([a])
    vi.mocked(fetchHackerNews).mockResolvedValue([b])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('TechCrunch')
  })

  it('keeps articles with clearly different titles', async () => {
    const a = makeArticle({ url: 'https://example.com/a', title: 'OpenAI Launches New Model' })
    const b = makeArticle({ url: 'https://example.com/b', title: 'Google DeepMind Research Breakthrough', source: 'The Verge' })
    vi.mocked(fetchTechCrunch).mockResolvedValue([a])
    vi.mocked(fetchTheVerge).mockResolvedValue([b])

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result).toHaveLength(2)
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

  it('caps each source at PER_SOURCE_LIMIT articles', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeArticle({ url: `https://example.com/${i}`, title: `Unique Article Number ${i} About Tech` }),
    )
    vi.mocked(fetchHackerNews).mockResolvedValue(many)

    const result = await runPipeline({ hoursBack: 24, skipSummary: false })
    expect(result.length).toBeLessThanOrEqual(15)
  })
})
