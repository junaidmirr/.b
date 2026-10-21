import defaultPortfolioData from './portfolioData.json'
import type { PortfolioData } from './types'

const STORAGE_KEY = 'junaid_portfolio_override'

export function getPortfolioData(): PortfolioData {
  const fallback = defaultPortfolioData as unknown as PortfolioData

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.projects) && parsed.profile) {
        return {
          profile: {
            ...fallback.profile,
            ...parsed.profile,
          },
          categories: Array.isArray(parsed.categories) ? parsed.categories : fallback.categories,
          projects: parsed.projects,
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse local portfolio data, falling back to bundled data:', err)
  }

  return fallback
}

export function savePortfolioDataLocal(data: PortfolioData): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save portfolio data to local storage:', err)
  }
}

export function resetPortfolioDataLocal(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
