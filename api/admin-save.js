import fs from 'node:fs'
import path from 'node:path'
import { verifySessionToken } from './_auth.js'

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  if (typeof req.headers['x-admin-token'] === 'string') {
    return req.headers['x-admin-token'].trim()
  }
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const token = extractBearerToken(req)
  const session = verifySessionToken(token)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized or session expired. Please log in again.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { profile, categories, projects } = body

    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: 'Profile data is required and must be an object.' })
    }

    if (!Array.isArray(projects)) {
      return res.status(400).json({ error: 'Projects must be an array.' })
    }

    const cleanData = {
      profile,
      categories: Array.isArray(categories) ? categories : [],
      projects,
    }

    const jsonString = JSON.stringify(cleanData, null, 2)
    const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT
    const repoOwner = process.env.GITHUB_REPO_OWNER || 'junaidmirr'
    const repoName = process.env.GITHUB_REPO_NAME || '.b'
    const branch = process.env.GITHUB_BRANCH || 'main'
    const targetFilePath = 'src/portfolioData.json'

    let gitCommitted = false
    let gitMessage = ''

    if (githubToken) {
      try {
        const getUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${targetFilePath}?ref=${branch}`
        const getRes = await fetch(getUrl, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Portfolio-Admin-Engine',
          },
        })

        let fileSha = undefined
        if (getRes.ok) {
          const fileData = await getRes.json()
          fileSha = fileData.sha
        }

        const putUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${targetFilePath}`
        const putBody = {
          message: 'Update portfolio content via Admin Panel',
          content: Buffer.from(jsonString).toString('base64'),
          branch,
        }
        if (fileSha) {
          putBody.sha = fileSha
        }

        const putRes = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Portfolio-Admin-Engine',
          },
          body: JSON.stringify(putBody),
        })

        if (!putRes.ok) {
          const errData = await putRes.json()
          throw new Error(errData.message || `GitHub API returned status ${putRes.status}`)
        }

        gitCommitted = true
        gitMessage = 'Committed to GitHub repository. Vercel auto deployment triggered.'
      } catch (err) {
        gitMessage = `GitHub commit error: ${err instanceof Error ? err.message : String(err)}`
      }
    } else {
      gitMessage = 'No GITHUB_TOKEN configured. Set GITHUB_TOKEN in Vercel to auto commit to GitHub.'
    }

    // If running in local environment where disk is writable, update local file directly
    try {
      const localFilePath = path.join(process.cwd(), 'src', 'portfolioData.json')
      if (fs.existsSync(path.dirname(localFilePath))) {
        fs.writeFileSync(localFilePath, jsonString, 'utf8')
      }
    } catch {
      // Ephemeral serverless filesystem ignores write errors
    }

    return res.status(200).json({
      ok: true,
      gitCommitted,
      message: gitCommitted
        ? 'Successfully committed to GitHub repository. Vercel is redeploying your portfolio.'
        : gitMessage,
      data: cleanData,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save portfolio data.'
    return res.status(500).json({ error: message })
  }
}
