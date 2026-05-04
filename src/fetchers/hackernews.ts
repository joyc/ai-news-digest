import { fetchRSS } from './rss'
import type { Article } from './types'

// points=10 filters to articles with ≥10 upvotes, ensuring quality over quantity
const FEED_URL = 'https://hnrss.org/newest?q=AI&points=10&count=30'

export const fetchHackerNews = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'Hacker News', hoursBack)
