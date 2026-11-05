import { useEffect, useRef, useState, useCallback } from "react";
import { Crosshair, History as HistoryIcon, Maximize2, Minus, Plus } from "lucide-react";
import type { Analysis } from "../../lib/indicators";
import { fmtPrice, type TF } from "../../lib/bybit";
import type { Settings } from "../../lib/settings";
import { markColor, type Mark, type MarkKind } from "../../lib/marks";

export interface View {
  // индекс последнего видимого бара (правый край) и количество видимых баров
  right: number;
  count: number;
}

interface Props {
  a: Analysis | null;
  tf: TF;
  loading: boolean;
  S: Settings;
  view: View;
  setView: (v: View | ((p: View) => View)) => void;
  /** ручная разметка */
  marks: Mark[];
  markMode: MarkKind | null;
  onAddMark: (price: number, barIdx: number, barTime: number) => void;
  /** подгрузка истории */
  histLoading: boolean;
  onLoadHistory: () => void;
  /** отправка индекса бара под курсором — для кроссхэйра в нижних окнах */
  onCrosshair?: (idx: number | null) => void;
}

const MIN_BARS = 20;
const MAX_BARS = 400;
/** сколько баров пустого места справа — туда уходит челюсть Аллигатора */
export const FUTURE_BARS = 12;

export default function ChartPane({
  a,
  tf,
  loading,
  S,
  view,
  setView,
  marks,
  markMode,
  onAddMark,
  histLoading,
  onLoadHistory,
  onCrosshair,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cross, setCross] = useState<{ x: number; y: number; i: number } | null>(null);
  const drag = useRef<{ x: number; right: number } | null>(null);
  // текущий видимый диапазон цен — нужен для конвертации клика в цену
  const priceRange = useRef({ mn: 0, mx: 1 });

  const clampView = useCallback((v: View, len: number): View => {
    const count = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.min(v.count, len + FUTURE_BARS)));
    const right = Math.max(count - 1, Math.min(len - 1 + FUTURE_BARS, v.right));
    return { right, count };
  }, []);

  // зум колесом к позиции курсора
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!a) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      setView((v) => {
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        const newCount = Math.round(v.count * factor);
        const anchorIdx = v.right - Math.round((1 - relX) * v.count);
        const newRight = Math.round(anchorIdx + (1 - relX) * newCount);
        return clampView({ right: newRight, count: newCount }, a.candles.length);
      });
    },
    [a, clampView, setView],
  );

  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, right: view.right };
  };

  const onMove = (e: React.MouseEvent) => {
    if (!a) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const w = rect.width - 70 - 8;
    const bw = w / view.count;

    // 🔧 КРИТИЧНО: захватываем состояние драга в локальную переменную.
    // setView выполняется React отложенно (batching), и к этому моменту
    // mouseup уже мог обнулить drag.current → было "reading 'right' of null".
    const dragState = drag.current;
    if (dragState) {
      const dx = e.clientX - dragState.x;
      const shift = Math.round(dx / bw);
      const targetRight = dragState.right - shift;
      const candleLen = a.candles.length;
      setView((v) => clampView({ ...v, right: targetRight }, candleLen));
      return;
    }
    const x = e.clientX - rect.left;
    const idxInView = Math.floor((x - 8) / bw);
    const gi = view.right - view.count + 1 + idxInView;
    if (gi >= 0 && gi < a.candles.length) {
      setCross({ x, y: e.clientY - rect.top, i: gi });
      onCrosshair?.(gi);
    } else {
      setCross(null);
      onCrosshair?.(null);
    }
  };

  const onUp = () => {
    drag.current = null;
  };

  // клик в режиме разметки — ставим линию по цене курсора
  const onClick = (e: React.MouseEvent) => {
    if (!a || !markMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const padB = 18;
    const plotH = rect.height - padB;
    const y = e.clientY - rect.top;
    if (y > plotH) return;
    const price = priceRange.current.mn + ((plotH - y) / plotH) * (priceRange.current.mx - priceRange.current.mn);
    const idx = cross?.i ?? a.candles.length - 1;
    const bar = a.candles[Math.min(idx, a.candles.length - 1)];
    onAddMark(price, idx, bar.t);
  };

  const zoom = (dir: number) =>
    a && setView((v) => clampView({ ...v, count: Math.round(v.count * (dir > 0 ? 0.8 : 1.25)) }, a.candles.length));
  const reset = () => a && setView({ right: a.candles.length - 1, count: 110 });

  // 🔧 Страховка: при смене монеты история может стать короче, а view.right
  // остаться от предыдущей. Клампим в допустимые пределы до отрисовки.
  useEffect(() => {
    if (!a) return;
    const len = a.candles.length;
    const maxRight = len - 1 + FUTURE_BARS;
    if (view.right > maxRight || view.right < view.count - 1 || view.count > len + FUTURE_BARS) {
      setView(clampView(view, len));
    }
  }, [a, view, setView, clampView]);

  // ── отрисовка ──
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !a) return;
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

    const padR = 70;
    const padB = 18; // полоса шкалы времени снизу
    const from = Math.max(0, view.right - view.count + 1);
    const to = Math.min(a.candles.length - 1, view.right);
    // 🔧 отрисовка невозможна (смена монеты с короткой историей) — выходим тихо
    if (from > to) return;
    const bw = (w - padR - 8) / view.count;
    const X = (gi: number) => 8 + (gi - from + 0.5) * bw;
    const plotH = h - padB; // высота области цен

    let mn = Infinity;
    let mx = -Infinity;
    for (let i = from; i <= to; i++) {
      mn = Math.min(mn, a.candles[i].l, a.rf.line[i]);
      mx = Math.max(mx, a.candles[i].h, a.rf.line[i]);
    }
    // учитываем челюсть, вынесенную в будущее
    for (let i = Math.max(0, from - S.rf.jawOff); i <= Math.min(a.candles.length - 1, to); i++) {
      if (!Number.isNaN(a.rf.jaw[i])) {
        mn = Math.min(mn, a.rf.jaw[i]);
        mx = Math.max(mx, a.rf.jaw[i]);
      }
    }
    if (a.dir !== 0) {
      mn = Math.min(mn, a.stop, a.tp2);
      mx = Math.max(mx, a.stop, a.tp2);
    }
    const pad = (mx - mn) * 0.1 || 1;
    mn -= pad;
    mx += pad;
    const Y = (p: number) => plotH - ((p - mn) / (mx - mn)) * plotH;
    priceRange.current = { mn, mx };

    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    for (let g = 0; g <= 4; g++) {
      const p = mn + ((mx - mn) * g) / 4;
      const y = Y(p);
      ctx.strokeStyle = "rgba(62,79,104,0.16)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w - padR + 4, y);
      ctx.stroke();
      ctx.fillStyle = "#5d6b80";
      ctx.fillText(fmtPrice(p), w - padR + 8, y);
    }

    // Аллигатор: только синяя челюсть. Со сдвигом вперёд она уезжает
    // в будущее — рисуем до конца видимой области, включая пустые бары
    const lastIdx = a.candles.length - 1;
    const alli = (arr: number[], off: number, col: string, lw = 1.2) => {
      ctx.beginPath();
      let st = false;
      for (let i = from; i <= Math.min(view.right, lastIdx + off); i++) {
        const s = i - off;
        if (s < 0 || s > lastIdx || Number.isNaN(arr[s])) continue;
        const x = X(i);
        const y = Y(arr[s]);
        st ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), (st = true));
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    alli(a.rf.jaw, S.rf.jawOff, "rgba(41,98,255,0.9)", 2);

    // свечи (только реальные бары)
    // приседающие бары Вильямса красятся в синий целиком
    const squatSet = new Set<number>(S.squat.enabled && a.squat ? a.squat.squatBars : []);
    const cw = Math.max(1, bw * 0.64);
    for (let i = from; i <= Math.min(to, lastIdx); i++) {
      const k = a.candles[i];
      const up = k.c >= k.o;
      const isSquat = squatSet.has(i);
      if (isSquat) {
        // синий приседающий бар
        ctx.strokeStyle = S.squat.barColor;
        ctx.fillStyle = S.squat.barColor;
      } else {
        ctx.strokeStyle = up ? "#26a69a" : "#ef5350";
        ctx.fillStyle = up ? "rgba(38,166,154,0.9)" : "rgba(239,83,80,0.9)";
      }
      const x = X(i);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, Y(k.h));
      ctx.lineTo(x, Y(k.l));
      ctx.stroke();
      const top = Y(Math.max(k.o, k.c));
      const bh = Math.max(1.2, Math.abs(Y(k.o) - Y(k.c)));
      ctx.fillRect(x - cw / 2, top, cw, bh);
    }

    // ── 📊 MACD-сигналы: голубые треугольники на цене ──
    if (S.macd.enabled && a.macd) {
      const drawMacdTri = (bars: number[], isBuy: boolean, isStage2: boolean) => {
        const size = isStage2 ? 6 : 4;
        for (const barIdx of bars) {
          if (barIdx < from || barIdx > to || barIdx > lastIdx) continue;
          const k = a.candles[barIdx];
          const x = X(barIdx);
          const yBase = isBuy ? Y(k.l) + 8 : Y(k.h) - 8;

          ctx.beginPath();
          if (isBuy) {
            // ▲ вверх — под баром
            ctx.moveTo(x, yBase - size);
            ctx.lineTo(x - size, yBase + size * 0.7);
            ctx.lineTo(x + size, yBase + size * 0.7);
          } else {
            // ▼ вниз — над баром
            ctx.moveTo(x, yBase + size);
            ctx.lineTo(x - size, yBase - size * 0.7);
            ctx.lineTo(x + size, yBase - size * 0.7);
          }
          ctx.closePath();
          ctx.fillStyle = "#00e5ff";
          ctx.shadowColor = "#00e5ff";
          ctx.shadowBlur = isStage2 ? 10 : 5;
          ctx.fill();
          ctx.shadowBlur = 0;

          // обводка для стадии 2 (подтверждённый сигнал)
          if (isStage2) {
            ctx.beginPath();
            if (isBuy) {
              ctx.moveTo(x, yBase - size - 2);
              ctx.lineTo(x - size - 2, yBase + size * 0.7 + 2);
              ctx.lineTo(x + size + 2, yBase + size * 0.7 + 2);
            } else {
              ctx.moveTo(x, yBase + size + 2);
              ctx.lineTo(x - size - 2, yBase - size * 0.7 - 2);
              ctx.lineTo(x + size + 2, yBase - size * 0.7 - 2);
            }
            ctx.closePath();
            ctx.strokeStyle = "#00e5ff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      };

      drawMacdTri(a.macd.buyBars, true, false);
      drawMacdTri(a.macd.sellBars, false, false);
    }

    // линия RF — цвет посегментно по направлению (как в Pine: #05ff9b / #ff0583)
    ctx.lineWidth = 2.4;
    for (let i = Math.max(from + 1, 1); i <= Math.min(to, lastIdx); i++) {
      const col = a.rf.dir[i] > 0 ? "#05ff9b" : a.rf.dir[i] < 0 ? "#ff0583" : "#cccccc";
      ctx.beginPath();
      ctx.moveTo(X(i - 1), Y(a.rf.line[i - 1]));
      ctx.lineTo(X(i), Y(a.rf.line[i]));
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // треугольники разворотов
    for (let i = from; i <= Math.min(to, lastIdx); i++) {
      if (!a.rf.buy[i] && !a.rf.sell[i]) continue;
      const up = a.rf.buy[i];
      const x = X(i);
      const y = up ? Y(a.candles[i].l) + 12 : Y(a.candles[i].h) - 12;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x - 5, y + 4);
        ctx.lineTo(x + 5, y + 4);
      } else {
        ctx.moveTo(x, y + 5);
        ctx.lineTo(x - 5, y - 4);
        ctx.lineTo(x + 5, y - 4);
      }
      ctx.closePath();
      ctx.fillStyle = up ? "#05ff9b" : "#ff0583";
      ctx.fill();
    }

    // ★ пересечения RF × челюсть — жёлтый ромб на линии
    for (let i = from; i <= Math.min(to, lastIdx); i++) {
      if (!a.rf.jawCrossUp[i] && !a.rf.jawCrossDn[i]) continue;
      const x = X(i);
      const y = Y(a.rf.line[i]);
      const up = a.rf.jawCrossUp[i];
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fillStyle = "#ffd600";
      ctx.shadowColor = "#ffd600";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0b0f16";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(up ? "↑" : "↓", x, y + 0.5);
      ctx.textAlign = "left";
    }

    // ── 🎯 ЗОНЫ ПОДДЕРЖКИ И СОПРОТИВЛЕНИЯ ──
    const Z = S.zones;
    const z = a.zones;
    if (Z.enabled && z) {
      const hLine = (p: number, col: string, label: string, dash = false) => {
        if (!Number.isFinite(p)) return;
        ctx.setLineDash(dash ? [5, 4] : []);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, Y(p));
        ctx.lineTo(w - padR, Y(p));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(label, 6, Y(p) - 6);
      };

      // вертикали границ дня — сплошные
      if (Z.showVertical) {
        [z.dayStartIdx, z.dayEndIdx].forEach((idx, n) => {
          if (idx < from || idx > to) return;
          const x = X(idx);
          ctx.strokeStyle = Z.vertColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, plotH);
          ctx.stroke();
          // подпись времени границы
          ctx.fillStyle = Z.vertColor;
          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(n === 0 ? Z.dayStartTime : Z.dayEndTime, x, 8);
          ctx.textAlign = "left";
        });
      }

      // заливка зон: между локальным уровнем и границей диапазона
      if (Z.fillZones) {
        const op = Z.fillOpacity / 100;
        if (z.localHigh !== null) {
          ctx.fillStyle = `rgba(255,68,102,${op})`;
          const yTop = Y(Math.max(z.rangeHigh, z.localHigh));
          const yBot = Y(Math.min(z.rangeHigh, z.localHigh));
          ctx.fillRect(0, yTop, w - padR, yBot - yTop);
        }
        if (z.localLow !== null) {
          ctx.fillStyle = `rgba(0,255,136,${op})`;
          const yTop = Y(Math.max(z.rangeLow, z.localLow));
          const yBot = Y(Math.min(z.rangeLow, z.localLow));
          ctx.fillRect(0, yTop, w - padR, yBot - yTop);
        }
      }

      // границы диапазона вчерашнего дня
      if (Z.showRange) {
        hLine(z.rangeHigh, Z.rangeColor, "High-D");
        hLine(z.rangeLow, Z.rangeColor, "Low-D");
      }

      // первые локальные экстремумы за границей диапазона — сплошные
      if (Z.showLocal) {
        if (z.localHigh !== null) hLine(z.localHigh, Z.localColor, "L-High");
        if (z.localLow !== null) hLine(z.localLow, Z.localColor, "L-Low");
      }

      // маркер разворотной свечи
      const sg = a.zoneSignal;
      if (sg && sg.barIdx >= from && sg.barIdx <= Math.min(to, lastIdx)) {
        const x = X(sg.barIdx);
        const cndl = a.candles[sg.barIdx];
        const buy = sg.dir === 1;
        const y = buy ? Y(cndl.l) + 20 : Y(cndl.h) - 20;
        const col = buy ? "#00ff88" : "#ff4466";
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0b0f16";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(buy ? "B" : "S", x, y + 0.5);
        ctx.textAlign = "left";
        if (sg.pierced) {
          ctx.fillStyle = col;
          ctx.font = "bold 8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("прошил", x, buy ? y + 18 : y - 13);
          ctx.textAlign = "left";
        }
      }
    }

    // уровни сделки
    const lvl = (p: number, col: string, txt: string) => {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Y(p));
      ctx.lineTo(w - padR + 4, Y(p));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.fillRect(w - padR + 4, Y(p) - 7, 32, 14);
      ctx.fillStyle = "#0b0f16";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.fillText(txt, w - padR + 8, Y(p));
    };
    if (a.dir !== 0 && S.showTradeLevels) {
      lvl(a.stop, "#ff4466", "SL");
      lvl(a.tp1, "#00e5ff", "TP1");
      lvl(a.tp2, "#00ff88", "TP2");
    }

    // последняя цена
    const last = a.candles[a.candles.length - 1];
    if (a.candles.length - 1 <= to) {
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = "rgba(230,237,243,0.25)";
      ctx.beginPath();
      ctx.moveTo(0, Y(last.c));
      ctx.lineTo(w - padR + 4, Y(last.c));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = last.c >= last.o ? "#26a69a" : "#ef5350";
    ctx.fillRect(w - padR + 4, Y(last.c) - 8, 64, 16);
    ctx.fillStyle = "#0b0f16";
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillText(fmtPrice(last.c), w - padR + 8, Y(last.c));

    // ── ✏️ РУЧНАЯ РАЗМЕТКА ──
    for (const m of marks) {
      if (!Number.isFinite(m.price)) continue;
      const y = Y(m.price);
      if (y < 0 || y > plotH) continue;
      const col = markColor(m.kind);
      ctx.setLineDash([]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      // подпись с фоном, чтобы читалось поверх свечей
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      const label = `✏ ${m.kind}`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = col;
      ctx.fillRect(w - padR - tw - 4, y - 7, tw, 14);
      ctx.fillStyle = "#0b0f16";
      ctx.textBaseline = "middle";
      ctx.fillText(label, w - padR - tw, y);
      // точка привязки к бару
      if (m.barIdx >= from && m.barIdx <= to) {
        ctx.beginPath();
        ctx.arc(X(m.barIdx), y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }

    // ── 📈 DEMA ──
    if (S.dema.enabled && S.dema.showLine && a.dema) {
      const demaArr = a.dema.dema;
      ctx.beginPath();
      let started = false;
      for (let i = from; i <= Math.min(to, lastIdx); i++) {
        const v = demaArr[i];
        if (!Number.isFinite(v)) continue;
        const x = X(i);
        const y = Y(v);
        started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), (started = true));
      }
      ctx.strokeStyle = S.dema.lineColor;
      ctx.lineWidth = S.dema.lineWidth;
      ctx.shadowColor = S.dema.lineColor;
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // подпись справа
      const lastVal = demaArr[Math.min(to, lastIdx)];
      if (Number.isFinite(lastVal)) {
        ctx.fillStyle = S.dema.lineColor;
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(`DEMA${S.dema.length}`, w - padR - 62, Y(lastVal) - 8);
      }
    }

    // ── 🌊 ВОЛНЫ ЭЛЛИОТТА ──
    const E = S.ew;
    if (E.enabled && E.showWaves && a.ew) {
      const ew = a.ew;
      const waveCol = E.waveColor;

      // мотивная волна 12345
      if (ew.motive) {
        const m = ew.motive;
        ctx.strokeStyle = waveCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          if (m.p[k] < from - 5) continue;
          const x = X(m.p[k]);
          const y = Y(m.y[k]);
          k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.shadowColor = waveCol;
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // подписи волн
        if (E.showLabels) {
          const labels = ["1", "2", "3", "4", "5"];
          ctx.font = "bold 10px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          for (let k = 1; k <= 5; k++) {
            if (m.p[k] < from) continue;
            const isHigh = m.y[k] > m.y[k - 1];
            const x = X(m.p[k]);
            const y = Y(m.y[k]);
            ctx.fillStyle = waveCol;
            ctx.fillText(labels[k - 1], x, isHigh ? y - 10 : y + 14);
          }
          ctx.textAlign = "left";
        }
      }

      // коррекция ABC
      if (ew.abc && E.showWaves) {
        const c = ew.abc;
        ctx.strokeStyle = waveCol;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(X(c.a), Y(c.ya));
        ctx.lineTo(X(c.b), Y(c.yb));
        ctx.lineTo(X(c.c), Y(c.yc));
        ctx.stroke();
        ctx.setLineDash([]);

        if (E.showLabels) {
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          ctx.fillStyle = waveCol;
          ctx.textAlign = "center";
          ctx.fillText("a", X(c.a), c.ya > c.yb ? Y(c.ya) - 8 : Y(c.ya) + 12);
          ctx.fillText("b", X(c.b), c.yb > c.ya ? Y(c.yb) - 8 : Y(c.yb) + 12);
          ctx.fillText("c", X(c.c), c.yc > c.yb ? Y(c.yc) - 8 : Y(c.yc) + 12);
          ctx.textAlign = "left";
        }
      }

      // возможная новая волна (1) — точка разворота
      if (ew.nextOne && ew.nextOne.idx >= from && ew.nextOne.idx <= to) {
        const x = X(ew.nextOne.idx);
        const y = Y(ew.nextOne.price);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = waveCol;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = waveCol;
        ctx.fill();
        if (E.showLabels) {
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          ctx.fillStyle = waveCol;
          ctx.textAlign = "center";
          ctx.fillText("(1)", x, ew.nextOne.dir === 1 ? y + 18 : y - 14);
          ctx.textAlign = "left";
        }
      }

      // маркер пробоя бокса коррекции
      if (ew.breakBox && ew.abc) {
        const x = X(ew.abc.c);
        const y = Y(ew.abc.yc);
        ctx.font = "bold 12px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ff4466";
        ctx.textAlign = "center";
        ctx.fillText("✕", x, y - 14);
        ctx.textAlign = "left";
      }
    }

    // ── ШКАЛА ВРЕМЕНИ ──
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, plotH, w, padB);
    ctx.strokeStyle = "rgba(51,65,85,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, plotH + 0.5);
    ctx.lineTo(w, plotH + 0.5);
    ctx.stroke();

    const fmtTime = (ts: number) => {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      // на дневках и выше показываем дату, иначе время
      return tf === "1d" || tf === "4h" ? `${dd}.${mo}` : `${hh}:${mm}`;
    };

    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const minGap = 62; // минимальное расстояние между подписями
    const stepBars = Math.max(1, Math.ceil(minGap / bw));
    for (let i = to; i >= from; i -= stepBars) {
      if (i > lastIdx) continue;
      const x = X(i);
      if (x < 20 || x > w - padR - 10) continue;
      ctx.strokeStyle = "rgba(51,65,85,0.35)";
      ctx.beginPath();
      ctx.moveTo(x, plotH);
      ctx.lineTo(x, plotH + 4);
      ctx.stroke();
      ctx.fillStyle = "#5d6b80";
      ctx.fillText(fmtTime(a.candles[i].t), x, plotH + 10);
    }
    ctx.textAlign = "left";

    // кроссхэйр
    if (cross && cross.i >= from && cross.i <= to) {
      const x = X(cross.i);
      const cy = Math.min(cross.y, plotH);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(200,211,224,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotH);
      ctx.moveTo(0, cy);
      ctx.lineTo(w - padR, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      const py = mn + ((plotH - cy) / plotH) * (mx - mn);
      ctx.fillStyle = "#2a3546";
      ctx.fillRect(w - padR + 4, cy - 8, 64, 16);
      ctx.fillStyle = "#e6edf3";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillText(fmtPrice(py), w - padR + 8, cy);

      // метка времени под кроссхэйром
      if (cross.i <= lastIdx) {
        const label = fmtTime(a.candles[cross.i].t);
        ctx.fillStyle = "#2a3546";
        ctx.fillRect(x - 26, plotH + 1, 52, padB - 2);
        ctx.fillStyle = "#e6edf3";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, x, plotH + 10);
        ctx.textAlign = "left";
      }
    }
  }, [a, view, cross, S, tf, marks]);

  useEffect(() => {
    const onR = () => setView((v) => ({ ...v }));
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [setView]);

  const hovered = a && cross && cross.i < a.candles.length ? a.candles[cross.i] : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b hairline px-3 py-2">
        <span className="font-mono text-xs font-bold text-[#e6edf3]">{a?.symbol ?? "—"}</span>
        <span className="rounded bg-[#2962ff]/15 px-2 py-0.5 font-mono text-[10px] text-[#8fb0ff]">{tf}</span>
        <span className="hidden font-mono text-[10px] text-[#5d6b80] sm:inline">⚡ RF + СВГ</span>

        {hovered && (
          <span className="hidden gap-2 font-mono text-[9.5px] text-[#8b98ab] md:flex">
            <span>O {fmtPrice(hovered.o)}</span>
            <span>H {fmtPrice(hovered.h)}</span>
            <span>L {fmtPrice(hovered.l)}</span>
            <span className={hovered.c >= hovered.o ? "text-[#26a69a]" : "text-[#ef5350]"}>C {fmtPrice(hovered.c)}</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => zoom(-1)} className="rounded bg-[#161b22] p-1 text-[#8b98ab] hover:text-[#e6edf3]" title="Отдалить">
            <Minus size={11} />
          </button>
          <button onClick={() => zoom(1)} className="rounded bg-[#161b22] p-1 text-[#8b98ab] hover:text-[#e6edf3]" title="Приблизить">
            <Plus size={11} />
          </button>
          <button
            onClick={onLoadHistory}
            disabled={histLoading}
            className="rounded bg-[#161b22] p-1 text-[#8b98ab] transition-colors hover:text-[#00e5ff] disabled:opacity-40"
            title="Загрузить историю (или прокрути график влево)"
          >
            <HistoryIcon size={11} className={histLoading ? "animate-pulse" : ""} />
          </button>
          <button onClick={reset} className="rounded bg-[#161b22] p-1 text-[#8b98ab] hover:text-[#e6edf3]" title="Сбросить вид">
            <Maximize2 size={11} />
          </button>
          {a && (
            <span
              className={`ml-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                a.rf.lastDir > 0 ? "bg-[#00ff88]/15 text-[#00ff88]" : "bg-[#ff4466]/15 text-[#ff4466]"
              }`}
            >
              {a.rf.lastDir > 0 ? "LONG" : "SHORT"} · {a.rf.barsInZone}b
            </span>
          )}
        </div>
      </div>

      <div
        ref={wrapRef}
        className={`relative min-h-[160px] flex-1 select-none ${markMode ? "cursor-copy" : "cursor-crosshair"}`}
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onClick={onClick}
        onMouseUp={onUp}
        onMouseLeave={() => {
          onUp();
          setCross(null);
          onCrosshair?.(null);
        }}
      >
        <canvas ref={ref} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/70 font-mono text-xs text-[#8b98ab]">
            загрузка свечей…
          </div>
        )}
        {!a && !loading && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-[#5d6b80]">
            выбери монету слева
          </div>
        )}
        {a && (
          <div className="pointer-events-none absolute bottom-6 left-2 flex items-center gap-1 font-mono text-[9px] text-[#3f4c60]">
            <Crosshair size={9} />
            колесо — зум · тяни — сдвиг · {view.count}/{a.candles.length} баров
          </div>
        )}
        {histLoading && (
          <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 rounded-lg border border-[#00e5ff]/40 bg-[#0d1117]/90 px-2.5 py-1 font-mono text-[9.5px] text-[#00e5ff]">
            загрузка истории…
          </div>
        )}
      </div>

    </div>
  );
}
