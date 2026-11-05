// ─────────────────────────────────────────────────────────────
//  Ручная разметка уровней на графике
//  Нужна, чтобы сверить автоматический алгоритм с реальной
//  разметкой трейдера: ставим линии руками → сравниваем → чиним.
// ─────────────────────────────────────────────────────────────

export type MarkKind = "L-High" | "L-Low" | "High-D" | "Low-D" | "Свободная";

export interface Mark {
  id: string;
  symbol: string;
  tf: string;
  kind: MarkKind;
  price: number;
  /** индекс бара, на котором поставлена метка (для привязки к свече) */
  barIdx: number;
  barTime: number;
  note?: string;
  createdAt: number;
}

export const MARK_KINDS: { id: MarkKind; label: string; color: string }[] = [
  { id: "L-High", label: "L-High", color: "#00e5ff" },
  { id: "L-Low", label: "L-Low", color: "#00e5ff" },
  { id: "High-D", label: "High-D", color: "#ffab00" },
  { id: "Low-D", label: "Low-D", color: "#ffab00" },
  { id: "Свободная", label: "Своя", color: "#ff69b4" },
];

export function markColor(kind: MarkKind): string {
  return MARK_KINDS.find((m) => m.id === kind)?.color ?? "#ff69b4";
}

const KEY = "bybit-screener-marks-v1";

export function loadMarks(): Mark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Mark[]) : [];
  } catch {
    return [];
  }
}

export function saveMarks(marks: Mark[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    /* ignore */
  }
}

export function marksFor(marks: Mark[], symbol: string, tf: string): Mark[] {
  return marks.filter((m) => m.symbol === symbol && m.tf === tf);
}

/** Экспорт разметки в текст — удобно прислать для разбора алгоритма */
export function exportMarks(marks: Mark[], symbol: string, tf: string): string {
  const list = marksFor(marks, symbol, tf).sort((a, b) => b.price - a.price);
  if (!list.length) return "Разметка пуста";
  const lines = list.map((m) => {
    const d = new Date(m.barTime);
    const time = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(
      d.getHours(),
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${m.kind.padEnd(10)} ${m.price}  bar#${m.barIdx}  ${time}${m.note ? "  // " + m.note : ""}`;
  });
  return [`${symbol} · ${tf}`, "─".repeat(46), ...lines].join("\n");
}
