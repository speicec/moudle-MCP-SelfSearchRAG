import React from 'react';

/**
 * ErrorBoundary - Catches React rendering errors
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          backgroundColor: '#f8f9fa',
          color: '#333',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ color: '#e53e3e' }}>渲染错误</h1>
          <pre style={{
            backgroundColor: '#fff',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              backgroundColor: '#3182ce',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;