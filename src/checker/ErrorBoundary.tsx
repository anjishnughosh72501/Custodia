import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/check";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel error-boundary-panel" role="alert">
          <div className="error-boundary-content">
            <span className="sticker bad">Something went wrong</span>
            <h2>An unexpected UI error occurred</h2>
            <p>
              The application encountered an error while rendering. Your data in this tab may still
              be saved in draft storage.
            </p>
            {this.state.error && (
              <pre className="code error-details">{this.state.error.message}</pre>
            )}
            <div className="error-boundary-actions">
              <button type="button" className="btn primary" onClick={this.handleReload}>
                Reload page
              </button>
              <button type="button" className="btn" onClick={this.handleReset}>
                Reset to new check
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
