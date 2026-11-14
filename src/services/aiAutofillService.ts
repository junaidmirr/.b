import type { Project } from '../types'

export type AutofillResult = {
  success: boolean
  project: Project
  metadata?: {
    owner: string
    repo: string
    readmeLength: number
  }
}

/**
 * Calls the serverless /api/ai-project-autofill endpoint to fetch a GitHub repo's README
 * and invoke Swirl AI to analyze the architecture and generate project details.
 */
export async function generateProjectFromGithub(
  repoUrl: string,
  customInstructions?: string,
  readmeContent?: string,
  authToken?: string
): Promise<AutofillResult> {
  const trimmedUrl = repoUrl.trim()
  if (!trimmedUrl && !readmeContent) {
    throw new Error('Please enter a GitHub repository URL or paste README text.')
  }

  const token = authToken || (typeof window !== 'undefined' ? window.localStorage?.getItem('junaid_admin_token') : '')

  const response = await fetch('/api/ai-project-autofill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      repoUrl: trimmedUrl,
      customInstructions: customInstructions?.trim(),
      readmeContent: readmeContent?.trim(),
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Failed to generate project details (Status: ${response.status})`)
  }

  return data
}
