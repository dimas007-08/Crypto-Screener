// ─────────────────────────────────────────────────────────────
//  Зоны поддержки и сопротивления
//   • Границы вчерашнего дня (вертикали) → макс/мин диапазона
//   • Первые локальные экстремумы за границей дня
//   • Разворотные сигналы от этих уровней
// ─────────────────────────────────────────────────────────────

import type { Candle } from "./bybit";
import { atrArr } from "./indicators";
import type { Settings } from "./settings";

export interface ZoneSetup {
  /** индексы вертикальных границ дня */
  dayStartIdx: number;
  dayEndIdx: number;
  dayStartTime: number;
  dayEndTime: number;
  /** границы диапазона вчерашнего дня */
  rangeHigh: number;
  rangeLow: number;
  rangeHighIdx: number;
  rangeLowIdx: number;
  /** первые локальные экстремумы ПОСЛЕ окончания дня */
  localHigh: number | null;
  localLow: number | null;
  localHighIdx: number;
  localLowIdx: number;
  /** геометрия: ширина диапазона в % и зазоры зон в % от диапазона */
  rangePct: number;
  upGapPct: number | null;
  dnGapPct: number | null;
  rangeWideOk: boolean;
  upZoneOk: boolean; // зазор High-D ↔ L-High в норме
  dnZoneOk: boolean; // зазор Low-D ↔ L-Low в норме
  ready: boolean;
}

export interface ReversalSignal {
  dir: 1 | -1; // 1 = покупка, -1 = продажа
  barIdx: number; // индекс разворотной свечи
  barsAgo: number;
  level: number; // уровень, от которого развернулись
  levelKind: "local" | "range";
  pierced: boolean; // прошила ли свеча уровень (сильный сигнал)
  tailPct: number; // доля хвоста в свече
  confirmed: boolean; // подтверждена ли двумя барами
  confirmBars: number; // сколько подтверждающих баров уже есть
  entry: number;
  stop: number;
  target: number;
  rr: number;
}

export interface ZoneResult {
  setup: ZoneSetup | null;
  signal: ReversalSignal | null;
}

/** Разбор строки "ЧЧ:ММ" → [часы, минуты] */
export function parseTime(v: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v?.trim() ?? "");
  if (!m) return [0, 0];
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return [h, mi];
}

/**
 * Метка времени указанного часа:минуты в тех же сутках.
 * ВАЖНО: считаем по ЛОКАЛЬНОМУ времени — именно оно показано на шкале
 * графика, поэтому вертикаль встаёт ровно там, где подписано 00:00.
 */
function atTime(ts: number, time: string): number {
  const [h, mi] = parseTime(time);
  const d = new Date(ts);
  d.setHours(h, mi, 0, 0);
  return d.getTime();
}

/**
 * Ищем границы «вчерашнего» дня и строим зоны.
 * Диапазон = свечи между двумя вертикалями.
 */
export function computeZones(candles: Candle[], S: Settings): ZoneResult {
  const Z = S.zones;
  if (!Z.enabled || candles.length < 30) return { setup: null, signal: null };

  const n = candles.length;
  const lastTs = candles[n - 1].t;

  // start — первая вертикаль, end — вторая.
  // Оба времени задаются как "ЧЧ:ММ" и отсчитываются от суток daysBack назад.
  const DAY = 86_400_000;
  const todayStart = atTime(lastTs, Z.dayStartTime);
  const start = todayStart - Z.daysBack * DAY;
  // вторая вертикаль ищется в следующих сутках относительно первой
  let end = atTime(start + DAY, Z.dayEndTime);
  // если получилось раньше или равно началу — переносим на сутки вперёд
  while (end <= start) end += DAY;

  // индексы вертикалей
  let dayStartIdx = -1;
  let dayEndIdx = -1;
  for (let i = 0; i < n; i++) {
    if (dayStartIdx === -1 && candles[i].t >= start) dayStartIdx = i;
    if (candles[i].t >= end) {
      dayEndIdx = i;
      break;
    }
  }
  if (dayStartIdx === -1) return { setup: null, signal: null };
  if (dayEndIdx === -1) dayEndIdx = n - 1;
  if (dayEndIdx <= dayStartIdx) return { setup: null, signal: null };

  // максимум и минимум внутри диапазона (по фитилям)
  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  let rangeHighIdx = dayStartIdx;
  let rangeLowIdx = dayStartIdx;
  for (let i = dayStartIdx; i <= dayEndIdx; i++) {
    if (candles[i].h > rangeHigh) {
      rangeHigh = candles[i].h;
      rangeHighIdx = i;
    }
    if (candles[i].l < rangeLow) {
      rangeLow = candles[i].l;
      rangeLowIdx = i;
    }
  }
  if (!Number.isFinite(rangeHigh) || !Number.isFinite(rangeLow)) {
    return { setup: null, signal: null };
  }

  // ── ПЕРВЫЕ локальные экстремумы ПОСЛЕ границы вчерашнего дня ──
  // L-High — первый пивот-максимум СТРОГО ВЫШЕ линии High-D (цена сломала верх).
  // L-Low  — первый пивот-минимум  СТРОГО НИЖЕ линии Low-D  (цена сломала низ).
  // Ищем независимо: отсутствие одного не должно мешать найти другой.
  const L = Z.pivotLen;
  const scanStart = dayEndIdx + 1;

  const isPivotHigh = (i: number): boolean => {
    if (i - L < 0 || i + L >= n) return false;
    for (let k = i - L; k <= i + L; k++) {
      if (k !== i && candles[k].h >= candles[i].h) return false;
    }
    return true;
  };
  const isPivotLow = (i: number): boolean => {
    if (i - L < 0 || i + L >= n) return false;
    for (let k = i - L; k <= i + L; k++) {
      if (k !== i && candles[k].l <= candles[i].l) return false;
    }
    return true;
  };

  let localHigh: number | null = null;
  let localHighIdx = -1;
  for (let i = scanStart; i < n - L; i++) {
    if (candles[i].h > rangeHigh && isPivotHigh(i)) {
      localHigh = candles[i].h;
      localHighIdx = i;
      break;
    }
  }

  let localLow: number | null = null;
  let localLowIdx = -1;
  for (let i = scanStart; i < n - L; i++) {
    if (candles[i].l < rangeLow && isPivotLow(i)) {
      localLow = candles[i].l;
      localLowIdx = i;
      break;
    }
  }

  // ── геометрия зон ──
  // Зазор в паре (High-D ↔ L-High) должен быть УЗКИМ,
  // а сам диапазон (High-D ↔ Low-D) — ШИРОКИМ.
  const rangeSize = rangeHigh - rangeLow;
  const rangePct = rangeLow > 0 ? (rangeSize / rangeLow) * 100 : 0;
  const upGapPct = localHigh !== null && rangeSize > 0 ? ((localHigh - rangeHigh) / rangeSize) * 100 : null;
  const dnGapPct = localLow !== null && rangeSize > 0 ? ((rangeLow - localLow) / rangeSize) * 100 : null;

  const rangeWideOk = rangePct >= Z.minRangePct;
  // Зазор влияет только на КАЧЕСТВО сигнала — линии рисуем всегда,
  // чтобы было видно структуру рынка.
  const upZoneOk = upGapPct !== null && upGapPct <= Z.maxGapPct;
  const dnZoneOk = dnGapPct !== null && dnGapPct <= Z.maxGapPct;

  const setup: ZoneSetup = {
    dayStartIdx,
    dayEndIdx,
    dayStartTime: start,
    dayEndTime: end,
    rangeHigh,
    rangeLow,
    rangeHighIdx,
    rangeLowIdx,
    localHigh,
    localLow,
    localHighIdx,
    localLowIdx,
    rangePct,
    upGapPct,
    dnGapPct,
    rangeWideOk,
    upZoneOk,
    dnZoneOk,
    ready: true,
  };

  return { setup, signal: findReversal(candles, setup, S) };
}

/**
 * Поиск разворотной свечи у одного из четырёх уровней.
 * Сильный вариант — свеча ПРОШИЛА уровень и закрылась обратно.
 */
function findReversal(candles: Candle[], z: ZoneSetup, S: Settings): ReversalSignal | null {
  const Z = S.zones;
  const n = candles.length;
  // Диапазон должен быть достаточно широким — иначе тейк не имеет смысла
  if (Z.requireWideRange && !z.rangeWideOk) return null;

  const atr = atrArr(candles, 14);
  const scanFrom = Math.max(z.dayEndIdx + 1, n - 1 - Z.lookbackBars);

  let best: ReversalSignal | null = null;
  // приоритет: прошивка локального уровня > прошивка границы > касание
  const rank = (s: ReversalSignal) =>
    (s.levelKind === "local" ? 2 : 0) + (s.pierced ? 4 : 0) - Math.min(s.barsAgo, 3) * 0.5;

  for (let i = n - 1; i >= scanFrom; i--) {
    const c = candles[i];
    const rng = c.h - c.l;
    if (rng <= 0) continue;

    const lowerTail = Math.min(c.o, c.c) - c.l;
    const upperTail = c.h - Math.max(c.o, c.c);

    // Уровни для торговли: локальный экстремум (приоритет) и граница диапазона.
    // Локальный уровень доступен только ПОСЛЕ того, как он сформирован.
    const sellLevels: { v: number; kind: "local" | "range" }[] = [];
    const buyLevels: { v: number; kind: "local" | "range" }[] = [];
    if (z.localHigh !== null && i > z.localHighIdx) sellLevels.push({ v: z.localHigh, kind: "local" });
    sellLevels.push({ v: z.rangeHigh, kind: "range" });
    if (z.localLow !== null && i > z.localLowIdx) buyLevels.push({ v: z.localLow, kind: "local" });
    buyLevels.push({ v: z.rangeLow, kind: "range" });

    const tol = atr[i] * Z.touchAtr;

    // ── ПРОДАЖА: свеча дотянулась/прошила уровень сверху и закрылась ниже ──
    for (const lv of sellLevels) {
      const touched = c.h >= lv.v - tol;
      const pierced = c.h > lv.v;
      const closedBack = c.c < lv.v;
      const tailOk = upperTail / rng >= Z.tailPct / 100;
      const bearish = c.c < c.o;
      if (touched && closedBack && tailOk && (bearish || pierced)) {
        const cand = buildSignal(candles, i, -1, lv, pierced, (upperTail / rng) * 100, z, S);
        if (!best || rank(cand) > rank(best)) best = cand;
      }
    }

    // ── ПОКУПКА: свеча дотянулась/прошила уровень снизу и закрылась выше ──
    for (const lv of buyLevels) {
      const touched = c.l <= lv.v + tol;
      const pierced = c.l < lv.v;
      const closedBack = c.c > lv.v;
      const tailOk = lowerTail / rng >= Z.tailPct / 100;
      const bullish = c.c > c.o;
      if (touched && closedBack && tailOk && (bullish || pierced)) {
        const cand = buildSignal(candles, i, 1, lv, pierced, (lowerTail / rng) * 100, z, S);
        if (!best || rank(cand) > rank(best)) best = cand;
      }
    }

    // нашли идеальный вариант — прошивка локального уровня на свежем баре
    if (best && best.pierced && best.levelKind === "local" && best.barsAgo <= Z.freshBars) break;
  }

  if (!best) return null;
  if (best.barsAgo > Z.freshBars + Z.confirmBars) return null;
  // страховка от деления на ноль
  if (body_isInvalid(best)) return null;
  return best;
}

function body_isInvalid(s: ReversalSignal): boolean {
  return !Number.isFinite(s.entry) || !Number.isFinite(s.stop) || Math.abs(s.entry - s.stop) < 1e-12;
}

/** Собираем сигнал: подтверждение двумя барами, стоп за уровнем, тейк до диапазона */
function buildSignal(
  candles: Candle[],
  idx: number,
  dir: 1 | -1,
  lv: { v: number; kind: "local" | "range" },
  pierced: boolean,
  tailPct: number,
  z: ZoneSetup,
  S: Settings,
): ReversalSignal {
  const Z = S.zones;
  const n = candles.length;
  const sig = candles[idx];
  const barsAgo = n - 1 - idx;

  // подтверждение: N уверенных баров по направлению
  let confirmBars = 0;
  for (let k = idx + 1; k <= Math.min(n - 1, idx + Z.confirmBars); k++) {
    const c = candles[k];
    const rng = c.h - c.l;
    const body = Math.abs(c.c - c.o);
    const strong = rng > 0 && body / rng >= Z.confirmBodyPct;
    const rightDir = dir === 1 ? c.c > c.o : c.c < c.o;
    if (strong && rightDir) confirmBars++;
    else break;
  }
  const confirmed = confirmBars >= Z.confirmBars;

  // вход по закрытию последнего подтверждающего бара
  const entryIdx = confirmed ? Math.min(n - 1, idx + Z.confirmBars) : n - 1;
  const entry = candles[entryIdx].c;

  // СТОП: за локальный уровень L-High / L-Low (как в ТЗ).
  // Если локального нет — за экстремум самой разворотной свечи.
  const pad = (sig.h - sig.l) * Z.stopPad;
  const stopBase =
    dir === 1
      ? z.localLow !== null
        ? Math.min(z.localLow, sig.l)
        : sig.l
      : z.localHigh !== null
        ? Math.max(z.localHigh, sig.h)
        : sig.h;
  const stop = dir === 1 ? stopBase - pad : stopBase + pad;

  // ТЕЙК: тянем до противоположной границы диапазона
  const target = dir === 1 ? z.rangeHigh : z.rangeLow;

  const risk = Math.abs(entry - stop) || 1e-9;
  const reward = Math.abs(target - entry);

  return {
    dir,
    barIdx: idx,
    barsAgo,
    level: lv.v,
    levelKind: lv.kind,
    pierced,
    tailPct,
    confirmed,
    confirmBars,
    entry,
    stop,
    target,
    rr: reward / risk,
  };
}
