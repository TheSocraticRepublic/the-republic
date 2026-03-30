'use client'

import { useRef, useCallback, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { clsx } from 'clsx'

interface ChatInputProps {
  onSubmit: (content: string) => void
  disabled?: boolean
  value: string
  onChange: (value: string) => void
}

export function ChatInput({ onSubmit, disabled = false, value, onChange }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    onChange('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSubmit, onChange])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      // Auto-resize
      e.target.style.height = 'auto'
      e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
    },
    [onChange]
  )

  const canSubmit = value.trim().length > 0 && !disabled

  return (
    <div className="flex items-end gap-3 rounded-xl border border-white/[0.1] bg-black/60 backdrop-blur-md p-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={disabled ? 'Waiting for response...' : 'Share your thoughts... (Cmd+Enter to send)'}
        className={clsx(
          'flex-1 resize-none bg-transparent text-sm leading-relaxed text-neutral-200 placeholder-neutral-600 outline-none',
          'min-h-[24px] max-h-[200px]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={clsx(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150',
          canSubmit
            ? 'bg-[#C8A84B]/20 text-[#C8A84B] hover:bg-[#C8A84B]/30'
            : 'bg-white/[0.04] text-neutral-600 cursor-not-allowed'
        )}
        aria-label="Send message"
      >
        <Send size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}
