import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import Screener from "./components/Screener";
import PineCodeModal from "./components/PineCodeModal";

interface BoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Screener runtime error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0f16] p-6 text-[#e6edf3]">
        <div className="w-full max-w-lg rounded-xl border border-[#ff4466]/35 bg-[#0d1117] p-5">
          <h1 className="text-base font-bold text-[#ff7189]">Скринер остановил ошибочный расчёт</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8b98ab]">
            Данные и настройки сохранены. Перезапусти интерфейс; если ошибка повторится, скопируй текст ниже.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[#161b22] p-3 font-mono text-[11px] text-[#ff9aaa]">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-[#2962ff] px-4 py-2 text-xs font-bold text-white hover:bg-[#4779ff]"
          >
            Перезапустить платформу
          </button>
        </div>
      </main>
    );
  }
}

export default function App() {
  const [showPine, setShowPine] = useState(false);
  return (
    <ErrorBoundary>
      <Screener onShowPine={() => setShowPine(true)} />
      {showPine && <PineCodeModal onClose={() => setShowPine(false)} />}
    </ErrorBoundary>
  );
}
