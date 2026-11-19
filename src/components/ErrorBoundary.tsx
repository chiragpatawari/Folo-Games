import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E2DED5] rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[#18181B]">
              Something interrupted your game
            </h2>
            <p className="text-sm text-[#57534E] break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-[#18181B] text-[#FAF9F6] rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Reload Folio Games
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
