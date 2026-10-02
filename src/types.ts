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
