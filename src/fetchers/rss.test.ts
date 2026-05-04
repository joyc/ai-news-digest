import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRSS } from './rss'

const RECENT_DATE = new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString()
const RECENT_ISO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
const OLD_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toUTCString()

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Recent AI Article</title>
      <link>https://example.com/recent</link>
      <pubDate>${RECENT_DATE}</pubDate>
      <description>This is the article description with &lt;b&gt;HTML&lt;/b&gt; tags.</description>
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

const ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Recent Article</title>
    <link href="https://example.com/atom-recent"></link>
    <updated>${RECENT_ISO}</updated>
    <summary type="html"><![CDATA[<p>Atom article <b>summary</b> content.</p>]]></summary>
  </entry>
  <entry>
    <title>Atom Old Article</title>
    <link href="https://example.com/atom-old"></link>
    <updated>${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}</updated>
  </entry>
</feed>`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(RSS_XML),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRSS — RSS 2.0', () => {
  it('returns only articles within the time window', async () => {
    const articles = await fetchRSS('https://example.com/feed', 'TestSource', 24)
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('Recent AI Article')
    expect(articles[0].url).toBe('https://example.com/recent')
    expect(articles[0].source).toBe('TestSource')
    expect(articles[0].publishedAt).toBeInstanceOf(Date)
  })

  it('extracts and strips HTML from description', async () => {
    const articles = await fetchRSS('https://example.com/feed', 'TestSource', 24)
    expect(articles[0].description).toBe('This is the article description with HTML tags.')
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

describe('fetchRSS — Atom format', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(ATOM_XML),
    }))
  })

  it('parses Atom entries and filters by time window', async () => {
    const articles = await fetchRSS('https://example.com/atom', 'AtomSource', 24)
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('Atom Recent Article')
    expect(articles[0].url).toBe('https://example.com/atom-recent')
    expect(articles[0].source).toBe('AtomSource')
  })

  it('extracts and strips HTML from Atom summary', async () => {
    const articles = await fetchRSS('https://example.com/atom', 'AtomSource', 24)
    expect(articles[0].description).toBe('Atom article summary content.')
  })
})
