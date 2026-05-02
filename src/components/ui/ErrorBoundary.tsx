import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Опциональный fallback-рендер. Если не задан — показываем дефолтный экран ошибки. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary — ловит ошибки рендера в дочерних компонентах
 * и показывает понятный экран вместо белого экрана смерти.
 *
 * Не ловит:
 * - Ошибки в event handlers (используй try/catch в обработчиках)
 * - Async ошибки (Promise rejection — используй try/catch в await)
 * - Ошибки в самом ErrorBoundary
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Логируем в консоль — в проде сюда можно подключить Sentry/LogRocket
    console.error('[ErrorBoundary] caught:', error);
    console.error('[ErrorBoundary] componentStack:', info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full bg-surface-container rounded-2xl p-6 md:p-8 border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-error-container flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-on-error-container" />
            </div>
            <h1 className="text-xl md:text-2xl font-headline font-bold">Что-то пошло не так</h1>
          </div>

          <p className="text-on-surface-variant text-sm md:text-base mb-4">
            Приложение столкнулось с непредвиденной ошибкой. Попробуй обновить страницу.
            Если ошибка повторяется — напиши нам.
          </p>

          <details className="mb-6 text-xs md:text-sm">
            <summary className="cursor-pointer text-on-surface-variant hover:text-on-surface mb-2">
              Подробности (для разработчика)
            </summary>
            <pre className="bg-surface-container-highest rounded-lg p-3 overflow-auto text-on-surface-variant whitespace-pre-wrap break-words">
              {error.name}: {error.message}
              {error.stack && '\n\n' + error.stack.split('\n').slice(0, 8).join('\n')}
            </pre>
          </details>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={this.reset}
              className="flex-1 bg-primary text-on-primary px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Попробовать снова
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-surface-container-highest text-on-surface px-4 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      </div>
    );
  }
}
