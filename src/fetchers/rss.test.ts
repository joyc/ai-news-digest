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
