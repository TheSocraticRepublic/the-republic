'use client'

import { useMemo, type ReactNode } from 'react'

interface ParsedSection {
  heading: string
  content: string
}

export function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const lines = text.split('\n')
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
      }
      currentHeading = match[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
  }

  return sections
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    nodes.push(<strong key={key++} className="font-semibold">{match[1]}</strong>)
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'subheading'; text: string }

function parseBlocks(content: string): Block[] {
  const result: Block[] = []
  const lines = content.split('\n')
  let listItems: string[] = []

  function flushList() {
    if (listItems.length > 0) {
      result.push({ type: 'list', items: [...listItems] })
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    const subMatch = trimmed.match(/^###\s+(.+)$/)
    if (subMatch) {
      flushList()
      result.push({ type: 'subheading', text: subMatch[1] })
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      listItems.push(bulletMatch[1])
      continue
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (numberedMatch) {
      listItems.push(numberedMatch[1])
      continue
    }

    if (trimmed === '') {
      flushList()
      continue
    }

    flushList()
    const prev = result[result.length - 1]
    if (prev?.type === 'paragraph') {
      prev.text += ' ' + trimmed
    } else {
      result.push({ type: 'paragraph', text: trimmed })
    }
  }

  flushList()
  return result
}

interface MarkdownProseProps {
  content: string
  className?: string
  textColor?: string
}

export function MarkdownProse({ content, className, textColor = '#292524' }: MarkdownProseProps) {
  const blocks = useMemo(() => parseBlocks(content), [content])

  return (
    <div className={className ?? 'space-y-3'}>
      {blocks.map((block, i) => {
        if (block.type === 'subheading') {
          return (
            <p
              key={i}
              className="text-xs font-semibold pt-1"
              style={{ color: '#78716c' }}
            >
              {block.text}
            </p>
          )
        }

        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <span
                    className="mt-[7px] h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#d6d3d1' }}
                  />
                  <span style={{ color: textColor }}>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={i} className="text-sm leading-relaxed" style={{ color: textColor }}>
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}

interface SectionedMarkdownProps {
  text: string
  isStreaming?: boolean
  accentColor?: string
  textColor?: string
}

export function SectionedMarkdown({
  text,
  isStreaming,
  accentColor = '#a8a29e',
  textColor = '#292524',
}: SectionedMarkdownProps) {
  const sections = useMemo(() => parseSections(text), [text])
  const hasSections = sections.length > 0

  if (!hasSections) {
    return (
      <div>
        <MarkdownProse content={text} textColor={textColor} />
        {isStreaming && (
          <span
            className="mt-1 inline-block h-4 w-1 animate-pulse"
            style={{ backgroundColor: accentColor, opacity: 0.6 }}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      {sections.map((section, i) => (
        <div key={i}>
          <h3 className="section-heading">{section.heading}</h3>
          <MarkdownProse content={section.content} textColor={textColor} />
        </div>
      ))}
      {isStreaming && (
        <span
          className="inline-block h-4 w-1 animate-pulse"
          style={{ backgroundColor: accentColor, opacity: 0.6 }}
        />
      )}
    </div>
  )
}
