import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'

export const fetchTheVerge = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'The Verge', hoursBack)
