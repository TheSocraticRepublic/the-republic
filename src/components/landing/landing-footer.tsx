export function LandingFooter() {
  return (
    <footer className="border-t border-border px-8 py-8 text-center">
      <p className="text-xs text-text-faint">
        Open source. Commons-governed. No single owner.
      </p>
      <p className="mt-2 text-xs text-text-faint">
        <a
          href="https://github.com/TheSocraticRepublic/the-republic"
          className="underline underline-offset-2 transition-colors hover:text-text-muted"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span className="mx-2">·</span>
        <span>AGPL-3.0</span>
        <span className="mx-2">·</span>
        <a
          href="https://ko-fi.com/opencave"
          className="underline underline-offset-2 transition-colors hover:text-text-muted"
          target="_blank"
          rel="noopener noreferrer"
        >
          Support this project
        </a>
      </p>
    </footer>
  )
}
