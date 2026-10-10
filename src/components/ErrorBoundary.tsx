import { Component, type ReactNode } from "react"

/** Catches render errors so a failure shows a recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component<{
  children: ReactNode
  resetKey?: string
}, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error("EVOS view error:", error)
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="grid min-h-[60vh] place-items-center px-6 py-16"
      >
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold tracking-[0.16em] text-teal uppercase">
            Something went wrong
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            This view could not be displayed.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Your settings and scenario are kept. Try again, or reset the demo if
            the problem continues.
          </p>
          <p className="mt-3 rounded-md bg-soft px-3 py-2 font-mono text-xs break-words text-muted">
            {this.state.error.message}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="h-11 rounded-lg bg-cyan px-5 text-sm font-medium text-deep hover:bg-[#2cc8d9]"
            >
              Try again
            </button>
            <button
              onClick={() => {
                sessionStorage.clear()
                window.location.hash = "/app/overview"
                window.location.reload()
              }}
              className="h-11 rounded-lg border border-line bg-white px-5 text-sm font-medium text-ink hover:bg-soft"
            >
              Reset demo and reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
