import React, { Component, type ReactNode } from "react";
import { Link } from "./router";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "The application encountered an unexpected error while loading or displaying this page.";
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="checker-shell-layout app-error-boundary">
          <header className="app-bar" aria-label="Application header">
            <div className="app-bar-inner">
              <div className="app-bar-left">
                <Link href="/" className="app-bar-brand" aria-label="Custodia Home">
                  <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
                    <rect width="32" height="32" rx="8" fill="#14213D" />
                    <path d="M8 16h6m4 0h6" stroke="#FBF8F1" strokeWidth="2.4" strokeLinecap="round" />
                    <circle cx="16" cy="16" r="3.2" fill="#2F7F79" />
                  </svg>
                  <span className="brand-name">Custodia</span>
                </Link>
                <Link href="/" className="app-bar-navlink">
                  Home
                </Link>
              </div>
            </div>
          </header>

          <main className="checker-main shell" style={{ paddingTop: 40, paddingBottom: 60 }}>
            <div className="panel error-boundary-panel" role="alert">
              <div className="error-boundary-content">
                <span className="sticker bad small-sticker">Notice</span>
                <h2>Something went wrong</h2>
                <p>
                  {this.state.errorMessage ??
                    "The application encountered an unexpected error while loading or displaying this page."}
                </p>
                <div className="error-boundary-actions" style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  <button type="button" className="btn primary" onClick={this.handleTryAgain}>
                    Try again
                  </button>
                  <button type="button" className="btn" onClick={this.handleReload}>
                    Reload page
                  </button>
                  <Link href="/" className="btn">
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
