import { fetchRSS } from './rss'
import type { Article } from './types'

const FEED_URL = 'https://techcrunch.com/category/artificial-intelligence/feed/'

export const fetchTechCrunch = (hoursBack: number): Promise<Article[]> =>
  fetchRSS(FEED_URL, 'TechCrunch', hoursBack)
