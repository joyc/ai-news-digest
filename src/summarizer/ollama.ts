import type { Article } from '../fetchers/types'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

export async function summarize(article: Article): Promise<string> {
  const prompt = `请用一句话（50字以内）总结以下新闻标题的核心内容，用中文回答：\n\n${article.title}`

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)

  const data = await response.json() as { response: string }
  return data.response.trim()
}
