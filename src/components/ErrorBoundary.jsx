
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    // FORCE DISPLAY FOR DEBUGGING
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100vw';
    errorDiv.style.height = '100vh';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.backgroundColor = 'white';
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '20px';
    errorDiv.style.fontSize = '24px';
    errorDiv.style.whiteSpace = 'pre-wrap';
    errorDiv.textContent = `CRITICAL ERROR:\n${error.toString()}\n\nSTACK:\n${errorInfo.componentStack}`;
    document.body.appendChild(errorDiv);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-red-50 text-red-900">
          <h1 className="text-3xl font-bold mb-4">Something went wrong.</h1>
          <div className="text-xl font-bold p-4 bg-yellow-100 border border-yellow-400" role="alert">
             ERROR_MESSAGE: {this.state.error && this.state.error.toString()}
          </div>
          <details className="whitespace-pre-wrap p-4 bg-white border border-red-200 rounded shadow-sm max-w-4xl overflow-auto">
            <summary className="cursor-pointer font-semibold mb-2">Error Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Home
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
