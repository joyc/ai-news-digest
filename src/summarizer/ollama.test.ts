import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { summarize } from './ollama'
import type { Article } from '../fetchers/types'

const articleNoDesc: Article = {
  title: 'OpenAI announces GPT-5 with 10x performance improvement',
  url: 'https://example.com/gpt5',
  publishedAt: new Date('2026-05-04T08:00:00Z'),
  source: 'TechCrunch',
}

const articleWithDesc: Article = {
  ...articleNoDesc,
  description: 'OpenAI today unveiled GPT-5, claiming major benchmark improvements over GPT-4.',
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
    const result = await summarize(articleNoDesc)
    expect(result).toBe('OpenAI 发布 GPT-5，性能提升10倍。')
  })

  it('includes description in prompt when available', async () => {
    await summarize(articleWithDesc)
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['prompt']).toContain(articleWithDesc.description)
    expect(body['prompt']).toContain(articleWithDesc.title)
  })

  it('falls back to title-only prompt when description is absent', async () => {
    await summarize(articleNoDesc)
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['prompt']).toContain(articleNoDesc.title)
    expect(body['prompt']).not.toContain('摘要：')
  })

  it('sends stream: false', async () => {
    await summarize(articleNoDesc)
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['stream']).toBe(false)
  })

  it('throws when Ollama returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(summarize(articleNoDesc)).rejects.toThrow('Ollama HTTP 500')
  })
})
