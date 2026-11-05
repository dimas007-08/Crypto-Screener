import { useState } from "react";
import { Check, Copy, Download, FileCode, X } from "lucide-react";
import { PINE_RF_ZONES } from "../lib/pine-zones";

interface Props {
  onClose: () => void;
}

// Простая подсветка Pine Script без внешних библиотек
function highlight(code: string): string {
  const esc = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return esc
    // комментарии
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#64748b;font-style:italic">$1</span>')
    // строки
    .replace(/("(?:[^"\\\n]|\\.)*")/g, '<span style="color:#a5d6ff">$1</span>')
    // hex цвета
    .replace(/(#[0-9a-fA-F]{6,8}\b)/g, '<span style="color:#7ee787">$1</span>')
    // числа
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#79c0ff">$1</span>')
    // ключевые слова
    .replace(
      /\b(var|if|else|for|and|or|not|na|true|false|int|float|bool|string|color|line|label|box|table|input|plot|plotshape)\b/g,
      '<span style="color:#ff7b72">$1</span>',
    )
    // namespace
    .replace(
      /\b(ta|math|str|color|request|barstate|syminfo|position|size|label|line|box|table|array)\b/g,
      '<span style="color:#d2a8ff">$1</span>',
    );
}

export default function PineCodeModal({ onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PINE_RF_ZONES);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = PINE_RF_ZONES;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([PINE_RF_ZONES], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rf_svg_zones.pine";
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = PINE_RF_ZONES.split("\n");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#00ff88]/25 bg-[#0d1117]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b hairline px-4 py-2.5">
          <FileCode size={14} className="text-[#00ff88]" />
          <span className="font-mono text-xs font-bold text-[#e6edf3]">rf_svg_zones.pine</span>
          <span className="rounded bg-[#00ff88]/15 px-2 py-0.5 font-mono text-[9px] text-[#00ff88]">
            Pine Script v6 · {lines.length} строк
          </span>
          <button
            onClick={download}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#161b22] px-2.5 py-1 font-mono text-[10px] text-[#8b98ab] transition-colors hover:text-[#00e5ff]"
          >
            <Download size={11} />
            .pine
          </button>
          <button
            onClick={copy}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-[10px] font-bold transition-all ${
              copied ? "bg-[#00ff88] text-[#052018]" : "bg-[#00ff88]/80 text-[#052018] hover:bg-[#00ff88]"
            }`}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Скопировано" : "Копировать"}
          </button>
          <button onClick={onClose} className="rounded p-1 text-[#8b98ab] hover:text-[#ff4466]">
            <X size={14} />
          </button>
        </div>

        <div className="shrink-0 border-b hairline bg-[#161b22]/50 px-4 py-2 font-mono text-[9.5px] leading-relaxed text-[#8b98ab]">
          <span className="text-[#ffab00]">Установка:</span> TradingView → Pine Editor → удали шаблон → вставь этот код →
          «Добавить на график». Индикатор содержит Range Filter, Аллигатор, СВГ и{" "}
          <span className="text-[#00ff88]">Зоны S/R</span> с разворотными сигналами.
        </div>

        <div className="code-scroll flex-1 overflow-auto">
          <pre className="min-w-max px-0 py-3 font-mono text-[11.5px] leading-[1.65]">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-white/[0.02]">
                <span className="w-11 shrink-0 select-none pr-3 text-right text-[#3b4b63]">{i + 1}</span>
                <span className="pr-6 whitespace-pre" dangerouslySetInnerHTML={{ __html: highlight(line) || "&nbsp;" }} />
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
