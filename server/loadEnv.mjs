import fs from 'node:fs'
import path from 'node:path'

function parseEnvFile(content) {
  const entries = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    entries.push([key, value])
  }

  return entries
}

export function loadEnvFiles(rootDir) {
  for (const fileName of ['.env', '.env.server']) {
    const filePath = path.join(rootDir, fileName)
    if (!fs.existsSync(filePath)) {
      continue
    }

    const content = fs.readFileSync(filePath, 'utf8')
    for (const [key, value] of parseEnvFile(content)) {
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  }
}
