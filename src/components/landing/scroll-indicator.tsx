'use client'

import { useEffect, useState } from 'react'

export function ScrollIndicator({ light = false }: { light?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 2000)

    function onScroll() {
      setVisible(false)
      window.removeEventListener('scroll', onScroll)
    }
    window.addEventListener('scroll', onScroll, { passive: true, once: true })

    return () => {
      clearTimeout(showTimer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div
      className={`mt-16 flex justify-center transition-opacity duration-700 ${
        visible ? 'opacity-60' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      <div
        className={`h-10 w-[2px] ${light ? 'bg-white/60' : 'bg-text-faint'}`}
        style={{
          animation: visible ? 'scroll-hint 2s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  )
}
