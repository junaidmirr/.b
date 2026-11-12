/**
 * Design Tokens for Junaid Mir Portfolio
 * Single source of truth for the "Technical Journal" editorial design direction.
 */

export const designTokens = {
  colors: {
    light: {
      bg: '#FAF9F6',
      surface: '#FFFFFF',
      text: '#161616',
      textMuted: '#575757',
      textSubtle: '#767676',
      border: '#E5E3DD',
      borderHover: '#C4C1B8',
      accent: '#D8431F',
      accentHover: '#B73415',
      codeBg: '#F2EFEB',
    },
    dark: {
      bg: '#0E0E0F',
      surface: '#141416',
      text: '#EDEDED',
      textMuted: '#A1A1A1',
      textSubtle: '#707070',
      border: '#232326',
      borderHover: '#38383C',
      accent: '#FF5C35',
      accentHover: '#FF7654',
      codeBg: '#18181B',
    },
  },
  typography: {
    fontFamilies: {
      display: '"Newsreader", Georgia, Cambria, "Times New Roman", serif',
      body: '"Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"JetBrains Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
    },
    scale: {
      hero: 'clamp(2.75rem, 5.5vw, 4.25rem)', // 44px - 68px
      h2: 'clamp(1.75rem, 3.2vw, 2rem)', // 28px - 32px
      h3: '1.25rem', // 20px
      body: '1.0625rem', // 17px
      bodyLineHeight: '1.6',
      small: '0.875rem', // 14px
      monoMeta: '0.8125rem', // 13px
    },
  },
  spacing: {
    sectionGap: 'clamp(4.5rem, 8vw, 7rem)',
    proseMaxWidth: '720px',
    showcaseMaxWidth: '1040px',
  },
  radii: {
    none: '0px',
    subtle: '4px',
    tag: '6px',
    pill: '9999px', // Nav toggle only
  },
  transitions: {
    standard: '180ms ease',
  },
} as const

export type DesignTokens = typeof designTokens
