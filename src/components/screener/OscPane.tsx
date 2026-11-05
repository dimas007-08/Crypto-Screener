import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Analysis } from "../../lib/indicators";
import { type View } from "./ChartPane";
import { drawCrosshair } from "./crosshair";

export interface CciRow {
  tf: string;
  bb: number;
  bbBars: number;
  p100: number;
  p100Bars: number;
  x: number;
  xBars: number;
  bw: number;
  bwSig: number;
}

interface Props {
  a: Analysis | null;
  height: number;
  onResize: (h: number) => void;
  view: View;
  crossIdx: number | null;
  collapsed: boolean;
  onToggle: () => void;
}

function draw(cv: HTMLCanvasElement, a: Analysis, view: View, crossIdx: number | null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // ── та же система координат, что у графика цены ──
  const padR = 70;
  const from = Math.max(0, view.right - view.count + 1);
  const to = Math.min(a.cc.cci.length - 1, view.right);
  if (from > to) return;
  const bw = (w - padR - 8) / view.count;
  const X = (gi: number) => 8 + (gi - from + 0.5) * bw;

  let mx = 150;
  for (let i = from; i <= to; i++) {
    mx = Math.max(mx, Math.abs(a.cc.cci[i]), Math.abs(a.cc.upper[i] || 0), Math.abs(a.cc.lower[i] || 0));
  }
  mx *= 1.08;
  const Y = (v: number) => h / 2 - (v / mx) * (h / 2 - 8);

  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";
  // зона ±100
  ctx.fillStyle = "rgba(33,150,243,0.07)";
  ctx.fillRect(0, Y(100), w - padR, Y(-100) - Y(100));
  [100, 0, -100].forEach((lv) => {
    ctx.strokeStyle = lv === 0 ? "rgba(255,255,255,0.2)" : "rgba(120,123,134,0.35)";
    ctx.setLineDash(lv === 0 ? [] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, Y(lv));
    ctx.lineTo(w - padR, Y(lv));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#5d6b80";
    ctx.fillText(String(lv), w - padR + 5, Y(lv));
  });

  // полосы BB как заливка
  ctx.beginPath();
  for (let i = from; i <= to; i++) ctx.lineTo(X(i), Y(a.cc.upper[i]));
  for (let i = to; i >= from; i--) ctx.lineTo(X(i), Y(a.cc.lower[i]));
  ctx.closePath();
  ctx.fillStyle = "rgba(0,200,83,0.09)";
  ctx.fill();

  const line = (arr: number[], col: string, lw: number) => {
    ctx.beginPath();
    let st = false;
    for (let i = from; i <= to; i++) {
      const v = arr[i];
      if (Number.isNaN(v)) continue;
      const x = X(i);
      const y = Y(v);
      st ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), (st = true));
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  line(a.cc.upper, "rgba(0,200,83,0.55)", 1);
  line(a.cc.lower, "rgba(0,200,83,0.55)", 1);
  line(a.cc.ma, "#ffd600", 1.4);

  // CCI с динамическим цветом
  const i2 = a.cc.cci.length - 1;
  const strongUp = a.cc.cci[i2] > a.cc.upper[i2] && a.cc.cci[i2] > 100;
  const strongDn = a.cc.cci[i2] < a.cc.lower[i2] && a.cc.cci[i2] < -100;
  line(a.cc.cci, strongUp ? "#00695C" : strongDn ? "#B71C1C" : "#2962FF", 2);

  // точки пересечения CCI × MA
  for (let i = Math.max(1, from); i <= to; i++) {
    const up = a.cc.cci[i - 1] <= a.cc.ma[i - 1] && a.cc.cci[i] > a.cc.ma[i];
    const dn = a.cc.cci[i - 1] >= a.cc.ma[i - 1] && a.cc.cci[i] < a.cc.ma[i];
    if (!up && !dn) continue;
    ctx.beginPath();
    ctx.arc(X(i), Y(a.cc.cci[i]), 3, 0, Math.PI * 2);
    ctx.fillStyle = up ? "#00E676" : "#FF1744";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // кроссхэйр — вертикальная линия на баре под курсором
  drawCrosshair(ctx, crossIdx, from, to, X, h);
}

export default function OscPane({ a, height, onResize, view, crossIdx, collapsed, onToggle }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ y: number; h: number } | null>(null);

  useEffect(() => {
    if (ref.current && a) draw(ref.current, a, view, crossIdx);
  }, [a, height, view, crossIdx]);
  useEffect(() => {
    const onR = () => ref.current && a && draw(ref.current, a, view, crossIdx);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [a, view, crossIdx]);

  // перетаскивание границы: тянем вверх — окно растёт, вниз — сжимается
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      const dy = drag.current.y - e.clientY;
      onResize(Math.max(90, Math.min(520, drag.current.h + dy)));
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onResize]);

  return (
    <div className="shrink-0 border-t hairline bg-[#0d1117]">
      {/* ручка ресайза */}
      {!collapsed && (
        <div
          onMouseDown={(e) => (drag.current = { y: e.clientY, h: height })}
          className="group flex h-2.5 cursor-ns-resize items-center justify-center bg-[#161b22] transition-colors hover:bg-[#2962ff]/25"
          title="Потяни, чтобы изменить высоту"
        >
          <div className="h-0.5 w-10 rounded bg-[#3f4c60] transition-colors group-hover:bg-[#8fb0ff]" />
        </div>
      )}

      <div className="flex items-center gap-3 border-b hairline px-3 py-1.5">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 font-mono text-[10px] text-[#5d6b80] transition-colors hover:text-[#2962ff]"
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          📊 CCI + BB MTF
        </button>
        {a && (
          <span className="ml-auto flex items-center gap-3 font-mono text-[10px]">
            <span className="text-[#8b98ab]">
              CCI <span className="text-[#2962FF]">{a.cc.cci[a.cc.cci.length - 1].toFixed(0)}</span>
            </span>
            <span className="text-[#8b98ab]">
              BW{" "}
              <span className={a.cc.bwSig !== 0 ? "text-[#00E5FF]" : "text-[#AB47BC]"}>
                {a.cc.bwSig !== 0 ? (a.cc.bwSig > 0 ? "▲" : "▼") : ""}
                {Math.round(a.cc.bwPct)}%
              </span>
            </span>
          </span>
        )}
      </div>

      {!collapsed && (
        <div style={{ height }}>
          <canvas ref={ref} className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
