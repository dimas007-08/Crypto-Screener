import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Analysis } from "../../lib/indicators";
import type { Settings } from "../../lib/settings";
import type { View } from "./ChartPane";
import { drawCrosshair } from "./crosshair";

interface Props {
  a: Analysis | null;
  height: number;
  onResize: (height: number) => void;
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

  const data = analysis.adx;
  const rightPadding = 70;
  const from = Math.max(0, view.right - view.count + 1);
  const to = Math.min(data.adx.length - 1, view.right);
  if (from > to) return;

  const barWidth = (width - rightPadding - 8) / view.count;
  const x = (index: number) => 8 + (index - from + 0.5) * barWidth;
  let scaleMax = Math.max(40, settings.adx.level + 10);
  for (let i = from; i <= to; i++) {
    scaleMax = Math.max(
      scaleMax,
      Number.isFinite(data.adx[i]) ? data.adx[i] : 0,
      Number.isFinite(data.plusDI[i]) ? data.plusDI[i] : 0,
      Number.isFinite(data.minusDI[i]) ? data.minusDI[i] : 0,
    );
  }
  scaleMax = Math.min(100, scaleMax * 1.08);
  const y = (value: number) => height - (value / scaleMax) * (height - 8);

  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";

  // Зона силы ADX выше порога.
  ctx.fillStyle = "rgba(255,171,0,0.055)";
  ctx.fillRect(0, 0, width - rightPadding, y(settings.adx.level));

  [0, settings.adx.level, 40].forEach((level) => {
    if (level > scaleMax) return;
    ctx.setLineDash(level === settings.adx.level ? [5, 4] : []);
    ctx.strokeStyle = level === settings.adx.level ? "rgba(255,171,0,0.85)" : "rgba(93,107,128,0.2)";
    ctx.lineWidth = level === settings.adx.level ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(0, y(level));
    ctx.lineTo(width - rightPadding, y(level));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = level === settings.adx.level ? "#ffab00" : "#5d6b80";
    ctx.fillText(String(level), width - rightPadding + 6, y(level));
  });

  const line = (series: number[], color: string, lineWidth: number) => {
    ctx.beginPath();
    let started = false;
    for (let i = from; i <= to; i++) {
      const value = series[i];
      if (!Number.isFinite(value)) continue;
      if (started) ctx.lineTo(x(i), y(value));
      else {
        ctx.moveTo(x(i), y(value));
        started = true;
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  line(data.plusDI, "rgba(0,255,136,0.58)", 1);
  line(data.minusDI, "rgba(255,68,102,0.58)", 1);
  line(data.adx, "#ffab00", 2.1);

  // Метки именно на барах перехода ADX снизу вверх через порог.
  for (let i = Math.max(from + 1, 1); i <= to; i++) {
    if (!Number.isFinite(data.adx[i - 1]) || !Number.isFinite(data.adx[i])) continue;
    if (!(data.adx[i - 1] <= settings.adx.level && data.adx[i] > settings.adx.level)) continue;
    const up = data.plusDI[i] >= data.minusDI[i];
    ctx.beginPath();
    ctx.arc(x(i), y(data.adx[i]), 4, 0, Math.PI * 2);
    ctx.fillStyle = up ? "#00ff88" : "#ff4466";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  drawCrosshair(ctx, crossIdx, from, to, x, height);
}

export default function AdxPane({ a, height, onResize, view, S, crossIdx, collapsed, onToggle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current && a) draw(canvasRef.current, a, view, S, crossIdx);
  }, [a, height, view, S, crossIdx]);

  useEffect(() => {
    const redraw = () => canvasRef.current && a && draw(canvasRef.current, a, view, S, crossIdx);
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [a, view, S, crossIdx]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!drag.current) return;
      const delta = drag.current.y - event.clientY;
      onResize(Math.max(80, Math.min(360, drag.current.height + delta)));
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onResize]);

  const adx = a?.adx;
  const signalColor = adx?.signalDir === 1 ? "#00ff88" : "#ff4466";

  return (
    <div className="shrink-0 border-t hairline bg-[#0d1117]">
      {!collapsed && (
        <div
          onMouseDown={(event) => (drag.current = { y: event.clientY, height })}
          className="group flex h-2.5 cursor-ns-resize items-center justify-center bg-[#161b22] transition-colors hover:bg-[#ffab00]/20"
          title="Потяни, чтобы изменить высоту"
        >
          <div className="h-0.5 w-10 rounded bg-[#3f4c60] group-hover:bg-[#ffab00]" />
        </div>
      )}

      <div className="flex items-center gap-3 border-b hairline px-3 py-1.5 font-mono text-[10px]">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[#5d6b80] transition-colors hover:text-[#ffab00]"
        >
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          📶 ADX {S.adx.diLength}
        </button>
        {adx && (
          <span className="ml-auto flex items-center gap-3">
            {adx.isFresh && (
              <span
                className="rounded px-1.5 py-0.5 font-bold"
                style={{ background: signalColor, color: "#0b0f16" }}
              >
                ADX ↑ {adx.signalDir > 0 ? "LONG" : "SHORT"} · {adx.signalAgo}b
              </span>
            )}
            <span className="text-[#8b98ab]">
              ADX{" "}
              <span className={adx.aboveLevel ? "text-[#ffab00]" : "text-[#c8d3e0]"}>
                {adx.lastAdx.toFixed(1)}
              </span>
            </span>
            <span className="text-[#00ff88]">+DI {adx.lastPlusDI.toFixed(1)}</span>
            <span className="text-[#ff4466]">−DI {adx.lastMinusDI.toFixed(1)}</span>
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