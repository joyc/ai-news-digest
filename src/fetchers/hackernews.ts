import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://hnrss.org/newest?q=AI&count=30'

export const fetchHackerNews = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'Hacker News', hoursBack)
