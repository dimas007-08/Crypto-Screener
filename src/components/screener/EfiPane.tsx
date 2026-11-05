import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Analysis } from "../../lib/indicators";
import type { Settings } from "../../lib/settings";
import { drawCrosshair } from "./crosshair";
import type { View } from "./ChartPane";

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

  const data = analysis.efi;
  const rightPadding = 70;
  const from = Math.max(0, view.right - view.count + 1);
  const to = Math.min(data.efi.length - 1, view.right);
  if (from > to) return;

  const barWidth = (width - rightPadding - 8) / view.count;
  const x = (index: number) => 8 + (index - from + 0.5) * barWidth;

  // масштаб — симметричный вокруг нуля
  let maxAbs = 0;
  for (let i = from; i <= to; i++) {
    if (Number.isFinite(data.efi[i])) maxAbs = Math.max(maxAbs, Math.abs(data.efi[i]));
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

  // гистограмма EFI
  for (let i = from; i <= to; i++) {
    const v = data.efi[i];
    if (!Number.isFinite(v)) continue;
    ctx.fillStyle = v > 0 ? "rgba(0,255,136,0.35)" : "rgba(255,68,102,0.35)";
    const yy = y(v);
    ctx.fillRect(x(i) - barWidth * 0.3, Math.min(yy, zero), barWidth * 0.6, Math.abs(yy - zero) || 1);
  }

  // сглаженная линия EFI
  ctx.beginPath();
  let started = false;
  for (let i = from; i <= to; i++) {
    const v = data.efi[i];
    if (!Number.isFinite(v)) continue;
    started ? ctx.lineTo(x(i), y(v)) : (ctx.moveTo(x(i), y(v)), (started = true));
  }
  ctx.strokeStyle = settings.efi.lineColor;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // маркеры всплесков (острый угол от нуля)
  for (const spike of data.spikes) {
    if (spike.i < from || spike.i > to) continue;
    const sx = x(spike.i);
    const sy = y(data.efi[spike.i]);
    const col = spike.dir === 1 ? "#00ff88" : "#ff4466";
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.shadowBlur = 0;
    // показываем угол только на свежем всплеске
    if (to - spike.i <= settings.efi.freshBars) {
      ctx.fillStyle = col;
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(spike.angle)}°`, sx, spike.dir === 1 ? sy - 11 : sy + 12);
      ctx.textAlign = "left";
    }
  }
  drawCrosshair(ctx, crossIdx, from, to, x, height);
}

export default function EfiPane({ a, height, onResize, view, S, crossIdx, collapsed, onToggle }: Props) {
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

  const efi = a?.efi;
  const spikeCol = efi?.dir === 1 ? "#00ff88" : "#ff4466";

  return (
    <div className="shrink-0 border-t hairline bg-[#0d1117]">
      {/* ручка ресайза — скрыта в свёрнутом виде */}
      {!collapsed && (
        <div
          onMouseDown={(event) => (drag.current = { y: event.clientY, height })}
          className="group flex h-2.5 cursor-ns-resize items-center justify-center bg-[#161b22] transition-colors hover:bg-[#ff9800]/20"
        >
          <div className="h-0.5 w-10 rounded bg-[#3f4c60] group-hover:bg-[#ff9800]" />
        </div>
      )}

      <div className="flex items-center gap-3 border-b hairline px-3 py-1.5 font-mono text-[10px]">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[#5d6b80] transition-colors hover:text-[#ff9800]"
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          <span>⚡ EFI {S.efi.length}</span>
        </button>
        {efi && !collapsed && (
          <span className="ml-auto flex items-center gap-3">
            {efi.isFresh && (
              <span
                className="rounded px-1.5 py-0.5 font-bold"
                style={{ background: spikeCol, color: "#0b0f16" }}
              >
                ⚡ {Math.round(efi.angle ?? 0)}° {efi.dir === 1 ? "▲" : "▼"} {efi.ago}b
              </span>
            )}
            <span className="text-[#8b98ab]">
              EFI <span style={{ color: efi.lastEfi >= 0 ? "#00ff88" : "#ff4466" }}>{efi.lastEfi.toFixed(0)}</span>
            </span>
          </span>
        )}
        {efi && collapsed && efi.isFresh && (
          <span className="ml-auto rounded px-1.5 py-0.5 font-bold" style={{ background: spikeCol, color: "#0b0f16" }}>
            ⚡ {Math.round(efi.angle ?? 0)}°
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
