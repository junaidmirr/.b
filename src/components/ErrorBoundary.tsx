import { Component, type ReactNode, type ErrorInfo } from 'react'
import { ErrorPage } from './ErrorPage'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleNavigateHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const details = this.state.error
        ? `${this.state.error.name}: ${this.state.error.message}\n${
            this.state.error.stack || ''
          }\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`
        : 'Unknown runtime error'

      return (
        <ErrorPage
          code={500}
          errorDetails={details}
          onRetry={this.handleReload}
          onNavigateHome={this.handleNavigateHome}
        />
      )
    }

    return this.props.children
  }
}
