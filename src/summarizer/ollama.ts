import type { Article } from '../fetchers/types'

const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = process.env.OLLAMA_MODEL ?? 'gpt-oss:20b'

export async function summarize(article: Article): Promise<string> {
  const context = article.description
    ? `标题：${article.title}\n摘要：${article.description}`
    : `标题：${article.title}`

  const prompt = `请用100字左右总结以下新闻的核心内容，用中文回答，不要重复标题：\n\n${context}`

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
