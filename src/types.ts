export type Theme = 'light' | 'vanilla' | 'rose' | 'butterscotch' | 'dark'

export type Project = {
  title: string
  category: string
  description: string
  outcome?: string
  icon?: string
  imageUrl?: string
  bannerUrl?: string
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
  heroSubtext?: string
  bio: string
  location: string
  focus?: string
  exploring?: string
  email: string
  github: string
  linkedin: string
  twitter?: string
  resumeUrl?: string
  avatarUrl?: string
  ogImageUrl?: string
}

export type EssayComment = {
  id: string
  essayId: string
  authorName: string
  content: string
  createdAt: string
}

export type EssayInteraction = {
  essayId: string
  views: number
  likes: number
  comments: EssayComment[]
}

export type Essay = {
  id: string
  title: string
  slug: string
  date: string
  readingTime: string
  category: string
  excerpt: string
  content: string
  coverImage?: string
  externalLink?: string
  externalLinkLabel?: string
}

export type PortfolioData = {
  profile: ProfileData
  categories: string[]
  projects: Project[]
  skills?: Array<{ category: string; items: string }>
  essays?: Essay[]
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
