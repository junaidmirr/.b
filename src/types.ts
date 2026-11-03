export type Theme = 'light' | 'dark'

export type Project = {
  title: string
  category: string
  description: string
  icon?: string
  stack: string[]
  linkLabel: string
  fullDescription: string
  features: string[]
  githubUrl?: string
  liveUrl?: string
  technologies: Array<{
    name: string
    details: string
  }>
}

export type SkillCategory = {
  title: string
  description: string
  skills: string[]
}

export type ProfileData = {
  name: string
  role: string
  headline: string
  bio: string
  location: string
  email: string
  github: string
  linkedin: string
  twitter?: string
}

export type PortfolioData = {
  profile: ProfileData
  categories: string[]
  projects: Project[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export type ChatSession = {
  id: string
  createdAt: string
  updatedAt: string
  summary: string
  messageCount: number
  messages: ChatMessage[]
  browser?: string
  userAgent?: string
}
