import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const details = (error as any)?.details;
      const message = error?.message || 'Ocorreu um erro inesperado na aplicação. Tente recarregar a página.';

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-neutral-100 max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-neutral-900">Ops! Algo deu errado.</h2>
              <p className="text-neutral-500 text-sm">
                {message}
              </p>
            </div>
            {details && (
              <div className="p-4 bg-neutral-50 rounded-2xl text-left overflow-hidden">
                <p className="text-[10px] font-mono text-neutral-400 uppercase mb-1">Detalhes técnicos</p>
                <p className="text-[10px] font-mono text-neutral-500">
                  Operação: {details.operationType}
                  <br />
                  Caminho: {details.path}
                </p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-5 h-5" />
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
