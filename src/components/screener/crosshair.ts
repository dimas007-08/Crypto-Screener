// ─────────────────────────────────────────────────────────────
//  Кроссхэйр — вертикальная линия через все окна индикаторов
// ─────────────────────────────────────────────────────────────

/**
 * Рисует вертикальную пунктирную линию на указанном баре.
 * Используется во всех нижних окнах (CCI, MACD, ADX, EFI).
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  crossIdx: number | null,
  from: number,
  to: number,
  x: (idx: number) => number,
  height: number,
): void {
  if (crossIdx === null || crossIdx < from || crossIdx > to) return;
  const cx = x(crossIdx);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(200,211,224,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, height);
  ctx.stroke();
  ctx.restore();
}
