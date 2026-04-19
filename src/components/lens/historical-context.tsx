// HistoricalContext — renders streamed historical context text on a light
// content island matching the briefing view pattern.

interface HistoricalContextProps {
  content: string   // Streaming text (grows as stream progresses)
  isStreaming: boolean
}

function renderInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

function ProseSection({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return null

  return (
    <div className="space-y-4">
      {paragraphs.map((para, i) => {
        if (para.match(/^[-*]\s+/m)) {
          const items = para
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.replace(/^[-*]\s+/, '').trim())
          return (
            <ul key={i} className="space-y-1.5 pl-0">
              {items.map((item, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2"
                  style={{ fontSize: '15px', lineHeight: '1.6', color: '#44403c' }}
                >
                  <span
                    className="mt-2 h-1 w-1 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: '#a8a29e' }}
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p
            key={i}
            className="whitespace-pre-wrap"
            style={{ fontSize: '16px', lineHeight: '1.7', color: '#292524' }}
          >
            {renderInline(para)}
          </p>
        )
      })}
    </div>
  )
}

function parseSections(text: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = []
  const lines = text.split('\n')
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      if (currentHeading || currentLines.some((l) => l.trim())) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
      }
      currentHeading = match[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentHeading || currentLines.some((l) => l.trim())) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
  }

  return sections
}

export function HistoricalContext({ content, isStreaming }: HistoricalContextProps) {
  const sections = parseSections(content)

  return (
    <div
      className="rounded-2xl p-8"
      style={{ backgroundColor: '#f8f6f3' }}
    >
      {/* Section label */}
      <div className="mb-6 flex items-center justify-between">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#a8a29e' }}
        >
          Historical Context
        </p>
        {isStreaming && (
          <span
            className="flex items-center gap-1.5 text-[10px] font-medium"
            style={{ color: '#a8a29e' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#a8a29e' }}
            />
            Building context
          </span>
        )}
      </div>

      {/* Content */}
      {sections.length === 0 && isStreaming ? (
        <div className="space-y-2">
          <div
            className="h-4 w-3/4 rounded animate-pulse"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
          />
          <div
            className="h-4 w-full rounded animate-pulse"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
          />
          <div
            className="h-4 w-5/6 rounded animate-pulse"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section, i) => (
            <div key={i}>
              {section.heading && (
                <h3
                  className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: '#78716c' }}
                >
                  {section.heading}
                </h3>
              )}
              <ProseSection content={section.content} />
            </div>
          ))}
        </div>
      )}

      {/* Streaming tail cursor */}
      {isStreaming && content.length > 0 && (
        <span
          className="inline-block h-4 w-0.5 animate-pulse ml-0.5"
          style={{ backgroundColor: '#a8a29e', verticalAlign: 'text-bottom' }}
        />
      )}
    </div>
  )
}
