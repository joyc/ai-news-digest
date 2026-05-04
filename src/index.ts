import { runPipeline } from './pipeline'
import { summarize } from './summarizer/ollama'
import { writeReport } from './writer/markdown'
import { join } from 'node:path'

const args = process.argv.slice(2)
const skipSummary = args.includes('--no-summary')
const hoursIndex = args.indexOf('--hours')
const hoursBack = hoursIndex !== -1
  ? Math.max(1, parseInt(args[hoursIndex + 1], 10) || 24)
  : 24

async function main(): Promise<void> {
  console.log(`[info] Fetching articles from last ${hoursBack} hour(s)...`)

  const articles = await runPipeline({ hoursBack, skipSummary })
  console.log(`[info] Found ${articles.length} articles`)

  if (!skipSummary && articles.length > 0) {
    console.log('[info] Generating summaries with Ollama (this may take a while)...')
    for (const article of articles) {
      try {
        article.summary = await summarize(article)
        process.stdout.write('.')
      } catch {
        // Ollama unavailable or timed out — skip summary silently
      }
    }
    console.log()
  }

  const outputDir = join(process.cwd(), 'output')
  const reportPath = await writeReport(articles, outputDir)
  console.log(`[info] Report written to ${reportPath}`)
}

main().catch(e => {
  console.error('[error]', (e as Error).message)
  process.exit(1)
})
