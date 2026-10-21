import defaultPortfolioData from './portfolioData.json'
import type { PortfolioData } from './types'

const STORAGE_KEY = 'junaid_portfolio_override'

export function getPortfolioData(): PortfolioData {
  if (typeof window === 'undefined') {
    return defaultPortfolioData as PortfolioData
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && parsed.projects && parsed.profile) {
        return parsed as PortfolioData
      }
    }
  } catch (err) {
    console.warn('Failed to parse local portfolio data, falling back to bundled data:', err)
  }

  return defaultPortfolioData as PortfolioData
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
