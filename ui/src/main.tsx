import React, { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
          <div className="max-w-2xl rounded-[24px] border border-danger/30 bg-danger/10 p-6 text-left text-sm text-red-200">
            <div className="mb-2 text-[12px] uppercase tracking-[0.18em] text-red-300">Application error</div>
            <h1 className="text-[20px] font-semibold text-text-primary">The app crashed while rendering.</h1>
            <p className="mt-3 text-text-secondary">{this.state.error.message}</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
