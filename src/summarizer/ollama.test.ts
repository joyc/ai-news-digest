import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { summarize } from './ollama'
import type { Article } from '../fetchers/types'

const article: Article = {
  title: 'OpenAI announces GPT-5 with 10x performance improvement',
  url: 'https://example.com/gpt5',
  publishedAt: new Date('2026-05-04T08:00:00Z'),
  source: 'TechCrunch',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ response: '  OpenAI 发布 GPT-5，性能提升10倍。  ' }),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('summarize', () => {
  it('returns trimmed summary string from Ollama response', async () => {
    const result = await summarize(article)
    expect(result).toBe('OpenAI 发布 GPT-5，性能提升10倍。')
  })

  it('sends title in prompt body with stream: false', async () => {
    await summarize(article)
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['prompt']).toContain(article.title)
    expect(body['stream']).toBe(false)
  })

  it('throws when Ollama returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(summarize(article)).rejects.toThrow('Ollama HTTP 500')
  })
})
