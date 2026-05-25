'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="error-boundary">
          <AlertTriangle size={32} />
          <h3>Что-то пошло не так</h3>
          <p>{this.state.error?.message ?? 'Произошла непредвиденная ошибка'}</p>
          <button className="button" onClick={this.handleRetry} type="button">
            <RefreshCw size={16} />
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
