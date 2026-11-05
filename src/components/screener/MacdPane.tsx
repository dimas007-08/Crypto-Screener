import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Analysis } from "../../lib/indicators";
import type { Settings } from "../../lib/settings";
import { drawCrosshair } from "./crosshair";
import type { View } from "./ChartPane";

interface Props {
  a: Analysis | null;
  height: number;
  onResize: (h: number) => void;
  view: View;
  S: Settings;
  crossIdx: number | null;
  collapsed: boolean;
  onToggle: () => void;
}

function draw(canvas: HTMLCanvasElement, analysis: Analysis, view: View, settings: Settings, crossIdx: number | null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const m = analysis.macd;
  const rightPadding = 70;
  const from = Math.max(0, view.right - view.count + 1);
  const to = Math.min(m.macd.length - 1, view.right);
  if (from > to) return;

  const barWidth = (width - rightPadding - 8) / view.count;
  const x = (index: number) => 8 + (index - from + 0.5) * barWidth;

  let maxAbs = 0;
  for (let i = from; i <= to; i++) {
    if (Number.isFinite(m.macd[i])) maxAbs = Math.max(maxAbs, Math.abs(m.macd[i]));
    if (Number.isFinite(m.signal[i])) maxAbs = Math.max(maxAbs, Math.abs(m.signal[i]));
    if (Number.isFinite(m.hist[i])) maxAbs = Math.max(maxAbs, Math.abs(m.hist[i]));
  }
  if (maxAbs === 0) maxAbs = 1;
  maxAbs *= 1.1;
  const y = (value: number) => height / 2 - (value / maxAbs) * (height / 2 - 6);
  const zero = y(0);

  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";

  // нулевая линия
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, zero);
  ctx.lineTo(width - rightPadding, zero);
  ctx.stroke();

  // гистограмма — стандартные цветные столбики
  for (let i = from; i <= to; i++) {
    const v = m.hist[i];
    if (!Number.isFinite(v)) continue;
    const above = v > 0;
    const rising = i > 0 && Number.isFinite(m.hist[i - 1]) ? Math.abs(v) > Math.abs(m.hist[i - 1]) : true;
    // TradingView: 4 оттенка — тёмный/светлый зелёный и красный
    let col: string;
    if (above && rising) col = "#26a69a";
    else if (above) col = "#b2dfdb";
    else if (!above && rising) col = "#ef5350";
    else col = "#ffcdd2";
    ctx.fillStyle = col;
    const yy = y(v);
    ctx.fillRect(x(i) - barWidth * 0.32, Math.min(yy, zero), barWidth * 0.64, Math.abs(yy - zero) || 1);
  }

  const line = (series: number[], color: string, lineWidth: number) => {
    ctx.beginPath();
    let started = false;
    for (let i = from; i <= to; i++) {
      const v = series[i];
      if (!Number.isFinite(v)) continue;
      started ? ctx.lineTo(x(i), y(v)) : (ctx.moveTo(x(i), y(v)), (started = true));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  if (settings.macd.showLine) {
    line(m.macd, settings.macd.macdColor, 1.8);
    line(m.signal, settings.macd.signalColor, 1.4);
  }

  // маркеры стадий сигналов (только с DEMA-фильтром)
  // стадия 1 — маленький кружок, стадия 2 — большой с обводкой
  const STAGE1_R = 3;
  const STAGE2_R = 5;

  const drawStage = (bars: number[], col: string, radius: number, isStage2: boolean) => {
    for (const barIdx of bars) {
      if (barIdx < from || barIdx > to) continue;
      const series = isStage2 ? m.signal : m.macd;
      const val = series[barIdx];
      if (!Number.isFinite(val)) continue;
      const px = x(barIdx);
      const py = y(val);
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = isStage2 ? 12 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (isStage2) {
        ctx.beginPath();
        ctx.arc(px, py, radius + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  };

  // SELL стадии (красные)
  drawStage(m.sellStage1Bars, "#ff4466", STAGE1_R, false);
  drawStage(m.sellStage2Bars, "#ff4466", STAGE2_R, true);
  // BUY стадии (зелёные)
  drawStage(m.buyStage1Bars, "#00ff88", STAGE1_R, false);
  drawStage(m.buyStage2Bars, "#00ff88", STAGE2_R, true);

  // дивергенции — линия строго от соседнего бугорка к текущему
  if (settings.macd.showDivergence) {
    const drawDiv = (
      list: { i: number; dir: 1 | -1; prevIdx: number }[],
      col: string,
    ) => {
      for (const d of list) {
        // рисуем только если оба бугорка видны
        if (d.i < from || d.prevIdx > to) continue;
        const x1 = x(d.prevIdx);
        const y1 = y(m.hist[d.prevIdx]);
        const x2 = x(d.i);
        const y2 = y(m.hist[d.i]);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();

        // точки на обоих бугорках
        for (const px of [x1, x2]) {
          ctx.beginPath();
          ctx.arc(px, px === x1 ? y1 : y2, 3, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
        }
      }
    };
    drawDiv(m.bullDiv, "#00e676");
    drawDiv(m.bearDiv, "#e60000");
  }
  drawCrosshair(ctx, crossIdx, from, to, x, height);
}

export default function MacdPane({ a, height, onResize, view, S, crossIdx, collapsed, onToggle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current && a && !collapsed) draw(canvasRef.current, a, view, S, crossIdx);
  }, [a, height, view, S, collapsed]);

  useEffect(() => {
    const redraw = () => canvasRef.current && a && !collapsed && draw(canvasRef.current, a, view, S, crossIdx);
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [a, view, S, collapsed]);

  useEffect(() => {
    if (collapsed) return;
    const move = (event: MouseEvent) => {
      if (!drag.current) return;
      const delta = drag.current.y - event.clientY;
      onResize(Math.max(70, Math.min(300, drag.current.height + delta)));
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onResize, collapsed]);

  const m = a?.macd;
  const sigCol = m?.dir === 1 ? "#00ff88" : m?.dir === -1 ? "#ff4466" : "#8b98ab";

  return (
    <div className="shrink-0 border-t hairline bg-[#0d1117]">
      {!collapsed && (
        <div
          onMouseDown={(e) => (drag.current = { y: e.clientY, height })}
          className="group flex h-2.5 cursor-ns-resize items-center justify-center bg-[#161b22] transition-colors hover:bg-[#2962ff]/25"
        >
          <div className="h-0.5 w-10 rounded bg-[#3f4c60] group-hover:bg-[#8fb0ff]" />
        </div>
      )}

      <div className="flex items-center gap-3 border-b hairline px-3 py-1.5 font-mono text-[10px]">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[#5d6b80] transition-colors hover:text-[#00bcd4]"
        >
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          📊 MACD {S.macd.fastLen},{S.macd.slowLen},{S.macd.signalLen}
        </button>
        {m && !collapsed && (
          <span className="ml-auto flex items-center gap-3">
            {m.isFresh && (
              <span
                className="rounded px-1.5 py-0.5 font-bold"
                style={{ background: sigCol, color: "#0b0f16" }}
              >
                {m.dir === 1 ? "▲ BUY" : "▼ SELL"} {m.ago}b
              </span>
            )}
            {m.divDir !== 0 && m.divAgo <= S.macd.freshBars && (
              <span
                className="rounded px-1.5 py-0.5 font-bold"
                style={{
                  background: m.divDir === 1 ? "#00e676" : "#e60000",
                  color: "#0b0f16",
                }}
              >
                Div {m.divDir === 1 ? "▲" : "▼"} {m.divAgo}b
              </span>
            )}
            <span className="text-[#8b98ab]">
              MACD <span style={{ color: S.macd.macdColor }}>{m.lastMacd.toFixed(1)}</span>
            </span>
            <span className="text-[#8b98ab]">
              Sig <span style={{ color: S.macd.signalColor }}>{m.lastSignal.toFixed(1)}</span>
            </span>
          </span>
        )}
        {m && collapsed && m.isFresh && (
          <span className="ml-auto rounded px-1.5 py-0.5 font-bold" style={{ background: sigCol, color: "#0b0f16" }}>
            {m.dir === 1 ? "▲" : "▼"} {m.ago}b
          </span>
        )}
      </div>

      {!collapsed && (
        <div style={{ height }}>
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
