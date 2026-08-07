import { Component } from 'react'

/**
 * Generic retry-capable error boundary for the Recipe Workspace pages. React error boundaries
 * must be class components — there is no hook equivalent in React 18.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null })
    this.props.onRetry?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback(error, this.handleRetry)
    }

    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-8">{error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={this.handleRetry}
            className="h-12 px-6 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}
