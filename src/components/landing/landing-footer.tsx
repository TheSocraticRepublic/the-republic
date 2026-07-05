import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-8 py-8 text-center">
      <p className="text-xs text-text-muted">
        Open source. Commons-governed. No single owner.
      </p>
      <p className="mt-2 text-xs text-text-muted">
        <a
          href="https://github.com/TheSocraticRepublic/the-republic"
          className="underline underline-offset-2 transition-colors hover:text-text-secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span className="mx-2">·</span>
        <span>AGPL-3.0</span>
        <span className="mx-2">·</span>
        <Link
          href="/foundations"
          className="underline underline-offset-2 transition-colors hover:text-text-secondary"
        >
          Foundations
        </Link>
        <span className="mx-2">·</span>
        <Link
          href="/privacy"
          className="underline underline-offset-2 transition-colors hover:text-text-secondary"
        >
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <a
          href="https://ko-fi.com/toasted40013"
          className="underline underline-offset-2 transition-colors hover:text-text-secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Support this project
        </a>
      </p>
    </footer>
  )
}
