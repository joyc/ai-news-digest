import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://www.chainfeeds.me/rss'

export const fetchChainFeeds = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'ChainFeeds', hoursBack)
