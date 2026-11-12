import type { FC } from 'react'

interface TodoPlaceholderProps {
  label: string
  aspectRatio?: '16/9' | '4/3' | '1/1' | '3/2' | '21/9'
  alt: string
  src?: string
  caption?: string
  className?: string
}

export const TodoPlaceholder: FC<TodoPlaceholderProps> = ({
  label,
  aspectRatio = '16/9',
  alt,
  src,
  caption,
  className = '',
}) => {
  const aspectClass = {
    '16/9': 'aspect-[16/9]',
    '4/3': 'aspect-[4/3]',
    '1/1': 'aspect-square',
    '3/2': 'aspect-[3/2]',
    '21/9': 'aspect-[21/9]',
  }[aspectRatio]

  if (src) {
    return (
      <figure className={`overflow-hidden border border-[var(--color-border)] ${className}`}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`w-full ${aspectClass} object-cover`}
        />
        {caption && (
          <figcaption className="mt-1.5 font-mono text-[11px] text-[var(--color-text-subtle)]">
            {caption}
          </figcaption>
        )}
      </figure>
    )
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex flex-col items-center justify-center border border-dashed border-[var(--color-border)] bg-[var(--color-code-bg)] p-6 text-center ${aspectClass} ${className}`}
    >
      <div className="max-w-[280px] space-y-1">
        <span className="block font-mono text-xs uppercase tracking-wider text-[var(--color-accent)] font-medium">
          TODO Asset
        </span>
        <span className="block font-mono text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          {label}
        </span>
        <span className="block font-mono text-[10px] text-[var(--color-text-subtle)]">
          Ratio: {aspectRatio}
        </span>
      </div>
    </div>
  )
}
