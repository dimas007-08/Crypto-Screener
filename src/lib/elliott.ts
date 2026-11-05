// ─────────────────────────────────────────────────────────────
//  Elliott Wave — порт LuxAlgo без линий Фибоначчи
//   • ZigZag по пивотам
//   • Мотивные волны 12345 (бычьи/медвежьи)
//   • Коррекции ABC
//   • Поиск возможной новой волны (1)
// ─────────────────────────────────────────────────────────────

import type { Candle } from "./bybit";
import type { Settings } from "./settings";

export interface Pivot {
  idx: number;
  price: number;
  dir: 1 | -1; // 1 = вершина, -1 = впадина
}

export interface MotiveWave {
  dir: 1 | -1; // 1 = бычья 12345, -1 = медвежья
  p: [number, number, number, number, number, number]; // индексы пивотов 1..6
  y: [number, number, number, number, number, number]; // цены пивотов
  valid: boolean; // волна не сломана
  foundAgo: number; // сколько баров назад подтверждена
}

export interface AbcWave {
  dir: 1 | -1; // направление коррекции
  a: number;
  b: number;
  c: number;
  ya: number;
  yb: number;
  yc: number;
  valid: boolean;
  foundAgo: number;
}

export interface EWResult {
  pivots: Pivot[];
  motive: MotiveWave | null;
  abc: AbcWave | null;
  /** возможная новая волна (1) — потенциальная точка разворота */
  nextOne: { dir: 1 | -1; idx: number; price: number; ago: number } | null;
  /** сигнал: найдена мотивная волна или свежая ABC */
  dir: number; // 1 / -1 / 0
  ago: number;
  isFresh: boolean;
  /** текущая структура: на какой вине находимся */
  waveLabel: string; // "5", "C", "(1)", "—"
  breakBox: boolean; // пробит бокс коррекции
}

/** ZigZag: чередующиеся пивоты high/low с подтверждением справа на 1 бар. */
function buildZigZag(hi: number[], lo: number[], left: number): Pivot[] {
  const n = hi.length;
  const out: Pivot[] = [];

  for (let i = left + 1; i < n - 1; i++) {
    // вершина
    let isTop = true;
    for (let k = i - left; k <= i + 1; k++) {
      if (k !== i && hi[k] >= hi[i]) {
        isTop = false;
        break;
      }
    }
    // впадина
    let isBot = true;
    for (let k = i - left; k <= i + 1; k++) {
      if (k !== i && lo[k] <= lo[i]) {
        isBot = false;
        break;
      }
    }
    if (isTop) out.push({ idx: i, price: hi[i], dir: 1 });
    if (isBot) out.push({ idx: i, price: lo[i], dir: -1 });
  }

  // сортируем по индексу и убираем дубли одного направления,
  // оставляя экстремальный
  out.sort((a, b) => a.idx - b.idx);
  const clean: Pivot[] = [];
  for (const p of out) {
    const last = clean[clean.length - 1];
    if (!last) {
      clean.push(p);
      continue;
    }
    if (last.dir === p.dir) {
      // оставляем более экстремальный
      if (p.dir === 1 ? p.price > last.price : p.price < last.price) clean[clean.length - 1] = p;
    } else {
      clean.push(p);
    }
  }
  return clean;
}

/**
 * Проверка мотивной волны 12345 по шести пивотам.
 * Bullish: W3 не наименьшая, пик6 > пик4, пик3 > пик1, пик5 > пик2
 * Bearish: W3 не наименьшая, впад6 < впад4, впад3 < впад1, впад5 < впад2
 */
function checkMotive(y: number[], bullish: boolean): boolean {
  // y[0..5] = цены пивотов 1..6
  const W5 = bullish ? y[5] - y[4] : y[4] - y[5];
  const W3 = bullish ? y[3] - y[2] : y[2] - y[3];
  const W1 = bullish ? y[1] - y[0] : y[0] - y[1];
  const min = Math.min(W1, W3, W5);
  if (W3 === min) return false; // волна 3 не может быть наименьшей
  if (bullish) {
    return y[5] > y[3] && y[2] > y[0] && y[4] > y[1];
  }
  return y[5] < y[3] && y[2] < y[0] && y[4] < y[1];
}



export function computeEW(candles: Candle[], S: Settings): EWResult {
  const E = S.ew;
  const n = candles.length;
  if (!E.enabled || n < 40) {
    return {
      pivots: [],
      motive: null,
      abc: null,
      nextOne: null,
      dir: 0,
      ago: 9999,
      isFresh: false,
      waveLabel: "—",
      breakBox: false,
    };
  }

  const hi = candles.map((c) => c.h);
  const lo = candles.map((c) => c.l);
  const pivots = buildZigZag(hi, lo, E.pivotLen);
  const last = n - 1;

  // ── ищем мотивные волны от конца к началу ──
  let motive: MotiveWave | null = null;
  for (let end = pivots.length - 1; end >= 5; end--) {
    const slice = pivots.slice(end - 5, end + 1);
    // волна должна чередоваться: 6 пивотов, направление первой определяет тип
    // проверяем обе ориентации
    const y = slice.map((p) => p.price);
    const idx = slice.map((p) => p.idx);

    // бычья: пивоты 1(низ) 2(верх) 3(низ) 4(верх) 5(низ) 6(верх)
    const bullPattern =
      slice[0].dir === -1 && slice[1].dir === 1 && slice[2].dir === -1 && slice[3].dir === 1 && slice[4].dir === -1 && slice[5].dir === 1;
    // медвежья: зеркально
    const bearPattern =
      slice[0].dir === 1 && slice[1].dir === -1 && slice[2].dir === 1 && slice[3].dir === -1 && slice[4].dir === 1 && slice[5].dir === -1;

    if (bullPattern && checkMotive(y, true)) {
      motive = {
        dir: 1,
        p: idx as MotiveWave["p"],
        y: y as MotiveWave["y"],
        valid: true,
        foundAgo: last - slice[5].idx,
      };
      break;
    }
    if (bearPattern && checkMotive(y, false)) {
      motive = {
        dir: -1,
        p: idx as MotiveWave["p"],
        y: y as MotiveWave["y"],
        valid: true,
        foundAgo: last - slice[5].idx,
      };
      break;
    }
  }

  // ── коррекция ABC после мотивной волны ──
  let abc: AbcWave | null = null;
  if (motive) {
    const motiveEnd = { idx: motive.p[5], price: motive.y[5] };
    const tail = pivots.filter((p) => p.idx > motiveEnd.idx);
    if (tail.length >= 3) {
      const aP = tail[tail.length - 3];
      const bP = tail[tail.length - 2];
      const cP = tail[tail.length - 1];
      abc = {
        dir: motive.dir === 1 ? -1 : 1,
        a: aP.idx,
        b: bP.idx,
        c: cP.idx,
        ya: aP.price,
        yb: bP.price,
        yc: cP.price,
        valid: motive.dir === 1 ? cP.price < aP.price : cP.price > aP.price,
        foundAgo: last - cP.idx,
      };
    }
  }

  // ── возможная новая волна (1): точка разворота ──
  let nextOne: EWResult["nextOne"] = null;
  if (abc && abc.valid) {
    const lastPivot = pivots[pivots.length - 1];
    if (lastPivot) {
      // новая (1) начинается в направлении исходной мотивной волны
      nextOne = {
        dir: motive!.dir,
        idx: lastPivot.idx,
        price: lastPivot.price,
        ago: last - lastPivot.idx,
      };
    }
  }

  // ── пробой бокса коррекции ──
  let breakBox = false;
  if (abc && motive) {
    // бокс ограничен точками a и c коррекции
    const boxTop = Math.max(abc.ya, abc.yc);
    const boxBot = Math.min(abc.ya, abc.yc);
    for (let i = Math.min(n - 1, abc.c + 20); i > abc.c; i--) {
      if (motive.dir === 1 && candles[i].h > boxTop) breakBox = true;
      if (motive.dir === -1 && candles[i].l < boxBot) breakBox = true;
      if (breakBox) break;
    }
  }

  // ── итоговый сигнал ──
  const fresh = E.freshBars;
  let dir = 0;
  let ago = 9999;
  let waveLabel = "—";

  if (motive && motive.foundAgo <= fresh) {
    dir = motive.dir;
    ago = motive.foundAgo;
    waveLabel = "5";
  } else if (nextOne && nextOne.ago <= fresh) {
    dir = nextOne.dir;
    ago = nextOne.ago;
    waveLabel = "(1)";
  } else if (abc && abc.valid && abc.foundAgo <= fresh) {
    dir = abc.dir;
    ago = abc.foundAgo;
    waveLabel = "C";
  }

  return {
    pivots,
    motive,
    abc,
    nextOne,
    dir,
    ago,
    isFresh: dir !== 0 && ago <= fresh,
    waveLabel,
    breakBox,
  };
}
