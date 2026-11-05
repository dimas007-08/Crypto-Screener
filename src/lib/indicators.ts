// ─────────────────────────────────────────────────────────────
//  Порт индикаторов на TypeScript — расчёты 1-в-1 с Pine
//   • RF + СВГ lite   (Range Filter, Аллигатор, свинг+хвост, RF→Jaw)
//   • CCI + BB MTF    (CCI, MA, полосы BB, BB%, ±100, X, BW, импульс)
// ─────────────────────────────────────────────────────────────

import type { Candle } from "./bybit";
import { DEFAULTS, type Settings } from "./settings";
import { computeEW, type EWResult } from "./elliott";

// ── ⚡ EFI (Elder Force Index) ───────────────────────────────
export interface EFIResult {
  efi: number[];
  /** 1 = всплеск вверх, -1 = вниз, 0 = нет */
  dir: number;
  isFresh: boolean;
  lastEfi: number;
  /** текущий угол наклона EFI к нулю в градусах */
  angle: number | null;
  ago: number;
  /** найденные всплески: { индекс, направление, угол } */
  spikes: { i: number; dir: 1 | -1; angle: number }[];
}

export function computeEFI(candles: Candle[], S: Settings): EFIResult {
  const n = candles.length;
  const raw = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    raw[i] = (candles[i].c - candles[i - 1].c) * candles[i].v;
  }
  const efi = emaArr(raw, S.efi.length);

  const i = n - 1;
  const lastEfi = Number.isFinite(efi[i]) ? efi[i] : 0;
  const dir = lastEfi > 0 ? 1 : lastEfi < 0 ? -1 : 0;

  // Угол наклона EFI к нулю: atan(ΔEFI / Δбар) в градусах.
  // Нормализуем по среднему |EFI| чтобы масштаб не влиял.
  const absAvg =
    efi.filter(Number.isFinite).reduce((s, v) => s + Math.abs(v), 0) / Math.max(1, efi.filter(Number.isFinite).length) || 1;

  const angleAt = (idx: number): number | null => {
    if (idx < 1 || !Number.isFinite(efi[idx]) || !Number.isFinite(efi[idx - 1])) return null;
    const delta = efi[idx] - efi[idx - 1];
    return Math.abs((Math.atan((delta / absAvg) / 1) * 180) / Math.PI);
  };

  // поиск всплесков: EFI отходит от нуля под острым углом
  const spikes: { i: number; dir: 1 | -1; angle: number }[] = [];
  for (let k = Math.max(1, n - 1 - 60); k <= i; k++) {
    const ang = angleAt(k);
    if (ang === null || ang < S.efi.angleMin) continue;
    // EFI должен отходить от нуля, а не возвращаться к нему
    const movingAway = Math.abs(efi[k]) > Math.abs(efi[k - 1]);
    if (!movingAway) continue;
    const d = efi[k] > 0 ? 1 : -1;
    // не дублируем одно направление подряд
    const last = spikes[spikes.length - 1];
    if (last && last.dir === d && k - last.i < 3) continue;
    spikes.push({ i: k, dir: d, angle: ang });
  }

  const lastSpike = spikes[spikes.length - 1];
  const ago = lastSpike ? i - lastSpike.i : 9999;

  return {
    efi,
    dir,
    isFresh: S.efi.enabled && !!lastSpike && ago <= S.efi.freshBars,
    lastEfi,
    angle: angleAt(i),
    ago,
    spikes,
  };
}

// ── 📈 DEMA ──────────────────────────────────────────────────
export interface DEMAResult {
  dema: number[];
  /** 1 = цена выше DEMA (покупка), -1 = ниже (продажа), 0 = нет данных */
  dir: number;
  isFresh: boolean;
  lastDema: number;
  lastPrice: number;
  /** сколько баров цена держится по одну сторону */
  barsOnSide: number;
  /** расстояние до линии в процентах от цены */
  distPct: number;
}

/** DEMA = 2·EMA − EMA(EMA) */
export function computeDEMA(candles: Candle[], S: Settings): DEMAResult {
  const n = candles.length;
  const close = candles.map((c) => c.c);
  const len = S.dema.length;

  const e1 = emaArr(close, len);
  const e2 = emaArr(e1, len);
  const dema = e1.map((v, i) => 2 * v - e2[i]);

  const i = n - 1;
  const price = close[i];
  const d = dema[i];
  const dir = price > d ? 1 : price < d ? -1 : 0;

  // сколько баров подряд цена по одну сторону
  let barsOnSide = 0;
  for (let k = i; k >= 0; k--) {
    const side = close[k] > dema[k] ? 1 : close[k] < dema[k] ? -1 : 0;
    if (side === dir && dir !== 0) barsOnSide++;
    else break;
  }

  const distPct = d !== 0 ? ((price - d) / Math.abs(d)) * 100 : 0;

  return {
    dema,
    dir,
    isFresh: S.dema.enabled && dir !== 0,
    lastDema: d,
    lastPrice: price,
    barsOnSide,
    distPct,
  };
}
import { computeZones, type ReversalSignal, type ZoneSetup } from "./zones";

// ── базовые серии ────────────────────────────────────────────
const NA = NaN;

export function smaArr(src: number[], len: number): number[] {
  const out = new Array(src.length).fill(NA);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    if (i >= len) sum -= src[i - len];
    if (i >= len - 1) out[i] = sum / len;
  }
  return out;
}

export function emaArr(src: number[], len: number): number[] {
  const out = new Array(src.length).fill(NA);
  const k = 2 / (len + 1);
  let prev = NA;
  for (let i = 0; i < src.length; i++) {
    prev = Number.isNaN(prev) ? src[i] : (src[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

export function rmaArr(src: number[], len: number): number[] {
  const out = new Array(src.length).fill(NA);
  let prev = NA;
  for (let i = 0; i < src.length; i++) {
    prev = Number.isNaN(prev) ? src[i] : (prev * (len - 1) + src[i]) / len;
    out[i] = prev;
  }
  return out;
}

/** ta.stdev — популяционное отклонение */
export function stdevArr(src: number[], len: number): number[] {
  const out = new Array(src.length).fill(NA);
  for (let i = len - 1; i < src.length; i++) {
    let m = 0;
    for (let j = i - len + 1; j <= i; j++) m += src[j];
    m /= len;
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) s += (src[j] - m) ** 2;
    out[i] = Math.sqrt(s / len);
  }
  return out;
}

/** ta.dev — среднее абсолютное отклонение (для CCI) */
export function devArr(src: number[], len: number): number[] {
  const out = new Array(src.length).fill(NA);
  for (let i = len - 1; i < src.length; i++) {
    let m = 0;
    for (let j = i - len + 1; j <= i; j++) m += src[j];
    m /= len;
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) s += Math.abs(src[j] - m);
    out[i] = s / len;
  }
  return out;
}

export function atrArr(c: Candle[], len = 14): number[] {
  const tr = c.map((k, i) =>
    i === 0 ? k.h - k.l : Math.max(k.h - k.l, Math.abs(k.h - c[i - 1].c), Math.abs(k.l - c[i - 1].c)),
  );
  return rmaArr(tr, len);
}

const highest = (a: number[], len: number, i: number) => {
  let m = -Infinity;
  for (let j = Math.max(0, i - len + 1); j <= i; j++) m = Math.max(m, a[j]);
  return m;
};
const lowest = (a: number[], len: number, i: number) => {
  let m = Infinity;
  for (let j = Math.max(0, i - len + 1); j <= i; j++) m = Math.min(m, a[j]);
  return m;
};

// ── ⚡ RANGE FILTER + СВГ ─────────────────────────────────────
export interface RFResult {
  line: number[];
  dir: number[]; // 1 / -1
  buy: boolean[]; // разворот вверх
  sell: boolean[];
  jaw: number[];
  teeth: number[];
  lips: number[];
  // снимок последнего бара
  lastDir: number;
  barsInZone: number; // сколько баров держится направление
  zonePct: number; // 0..100 насыщенность зоны
  jawDistPct: number | null; // расстояние RF→Jaw, 0 = касание
  jawTouch: boolean;
  jawTouchFresh: boolean;
  svgBuy: boolean;
  svgSell: boolean;
  svgBarsAgo: number;
  svgMovePct: number; // ход от экстремума по фитилям
  // ★ RF × челюсть Аллигатора
  jawCrossUp: boolean[]; // RF пересёк синюю линию снизу вверх
  jawCrossDn: boolean[];
  jawCrossDir: number; // направление последнего пересечения
  jawCrossAgo: number; // сколько баров назад
  // ★ двойная метка RF: разворот линии + подтверждение ценой
  rfDoubleDir: number;
  rfDoubleAgo: number;
}

export function computeRF(c: Candle[], S: Settings = DEFAULTS): RFResult {
  const per = S.rf.rngPer;
  const qty = S.rf.rngQty;
  const n = c.length;
  const src = c.map((k) => k.c);
  const hl2 = c.map((k) => (k.h + k.l) / 2);

  // размер диапазона: ema(ema(|Δsrc|, per), per*2-1) * qty
  const dSrc = src.map((v, i) => (i === 0 ? 0 : Math.abs(v - src[i - 1])));
  const avrng = emaArr(dSrc, per);
  const rArr = emaArr(avrng, per * 2 - 1).map((v) => v * qty);

  const line = new Array(n).fill(NA);
  const dir = new Array(n).fill(0);
  const buy = new Array(n).fill(false);
  const sell = new Array(n).fill(false);

  let rf = src[0];
  let d = 0;
  let condIni = 0;
  let barsZone = 0;

  for (let i = 0; i < n; i++) {
    const r = rArr[i];
    const prevRf = rf;
    if (src[i] - r > prevRf) rf = src[i] - r;
    if (src[i] + r < prevRf) rf = src[i] + r;
    line[i] = rf;

    const prevD = d;
    if (rf > prevRf) d = 1;
    else if (rf < prevRf) d = -1;
    dir[i] = d;
    barsZone = d !== prevD ? 1 : barsZone + 1;

    const longCond = src[i] > rf && d === 1;
    const shortCond = src[i] < rf && d === -1;
    const prevCond = condIni;
    condIni = longCond ? 1 : shortCond ? -1 : condIni;
    buy[i] = longCond && prevCond === -1;
    sell[i] = shortCond && prevCond === 1;
  }

  // Аллигатор
  const jaw = rmaArr(hl2, S.rf.jawLen);
  const teeth = rmaArr(hl2, S.rf.teethLen);
  const lips = rmaArr(hl2, S.rf.lipsLen);
  const jawOff = S.rf.jawOff;

  // RF → Jaw (по видимому значению челюсти)
  const i = n - 1;
  const jawVis = i - jawOff >= 0 ? jaw[i - jawOff] : jaw[i];
  const onSide = (dir[i] === 1 && line[i] < jawVis) || (dir[i] === -1 && line[i] > jawVis);
  let jawDist: number | null = null;
  if (onSide && rArr[i] > 0) {
    jawDist = Math.min(100, Math.max(1, (Math.abs(line[i] - jawVis) / rArr[i]) * 100));
  } else {
    jawDist = 0; // коснулся / прошёл
  }
  // свежесть касания
  let touchBars = 0;
  for (let k = i; k >= Math.max(0, i - 6); k--) {
    const jv = k - jawOff >= 0 ? jaw[k - jawOff] : jaw[k];
    const os = (dir[k] === 1 && line[k] < jv) || (dir[k] === -1 && line[k] > jv);
    const dp = os && rArr[k] > 0 ? (Math.abs(line[k] - jv) / rArr[k]) * 100 : 0;
    if (dp < 0.5) touchBars++;
    else break;
  }

  // СВГ: свинг + хвост + тренд Аллигатора
  const swingLook = S.rf.swingLook;
  const tailPct = S.rf.tailPct;
  const moveThr = S.rf.svgMoveThr;
  const useAlli = S.rf.useAlliFilter;
  let svgBuy = false;
  let svgSell = false;
  let svgBarsAgo = 999;
  let svgMove = 0;
  // массивы выносим из цикла — иначе на скане 500 монет это O(n²) аллокаций
  const highs = c.map((x) => x.h);
  const lows = c.map((x) => x.l);
  for (let k = n - 1; k >= Math.max(0, n - 20); k--) {
    const sh = highest(highs, swingLook, k);
    const sl = lowest(lows, swingLook, k);
    const rng = c[k].h - c[k].l;
    const lower = Math.min(c[k].o, c[k].c) - c[k].l;
    const upper = c[k].h - Math.max(c[k].o, c[k].c);
    const dropW = sh > 0 ? ((sh - c[k].l) / sh) * 100 : 0;
    const riseW = sl > 0 ? ((c[k].h - sl) / sl) * 100 : 0;
    const alliUp = !useAlli || (lips[k] > teeth[k] && teeth[k] > jaw[k]);
    const alliDn = !useAlli || (lips[k] < teeth[k] && teeth[k] < jaw[k]);
    const bigDrop = sh > 0 ? ((sh - c[k].c) / sh) * 100 >= moveThr : false;
    const bigRise = sl > 0 ? ((c[k].c - sl) / sl) * 100 >= moveThr : false;
    const lowTail = rng > 0 && lower >= (tailPct / 100) * rng;
    const upTail = rng > 0 && upper >= (tailPct / 100) * rng;
    if (bigDrop && lowTail && alliDn) {
      svgBuy = true;
      svgBarsAgo = n - 1 - k;
      svgMove = dropW;
      break;
    }
    if (bigRise && upTail && alliUp) {
      svgSell = true;
      svgBarsAgo = n - 1 - k;
      svgMove = riseW;
      break;
    }
  }

  // ★ пересечение линии RF с видимой синей челюстью
  const jawCrossUp = new Array(n).fill(false);
  const jawCrossDn = new Array(n).fill(false);
  let jawCrossDir = 0;
  let jawCrossAgo = 999;
  for (let k = 1; k < n; k++) {
    const jv = k - jawOff >= 0 ? jaw[k - jawOff] : NaN;
    const jp = k - 1 - jawOff >= 0 ? jaw[k - 1 - jawOff] : NaN;
    if (Number.isNaN(jv) || Number.isNaN(jp)) continue;
    jawCrossUp[k] = line[k - 1] <= jp && line[k] > jv;
    jawCrossDn[k] = line[k - 1] >= jp && line[k] < jv;
    if (jawCrossUp[k]) {
      jawCrossDir = 1;
      jawCrossAgo = n - 1 - k;
    } else if (jawCrossDn[k]) {
      jawCrossDir = -1;
      jawCrossAgo = n - 1 - k;
    }
  }

  // ★ двойная метка RF: разворот диапазона + цена подтвердила
  let rfDoubleDir = 0;
  let rfDoubleAgo = 999;
  for (let k = n - 1; k >= Math.max(1, n - 30); k--) {
    if (buy[k] && src[k] > line[k]) {
      rfDoubleDir = 1;
      rfDoubleAgo = n - 1 - k;
      break;
    }
    if (sell[k] && src[k] < line[k]) {
      rfDoubleDir = -1;
      rfDoubleAgo = n - 1 - k;
      break;
    }
  }

  return {
    line,
    dir,
    buy,
    sell,
    jaw,
    teeth,
    lips,
    jawCrossUp,
    jawCrossDn,
    jawCrossDir,
    jawCrossAgo,
    rfDoubleDir,
    rfDoubleAgo,
    lastDir: dir[i],
    barsInZone: barsZone,
    zonePct: Math.min(100, Math.max(5, (barsZone * 100) / S.rf.zoneBarsMax)),
    jawDistPct: jawDist,
    jawTouch: (jawDist ?? 99) < 0.5,
    jawTouchFresh: touchBars > 0 && touchBars <= S.rf.jawFreshBars,
    svgBuy,
    svgSell,
    svgBarsAgo,
    svgMovePct: svgMove,
  };
}

// ── 📊 CCI + BB ──────────────────────────────────────────────
export interface CCIResult {
  cci: number[];
  ma: number[];
  upper: number[];
  lower: number[];
  // снимок
  bbPct: number; // позиция относительно полос BB
  bbBars: number;
  p100: number; // позиция относительно ±100
  p100Bars: number;
  xPct: number; // ход от MA к границе канала (777/-777 = вышел)
  xBars: number;
  bwPct: number; // ширина канала, % шкалы (в пунктах CCI)
  bwSig: number; // 0 / 1 / -1 — импульсное расширение
  maCrossUp: boolean;
  maCrossDn: boolean;
  bbBreakUp: boolean;
  bbBreakDn: boolean;
  /** сколько баров назад было любое событие CCI (кросс MA / пробой BB / импульс BW) и его направление */
  eventAgo: number;
  eventDir: number;
}

export function computeCCI(c: Candle[], S: Settings = DEFAULTS): CCIResult {
  const len = S.cci.length;
  const maLen = S.cci.maLength;
  const mult = S.cci.bbMult;
  const bwRef = S.cci.bwRefMax;
  const n = c.length;
  const src = c.map((k) => (k.h + k.l + k.c) / 3);
  const maSrc = smaArr(src, len);
  const dev = devArr(src, len);
  const cci = src.map((v, i) => (dev[i] > 0 ? (v - maSrc[i]) / (0.015 * dev[i]) : 0));
  const ma = smaArr(cci, maLen);
  const sd = stdevArr(cci, maLen).map((v) => v * mult);
  const upper = ma.map((v, i) => v + sd[i]);
  const lower = ma.map((v, i) => v - sd[i]);
  const width = upper.map((v, i) => v - lower[i]);
  const widthAvg = smaArr(width, S.cci.bwNormLen);
  const atr = atrArr(c, 14);
  const volAvg = smaArr(c.map((k) => k.v), S.cci.sbVolLen);

  const i = n - 1;
  const pct = (v: number, ref: number) => Math.min(10 + ((v - ref) / 200) * 90, 100);

  // BB%
  const bbPct = cci[i] > upper[i] ? pct(cci[i], upper[i]) : cci[i] < lower[i] ? -pct(lower[i], cci[i]) : 0;
  // ±100
  const p100 = cci[i] > 100 ? pct(cci[i], 100) : cci[i] < -100 ? -pct(-100, cci[i]) : 0;

  const zoneBars = (test: (k: number) => number) => {
    const cur = Math.sign(test(i));
    if (cur === 0) return 0;
    let b = 0;
    for (let k = i; k >= 0; k--) {
      if (Math.sign(test(k)) !== cur) break;
      b++;
    }
    return b * cur;
  };
  const bbBars = zoneBars((k) => (cci[k] > upper[k] ? 1 : cci[k] < lower[k] ? -1 : 0));
  const p100Bars = zoneBars((k) => (cci[k] > 100 ? 1 : cci[k] < -100 ? -1 : 0));

  // X: пересечение CCI × MA с обнулением при выходе из канала
  let state = 0;
  let xDir = 0;
  let xBars = 0;
  let out = 0;
  for (let k = 1; k < n; k++) {
    const xUp = cci[k - 1] <= ma[k - 1] && cci[k] > ma[k];
    const xDn = cci[k - 1] >= ma[k - 1] && cci[k] < ma[k];
    if (xUp) {
      state = 1;
      xDir = 1;
      xBars = 1;
      out = 0;
    } else if (xDn) {
      state = -1;
      xDir = -1;
      xBars = 1;
      out = 0;
    } else if (xDir !== 0) xBars++;

    if (state === 1) {
      if (cci[k] > upper[k]) {
        out = 777;
        state = 0;
      } else if (cci[k] < ma[k]) {
        state = 0;
        out = 0;
        xDir = 0;
        xBars = 0;
      }
    } else if (state === -1) {
      if (cci[k] < lower[k]) {
        out = -777;
        state = 0;
      } else if (cci[k] > ma[k]) {
        state = 0;
        out = 0;
        xDir = 0;
        xBars = 0;
      }
    }
    if (out === 777 && cci[k] < upper[k]) {
      out = 0;
      xDir = 0;
      xBars = 0;
    }
    if (out === -777 && cci[k] > lower[k]) {
      out = 0;
      xDir = 0;
      xBars = 0;
    }
  }
  let xPct = 0;
  if (out !== 0) xPct = out;
  else if (state === 1) {
    const rng = upper[i] - ma[i];
    xPct = rng > 0 ? Math.min(10 + ((cci[i] - ma[i]) / rng) * 90, 100) : 10;
  } else if (state === -1) {
    const rng = ma[i] - lower[i];
    xPct = rng > 0 ? -Math.min(10 + ((ma[i] - cci[i]) / rng) * 90, 100) : -10;
  }

  // BW: ширина канала в пунктах CCI
  const bwPct = Math.min(100, Math.max(0, (width[i] / bwRef) * 100));

  // импульсное расширение: сильный бар + объём
  let bwSig = 0;
  for (let k = i; k >= Math.max(1, i - (S.cci.bwSigHold - 1)); k--) {
    const chg = widthAvg[k] > 0 ? ((width[k] - width[k - 1]) / widthAvg[k]) * 100 : 0;
    const body = Math.abs(c[k].c - c[k].o);
    const rng = c[k].h - c[k].l;
    const strong =
      !S.cci.sbOn || (body >= S.cci.sbBodyAtr * atr[k] && rng > 0 && body / rng >= S.cci.sbBodyPct);
    const volOk = !S.cci.sbVolOn || !volAvg[k] || c[k].v >= S.cci.sbVolMult * volAvg[k];
    if (chg >= S.cci.bwSigMin && strong && volOk) {
      bwSig = c[k].c > c[k].o ? 1 : -1;
      break;
    }
  }

  // ★ последнее событие CCI: кросс MA, пробой BB или импульс BW
  let eventAgo = 999;
  let eventDir = 0;
  for (let k = i; k >= Math.max(1, i - 20); k--) {
    const xUp = cci[k - 1] <= ma[k - 1] && cci[k] > ma[k];
    const xDn = cci[k - 1] >= ma[k - 1] && cci[k] < ma[k];
    const bUp = cci[k - 1] <= upper[k - 1] && cci[k] > upper[k];
    const bDn = cci[k - 1] >= lower[k - 1] && cci[k] < lower[k];
    const chg = widthAvg[k] > 0 ? ((width[k] - width[k - 1]) / widthAvg[k]) * 100 : 0;
    const body = Math.abs(c[k].c - c[k].o);
    const rng = c[k].h - c[k].l;
    const strongBar =
      !S.cci.sbOn || (body >= S.cci.sbBodyAtr * atr[k] && rng > 0 && body / rng >= S.cci.sbBodyPct);
    const volOk = !S.cci.sbVolOn || !volAvg[k] || c[k].v >= S.cci.sbVolMult * volAvg[k];
    const impulse = chg >= S.cci.bwSigMin && strongBar && volOk;
    if (xUp || bUp || (impulse && c[k].c > c[k].o)) {
      eventAgo = i - k;
      eventDir = 1;
      break;
    }
    if (xDn || bDn || (impulse && c[k].c < c[k].o)) {
      eventAgo = i - k;
      eventDir = -1;
      break;
    }
  }

  return {
    cci,
    ma,
    upper,
    lower,
    eventAgo,
    eventDir,
    bbPct,
    bbBars,
    p100,
    p100Bars,
    xPct,
    xBars: xDir * xBars,
    bwPct,
    bwSig,
    maCrossUp: cci[i - 1] <= ma[i - 1] && cci[i] > ma[i],
    maCrossDn: cci[i - 1] >= ma[i - 1] && cci[i] < ma[i],
    bbBreakUp: cci[i - 1] <= upper[i - 1] && cci[i] > upper[i],
    bbBreakDn: cci[i - 1] >= lower[i - 1] && cci[i] < lower[i],
  };
}

// ── 🪑 SQUAT BAR (Билл Вильямс) ──────────────────────────────
export interface SquatResult {
  /** индексы баров, являющихся приседающими */
  squatBars: number[];
  /** серии из 2-3 приседающих баров подряд, с направлением */
  series: { start: number; end: number; len: number; dir: 1 | -1 }[];
  /** есть ли свежая серия (в пределах freshBars) */
  isFresh: boolean;
  /** направление последней серии: 1 вверх, -1 вниз */
  dir: number;
  /** длина последней серии */
  lastSeriesLen: number;
  /** сколько баров назад закончилась последняя серия */
  ago: number;
  /** EFI подтверждает (острый угол в ту же сторону) */
  efiConfirm: boolean;
}

export function computeSquat(candles: Candle[], S: Settings): SquatResult {
  const Q = S.squat;
  const n = candles.length;
  if (!Q.enabled || n < 30) {
    return { squatBars: [], series: [], isFresh: false, dir: 0, lastSeriesLen: 0, ago: 9999, efiConfirm: false };
  }

  // ── Логика Билла Вильямса (Profitunity) ──
  // MFI = (high - low) / volume — "эффективность" движения
  // Приседающий бар: MFI падает И объём растёт
  //   mfiDiff = roc(MFI, 1) < 0
  //   volumeDiff = roc(volume, 1) > 0
  const squatBars: number[] = [];
  for (let i = 1; i < n; i++) {
    const prevRange = candles[i - 1].h - candles[i - 1].l;
    const curRange = candles[i].h - candles[i].l;
    const prevVol = candles[i - 1].v;
    const curVol = candles[i].v;
    if (prevVol <= 0 || curVol <= 0) continue;

    const prevMfi = prevRange / prevVol;
    const curMfi = curRange / curVol;
    const mfiFalling = curMfi < prevMfi;    // эффективность падает
    const volumeRising = curVol > prevVol;   // объём растёт

    if (mfiFalling && volumeRising) squatBars.push(i);
  }

  // ищем серии из 2+ баров подряд, серия считается направленной если
  // хотя бы один бар серии закрылся выше открытия (вверх) или ниже (вниз)
  const series: { start: number; end: number; len: number; dir: 1 | -1 }[] = [];
  let curStart = -1;
  let curLen = 0;
  let curUp = 0;
  let curDn = 0;
  for (let i = 0; i < n; i++) {
    const isSquat = squatBars.includes(i);
    if (isSquat) {
      if (curStart === -1) { curStart = i; curLen = 1; curUp = 0; curDn = 0; }
      else curLen++;
      if (candles[i].c >= candles[i].o) curUp++;
      else curDn++;
    } else {
      if (curStart !== -1 && curLen >= Q.seriesLen) {
        const dir: 1 | -1 = curUp > curDn ? 1 : -1;
        series.push({ start: curStart, end: i - 1, len: curLen, dir });
      }
      curStart = -1;
      curLen = 0;
    }
  }
  if (curStart !== -1 && curLen >= Q.seriesLen) {
    const dir: 1 | -1 = curUp > curDn ? 1 : -1;
    series.push({ start: curStart, end: n - 1, len: curLen, dir });
  }

  const i = n - 1;
  const lastSeries = series[series.length - 1];
  const ago = lastSeries ? i - lastSeries.end : 9999;
  const isFresh = ago <= Q.freshBars;

  // направление последней серии + EFI-подтверждение
  const squatDir = lastSeries ? lastSeries.dir : 0;
  const efiConfirm = lastSeries
    ? lastSeries.dir === 1
      ? S.efi.enabled && computeEFI(candles, S).dir === 1
      : S.efi.enabled && computeEFI(candles, S).dir === -1
    : false;

  return {
    squatBars,
    series,
    isFresh,
    dir: squatDir,
    lastSeriesLen: lastSeries ? lastSeries.len : 0,
    ago,
    efiConfirm,
  };
}

// ── 📊 MACD ──────────────────────────────────────────────────
export interface MACDResult {
  macd: number[];
  signal: number[];
  hist: number[];
  /** бары с BUY/SELL сигналом (для треугольников на цене) */
  buyBars: number[];
  sellBars: number[];
  /** стадии на MACD-панели (кружки) */
  sellStage1Bars: number[];
  sellStage2Bars: number[];
  buyStage1Bars: number[];
  buyStage2Bars: number[];
  /** подтверждённый сигнал: обе стадии пройдены в правильном порядке */
  dir: number; // 1 buy / -1 sell / 0
  ago: number; // баров с последнего подтверждения
  isFresh: boolean;
  lastMacd: number;
  lastSignal: number;
  lastHist: number;
  /** DEMA-контекст соблюдён */
  demaOk: boolean;
  /** дивергенции: i — текущий бугорок, prevIdx — СОСЕДНИЙ предыдущий бугорок */
  bullDiv: { i: number; dir: 1 | -1; prevIdx: number }[];
  bearDiv: { i: number; dir: 1 | -1; prevIdx: number }[];
  divDir: number;
  divAgo: number;
}

export function computeMACD(c: Candle[], S: Settings = DEFAULTS): MACDResult {
  const M = S.macd;
  const n = c.length;
  const close = c.map((k) => k.c);

  const fastEma = emaArr(close, M.fastLen);
  const slowEma = emaArr(close, M.slowLen);
  const macd = fastEma.map((v, i) => v - slowEma[i]);
  const signal = emaArr(macd, M.signalLen);
  const hist = macd.map((v, i) => v - signal[i]);

  const i = n - 1;

  // ── DEMA для фильтра сигналов ──
  const demaE1 = emaArr(close, S.dema.length);
  const demaE2 = emaArr(demaE1, S.dema.length);
  const dema = demaE1.map((v, k) => 2 * v - demaE2[k]);

  // ── простая логика сигналов + DEMA-фильтр ──
  // BUY:  MACD или сигнальная пересекла 0 вверх И close > DEMA
  // SELL: MACD или сигнальная пересекла 0 вниз И close < DEMA
  const buyBars: number[] = [];
  const sellBars: number[] = [];
  const sellStage1Bars: number[] = [];
  const sellStage2Bars: number[] = [];
  const buyStage1Bars: number[] = [];
  const buyStage2Bars: number[] = [];

  let dir = 0;
  let ago = 9999;
  for (let k = i; k >= Math.max(1, i - M.freshBars); k--) {
    if (!Number.isFinite(macd[k]) || !Number.isFinite(signal[k])) continue;
    const mUp = macd[k - 1] <= 0 && macd[k] > 0;
    const mDn = macd[k - 1] >= 0 && macd[k] < 0;
    const sUp = signal[k - 1] <= 0 && signal[k] > 0;
    const sDn = signal[k - 1] >= 0 && signal[k] < 0;
    if (mUp || sUp) { dir = 1; ago = i - k; break; }
    if (mDn || sDn) { dir = -1; ago = i - k; break; }
  }

  // собираем все бары с сигналами (для треугольников и кружков)
  for (let k = 1; k < n; k++) {
    if (!Number.isFinite(macd[k]) || !Number.isFinite(signal[k]) || !Number.isFinite(dema[k])) continue;
    const mUp = macd[k - 1] <= 0 && macd[k] > 0;
    const mDn = macd[k - 1] >= 0 && macd[k] < 0;
    const sUp = signal[k - 1] <= 0 && signal[k] > 0;
    const sDn = signal[k - 1] >= 0 && signal[k] < 0;
    const aboveDema = c[k].c > dema[k];
    const belowDema = c[k].c < dema[k];
    // треугольники на графике цены
    if ((mUp || sUp) && aboveDema) buyBars.push(k);
    if ((mDn || sDn) && belowDema) sellBars.push(k);
    // кружки на MACD-панели
    if (mUp && aboveDema) buyStage1Bars.push(k);
    if (sUp && aboveDema) buyStage2Bars.push(k);
    if (mDn && belowDema) sellStage1Bars.push(k);
    if (sDn && belowDema) sellStage2Bars.push(k);
  }

  // DEMA-фильтр для текущего сигнала
  const lastDema = Number.isFinite(dema[i]) ? dema[i] : 0;
  if (dir === 1 && c[i].c < lastDema) dir = 0;
  if (dir === -1 && c[i].c > lastDema) dir = 0;
  const demaOk = dir !== 0;

  // ── дивергенции по гистограмме ──
  // Строго между СОСЕДНИМИ бугорками: каждый пик помнит своего соседа.
  const bullDiv: { i: number; dir: 1 | -1; prevIdx: number }[] = [];
  const bearDiv: { i: number; dir: 1 | -1; prevIdx: number }[] = [];

  // последний найденный бугорок каждого типа (обновляется на КАЖДОМ пике)
  let lastTopVal = NaN;
  let lastTopHi = NaN;
  let lastTopIdx = -1;
  let lastBotVal = NaN;
  let lastBotLo = NaN;
  let lastBotIdx = -1;
  const L = 2; // подтверждение пивота

  for (let k = L + 1; k < n - L; k++) {
    if (!Number.isFinite(hist[k])) continue;
    const p = k;
    let isTop = true;
    let isBot = true;
    for (let j = Math.max(0, p - L); j <= Math.min(n - 1, p + L); j++) {
      if (j === p) continue;
      if (Number.isFinite(hist[j])) {
        if (hist[j] >= hist[p]) isTop = false;
        if (hist[j] <= hist[p]) isBot = false;
      }
    }
    if (isTop) {
      // медвежья: цена выше, гистограмма ниже — сравниваем ТОЛЬКО с соседним бугорком
      if (
        !Number.isNaN(lastTopVal) &&
        lastTopIdx >= 0 &&
        c[p].h > lastTopHi &&
        hist[p] < lastTopVal &&
        hist[p] > 0
      ) {
        bearDiv.push({ i: p, dir: -1, prevIdx: lastTopIdx });
      }
      // сосед обновляется ВСЕГДА — не перескакиваем через бугорки
      lastTopVal = hist[p];
      lastTopHi = c[p].h;
      lastTopIdx = p;
    }
    if (isBot) {
      // бычья: цена ниже, гистограмма выше — сравниваем ТОЛЬКО с соседней впадиной
      if (
        !Number.isNaN(lastBotVal) &&
        lastBotIdx >= 0 &&
        c[p].l < lastBotLo &&
        hist[p] > lastBotVal &&
        hist[p] < 0
      ) {
        bullDiv.push({ i: p, dir: 1, prevIdx: lastBotIdx });
      }
      lastBotVal = hist[p];
      lastBotLo = c[p].l;
      lastBotIdx = p;
    }
  }

  const lastBull = bullDiv[bullDiv.length - 1];
  const lastBear = bearDiv[bearDiv.length - 1];
  const bullAgo = lastBull ? i - lastBull.i : 9999;
  const bearAgo = lastBear ? i - lastBear.i : 9999;
  const divDir = bullAgo < bearAgo ? 1 : bearAgo < bullAgo ? -1 : 0;
  const divAgo = Math.min(bullAgo, bearAgo);

  return {
    macd,
    signal,
    hist,
    buyBars,
    sellBars,
    sellStage1Bars,
    sellStage2Bars,
    buyStage1Bars,
    buyStage2Bars,
    dir,
    ago,
    isFresh: M.enabled && dir !== 0 && ago <= M.freshBars,
    lastMacd: Number.isFinite(macd[i]) ? macd[i] : 0,
    lastSignal: Number.isFinite(signal[i]) ? signal[i] : 0,
    lastHist: Number.isFinite(hist[i]) ? hist[i] : 0,
    demaOk,
    bullDiv,
    bearDiv,
    divDir,
    divAgo,
  };
}

// ── 📶 ADX / DMI ─────────────────────────────────────────────
export interface ADXResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  level: number;
  /** 1 = сильное движение вверх, -1 = вниз, 0 = нет свежего пробоя */
  signalDir: number;
  signalAgo: number;
  isFresh: boolean;
  currentDir: number;
  lastAdx: number;
  lastPlusDI: number;
  lastMinusDI: number;
  aboveLevel: boolean;
}

/** Wilder RMA с SMA-инициализацией, как ta.rma в Pine. */
function wilderRma(src: number[], len: number): number[] {
  const out = new Array(src.length).fill(NA);
  if (len <= 0 || src.length < len) return out;
  let seed = 0;
  for (let i = 0; i < len; i++) seed += Number.isFinite(src[i]) ? src[i] : 0;
  out[len - 1] = seed / len;
  for (let i = len; i < src.length; i++) {
    const v = Number.isFinite(src[i]) ? src[i] : 0;
    out[i] = (out[i - 1] * (len - 1) + v) / len;
  }
  return out;
}

/** Wilder RMA, начинающийся с первого валидного индекса серии. */
function wilderRmaFrom(src: number[], len: number, start: number): number[] {
  const out = new Array(src.length).fill(NA);
  const seedIndex = start + len - 1;
  if (start < 0 || len <= 0 || seedIndex >= src.length) return out;
  let seed = 0;
  for (let i = start; i <= seedIndex; i++) seed += Number.isFinite(src[i]) ? src[i] : 0;
  out[seedIndex] = seed / len;
  for (let i = seedIndex + 1; i < src.length; i++) {
    const value = Number.isFinite(src[i]) ? src[i] : 0;
    out[i] = (out[i - 1] * (len - 1) + value) / len;
  }
  return out;
}

export function computeADX(c: Candle[], S: Settings = DEFAULTS): ADXResult {
  const A = S.adx;
  const n = c.length;
  const tr = new Array(n).fill(0);
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const upMove = c[i].h - c[i - 1].h;
    const downMove = c[i - 1].l - c[i].l;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(
      c[i].h - c[i].l,
      Math.abs(c[i].h - c[i - 1].c),
      Math.abs(c[i].l - c[i - 1].c),
    );
  }
  if (n > 0) tr[0] = c[0].h - c[0].l;

  const smoothTR = wilderRma(tr, A.diLength);
  const smoothPlus = wilderRma(plusDM, A.diLength);
  const smoothMinus = wilderRma(minusDM, A.diLength);
  const plusDI = new Array(n).fill(NA);
  const minusDI = new Array(n).fill(NA);
  const dx = new Array(n).fill(NA);

  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(smoothTR[i]) || smoothTR[i] <= 0) continue;
    plusDI[i] = (100 * smoothPlus[i]) / smoothTR[i];
    minusDI[i] = (100 * smoothMinus[i]) / smoothTR[i];
    const sum = plusDI[i] + minusDI[i];
    dx[i] = sum > 0 ? (100 * Math.abs(plusDI[i] - minusDI[i])) / sum : 0;
  }

  // ADX начинается со среднего первых `smoothing` валидных значений DX.
  const firstDx = dx.findIndex(Number.isFinite);
  const adx = wilderRmaFrom(dx, A.smoothing, firstDx);

  let signalDir = 0;
  let signalAgo = 9999;
  for (let i = 1; i < n; i++) {
    if (!Number.isFinite(adx[i - 1]) || !Number.isFinite(adx[i])) continue;
    const crossed = adx[i - 1] <= A.level && adx[i] > A.level;
    if (crossed) {
      signalDir = plusDI[i] >= minusDI[i] ? 1 : -1;
      signalAgo = n - 1 - i;
    }
  }

  const i = n - 1;
  const lastAdx = Number.isFinite(adx[i]) ? adx[i] : 0;
  const lastPlusDI = Number.isFinite(plusDI[i]) ? plusDI[i] : 0;
  const lastMinusDI = Number.isFinite(minusDI[i]) ? minusDI[i] : 0;

  return {
    adx,
    plusDI,
    minusDI,
    level: A.level,
    signalDir,
    signalAgo,
    isFresh: A.enabled && signalAgo <= A.freshBars,
    currentDir: lastPlusDI >= lastMinusDI ? 1 : -1,
    lastAdx,
    lastPlusDI,
    lastMinusDI,
    aboveLevel: lastAdx > A.level,
  };
}

// ── 🎯 СВОДНЫЙ АНАЛИЗ И СКОРИНГ ──────────────────────────────
export interface Analysis {
  symbol: string;
  price: number;
  dir: 1 | -1 | 0;
  score: number; // 0..100 уверенность
  fresh: number; // баров с момента ключевого триггера
  /** ★ метки сильных комбинаций */
  hasRfDouble: boolean;
  hasJawCross: boolean;
  hasJawCombo: boolean; // пересечение челюсти + подтверждение CCI на том же баре
  hasMacdDiv: boolean; // дивергенция MACD по направлению
  hasAdx: boolean; // свежий выход ADX выше уровня по направлению
  hasEw: boolean; // свежая структура волн Эллиотта по направлению
  hasDema: boolean; // цена по нужную сторону DEMA
  hasEfi: boolean; // острый угол EFI по направлению
  hasZoneRev: boolean; // разворот от зоны S/R
  zones: ZoneSetup | null;
  zoneSignal: ReversalSignal | null;
  reasons: { text: string; ok: boolean; w: number }[];
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  rr: number;
  atr: number;
  rf: RFResult;
  cc: CCIResult;
  macd: MACDResult;
  adx: ADXResult;
  ew: EWResult;
  dema: DEMAResult;
  efi: EFIResult;
  squat: SquatResult;
  candles: Candle[];
}

export function analyze(symbol: string, candles: Candle[], S: Settings = DEFAULTS): Analysis | null {
  if (candles.length < 80) return null;
  const rf = computeRF(candles, S);
  const cc = computeCCI(candles, S);
  const macd = computeMACD(candles, S);
  const adx = computeADX(candles, S);
  const ew = computeEW(candles, S);
  const dema = computeDEMA(candles, S);
  const efi = computeEFI(candles, S);
  const squat = computeSquat(candles, S);
  const zr = computeZones(candles, S);
  const atr = atrArr(candles, 14);
  const i = candles.length - 1;
  const price = candles[i].c;
  const a = atr[i] || price * 0.01;

  // направление: голос RF + CCI
  const rfDir = rf.lastDir;
  const cciDir = Math.sign(cc.bbPct || cc.p100 || cc.xPct);
  const svgDir = rf.svgBuy ? 1 : rf.svgSell ? -1 : 0;
  // комбо-сигналы весят вдвое при определении направления
  const comboVote =
    (rf.rfDoubleDir !== 0 && rf.rfDoubleAgo <= S.sig.maxBarsAgo ? rf.rfDoubleDir * 2 : 0) +
    (rf.jawCrossDir !== 0 && rf.jawCrossAgo <= S.sig.maxBarsAgo ? rf.jawCrossDir * 2 : 0);
  const macdVote = macd.isFresh ? macd.dir * 2 : 0;
  const adxVote = adx.isFresh ? adx.signalDir * 2 : 0;
  const ewVote = ew.isFresh ? ew.dir * 2 : 0;
  const demaVote = dema.isFresh ? dema.dir : 0;
  const efiVote = efi.isFresh ? efi.dir : 0;
  const squatVote = squat.isFresh ? (candles[candles.length - 1].c > candles[candles.length - 1].o ? 1 : -1) : 0;
  // разворот от зоны — сильный голос (×2), прошивка уровня усиливает ещё
  const zoneVote = zr.signal ? zr.signal.dir * (zr.signal.pierced ? 3 : 2) : 0;
  const votes =
    rfDir +
    cciDir +
    (cc.bwSig || 0) +
    svgDir +
    comboVote +
    macdVote +
    adxVote +
    ewVote +
    demaVote +
    efiVote +
    squatVote +
    zoneVote;
  const dir: 1 | -1 | 0 = votes > 0 ? 1 : votes < 0 ? -1 : 0;

  // ★ комбо-условия с ограничением по свежести
  const maxAgo = S.sig.maxBarsAgo;
  const win = S.sig.comboWindow;
  const rfDouble = rf.rfDoubleDir !== 0 && rf.rfDoubleAgo <= maxAgo;
  const jawCross = rf.jawCrossDir !== 0 && rf.jawCrossAgo <= maxAgo;
  const cciConfirm = cc.eventDir !== 0 && Math.abs(cc.eventAgo - rf.jawCrossAgo) <= win;
  const jawCombo = jawCross && cciConfirm && cc.eventDir === rf.jawCrossDir;

  const R: { text: string; ok: boolean; w: number }[] = [];
  const add = (text: string, ok: boolean, w: number) => R.push({ text, ok, w });

  add(`Range Filter ${rfDir > 0 ? "вверх" : "вниз"}`, rfDir === dir && dir !== 0, S.w.rfDir);
  add("Свежий разворот RF (<10 баров)", rfDir === dir && rf.barsInZone <= 10, S.w.rfFresh);
  add(`СВГ сигнал ${rf.svgBuy ? "BUY" : rf.svgSell ? "SELL" : "—"}`, svgDir === dir && dir !== 0 && rf.svgBarsAgo <= 5, S.w.svg);
  add("RF коснулся челюсти (0%)", rf.jawTouch, S.w.jaw);
  add("Пробой полос BB", Math.sign(cc.bbPct) === dir && Math.abs(cc.bbPct) >= 10, S.w.bb);
  add("Зона ±100", Math.sign(cc.p100) === dir && Math.abs(cc.p100) >= 10, S.w.p100);
  add("CCI × MA по направлению", Math.sign(cc.xPct) === dir && Math.abs(cc.xPct) !== 777, S.w.x);
  add("Импульсное расширение BB + объём", cc.bwSig === dir && dir !== 0, S.w.bw);
  add(`★ Двойная метка RF (${rf.rfDoubleAgo <= 99 ? rf.rfDoubleAgo + "b" : "—"})`, rfDouble && rf.rfDoubleDir === dir, S.w.rfDouble);
  add(`★ RF пересёк челюсть (${rf.jawCrossAgo <= 99 ? rf.jawCrossAgo + "b" : "—"})`, jawCross && rf.jawCrossDir === dir, S.w.jawCross);
  add("🔥 Пересечение + CCI на том же баре", jawCombo && rf.jawCrossDir === dir, S.w.jawCombo);
  add(
    `📊 MACD ${macd.dir === 1 ? "BUY" : macd.dir === -1 ? "SELL" : "—"}${macd.isFresh ? ` (${macd.ago}b)` : ""}`,
    macd.isFresh && macd.dir === dir && dir !== 0,
    S.w.macdDiv,
  );
  add(
    `📶 ADX > ${S.adx.level} ${adx.signalDir === 1 ? "вверх" : adx.signalDir === -1 ? "вниз" : "—"}${adx.isFresh ? ` (${adx.signalAgo}b)` : ""}`,
    adx.isFresh && adx.signalDir === dir && dir !== 0,
    S.w.adx,
  );
  add(
    `🌊 Elliott ${ew.waveLabel}${ew.motive ? (ew.motive.dir === 1 ? " бычья" : " медвежья") : ""}${ew.isFresh ? ` (${ew.ago}b)` : ""}`,
    ew.isFresh && ew.dir === dir && dir !== 0,
    S.w.ew,
  );
  add(
    `📈 Цена ${dema.dir === 1 ? "выше" : dema.dir === -1 ? "ниже" : "на"} DEMA ${S.dema.length}${dema.barsOnSide > 0 ? ` (${dema.barsOnSide}b)` : ""}`,
    dema.isFresh && dema.dir === dir && dir !== 0,
    S.w.dema,
  );
  add(
    zr.signal
      ? `🎯 Разворот от ${zr.signal.levelKind === "local" ? "локального" : "границы"}${zr.signal.pierced ? " (прошил)" : ""} · ${zr.signal.barsAgo}b`
      : "🎯 Разворот от зоны S/R",
    !!zr.signal && dir !== 0 && zr.signal.dir === dir,
    S.w.zoneRev,
  );

  const maxW = R.reduce((s, r) => s + r.w, 0) || 1;
  const raw = R.filter((r) => r.ok).reduce((s, r) => s + r.w, 0);
  const score = Math.round((raw / maxW) * 100);

  // свежесть — минимальное число баров с последнего триггера
  const cands = [
    rf.barsInZone,
    rf.svgBarsAgo,
    rf.jawCrossAgo,
    rf.rfDoubleAgo,
    cc.eventAgo,
    macd.ago,
    adx.signalAgo,
    zr.signal ? zr.signal.barsAgo || 1 : 999,
    Math.abs(cc.bbBars) || 999,
    cc.bwSig !== 0 ? 1 : 999,
  ].filter((v) => v > 0);
  const fresh = Math.min(...cands, 999);

  // точки входа
  const entry = price;
  let swingLow = Infinity;
  let swingHigh = -Infinity;
  for (let k = Math.max(0, i - 9); k <= i; k++) {
    swingLow = Math.min(swingLow, candles[k].l);
    swingHigh = Math.max(swingHigh, candles[k].h);
  }
  // Если есть разворот от зоны — приоритет его уровням:
  // стоп за экстремумом свечи, тейк до противоположной границы диапазона
  let stop: number;
  let tp1: number;
  let tp2: number;

  if (zr.signal && dir !== 0 && zr.signal.dir === dir) {
    stop = zr.signal.stop;
    const risk = Math.abs(entry - stop) || a;
    tp2 = zr.signal.target;
    tp1 = dir === 1 ? Math.min(entry + risk * S.tp1R, tp2) : Math.max(entry - risk * S.tp1R, tp2);
  } else {
    stop =
      dir === 1
        ? Math.min(swingLow, rf.line[i]) - a * S.slAtrMult
        : dir === -1
          ? Math.max(swingHigh, rf.line[i]) + a * S.slAtrMult
          : entry - a;
    const risk = Math.abs(entry - stop) || a;
    tp1 = dir === -1 ? entry - risk * S.tp1R : entry + risk * S.tp1R;
    tp2 = dir === -1 ? entry - risk * S.tp2R : entry + risk * S.tp2R;
  }

  return {
    symbol,
    price,
    dir,
    score,
    fresh,
    hasRfDouble: rfDouble && rf.rfDoubleDir === dir,
    hasJawCross: jawCross && rf.jawCrossDir === dir,
    hasJawCombo: jawCombo && rf.jawCrossDir === dir,
    hasMacdDiv: macd.divDir !== 0 && macd.divAgo <= S.macd.freshBars && macd.divDir === dir && dir !== 0,
    hasAdx: adx.isFresh && adx.signalDir === dir && dir !== 0,
    hasEw: ew.isFresh && ew.dir === dir && dir !== 0,
    hasDema: dema.isFresh && dema.dir === dir && dir !== 0,
    hasEfi: efi.isFresh && efi.dir === dir && dir !== 0,
    hasZoneRev: !!zr.signal && dir !== 0 && zr.signal.dir === dir,
    zones: zr.setup,
    zoneSignal: zr.signal,
    reasons: R,
    entry,
    stop,
    tp1,
    tp2,
    rr: S.tp2R,
    atr: a,
    rf,
    cc,
    macd,
    adx,
    ew,
    dema,
    efi,
    squat,
    candles,
  };
}
