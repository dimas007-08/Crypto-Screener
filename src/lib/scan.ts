// ─────────────────────────────────────────────────────────────
//  Сканер: прогон монет через оба индикатора
// ─────────────────────────────────────────────────────────────

import { fetchKlines, fetchTickers, pool, TF_MAP, type Candle, type Ticker } from "./bybit";
import { analyze } from "./indicators";
import { DEFAULTS, type Settings } from "./settings";

export interface ScanRow {
  symbol: string;
  price: number;
  changePct: number;
  turnover: number;
  dir: 1 | -1 | 0;
  score: number;
  fresh: number;
  bb: number;
  p100: number;
  x: number;
  bw: number;
  bwSig: number;
  rfDir: number;
  jawTouch: boolean;
  svg: number;
  combo: boolean; // 🔥 пересечение челюсти + CCI на том же баре
  jawCross: boolean;
  rfDouble: boolean;
  macdDir: number; // 1 buy / -1 sell / 0
  macdAgo: number;
  macdFresh: boolean;
  macdDemaOk: boolean;
  macdStage1: boolean;
  macdStage2: boolean;
  macdDiv: number;
  macdDivAgo: number;
  // 🪑 приседающий бар
  squatFresh: boolean;
  squatDir: number;
  squatSeriesLen: number;
  squatAgo: number;
  squatEfiConfirm: boolean;
  adx: number;
  adxDir: number;
  adxAgo: number;
  adxFresh: boolean;
  // 🌊 Elliott Wave
  ewDir: number;
  ewLabel: string;
  ewAgo: number;
  ewFresh: boolean;
  ewBreakBox: boolean;
  // 📈 DEMA тренд
  demaDir: number;
  demaBars: number;
  demaDist: number;
  // ⚡ EFI
  efiDir: number;
  efiAngle: number;
  efiAgo: number;
  efiFresh: boolean;
  efiFreshAgo: number; // для фильтра "прошло N баров"
  // 🎯 разворот от зоны S/R
  zoneRev: number; // 1 покупка / -1 продажа / 0
  zonePierced: boolean;
  zoneConfirmed: boolean;
  zoneAgo: number;
  zoneKind: "local" | "range" | null;
  zoneRR: number;
}

export async function loadUniverse(signal?: AbortSignal): Promise<Ticker[]> {
  return fetchTickers(signal);
}

/** Достаточная история для CCI 200 + MA 68 + фильтров, но не больше лимита Bybit. */
function historyLimit(S: Settings): number {
  const cciWarmup = S.cci.length + S.cci.maLength + Math.max(S.cci.bwNormLen, S.cci.sbVolLen) + 20;
  const macdWarmup = S.macd.slowLen + S.macd.signalLen + 40;
  const adxWarmup = S.adx.diLength + S.adx.smoothing + 40;
  return Math.min(1000, Math.max(400, cciWarmup, macdWarmup, adxWarmup));
}

export async function scanMarket(
  tickers: Ticker[],
  tf: string,
  onProgress: (done: number, total: number) => void,
  S: Settings = DEFAULTS,
  signal?: AbortSignal,
): Promise<ScanRow[]> {
  const interval = TF_MAP[tf];
  const limit = historyLimit(S);
  const res = await pool(
    tickers,
    async (t) => {
      const k = await fetchKlines(t.symbol, interval, limit, { signal });
      const a = analyze(t.symbol, k, S);
      if (!a) return null;
      const row: ScanRow = {
        symbol: t.symbol,
        price: a.price,
        changePct: t.changePct,
        turnover: t.turnover,
        dir: a.dir,
        score: a.score,
        fresh: a.fresh,
        bb: a.cc.bbPct,
        p100: a.cc.p100,
        x: a.cc.xPct,
        bw: a.cc.bwPct,
        bwSig: a.cc.bwSig,
        rfDir: a.rf.lastDir,
        jawTouch: a.rf.jawTouch,
        svg: a.rf.svgBuy ? 1 : a.rf.svgSell ? -1 : 0,
        combo: a.hasJawCombo,
        jawCross: a.hasJawCross,
        rfDouble: a.hasRfDouble,
        macdDir: a.macd.dir,
        macdAgo: a.macd.ago,
        macdFresh: a.macd.isFresh,
        macdDemaOk: a.macd.demaOk,
        macdStage1: a.macd.sellStage1Bars.length > 0 || a.macd.buyStage1Bars.length > 0,
        macdStage2: a.macd.sellStage2Bars.length > 0 || a.macd.buyStage2Bars.length > 0,
        macdDiv: a.macd.divDir,
        macdDivAgo: a.macd.divAgo,
        squatFresh: a.squat.isFresh,
        squatDir: a.squat.dir,
        squatSeriesLen: a.squat.lastSeriesLen,
        squatAgo: a.squat.ago,
        squatEfiConfirm: a.squat.efiConfirm,
        adx: a.adx.lastAdx,
        adxDir: a.adx.signalDir,
        adxAgo: a.adx.signalAgo,
        adxFresh: a.adx.isFresh,
        ewDir: a.ew.dir,
        ewLabel: a.ew.waveLabel,
        ewAgo: a.ew.ago,
        ewFresh: a.ew.isFresh,
        ewBreakBox: a.ew.breakBox,
        demaDir: a.dema.dir,
        demaBars: a.dema.barsOnSide,
        demaDist: a.dema.distPct,
        efiDir: a.efi.dir,
        efiAngle: a.efi.angle ?? 0,
        efiAgo: a.efi.ago,
        efiFresh: a.efi.isFresh,
        efiFreshAgo: a.efi.ago,
        zoneRev: a.zoneSignal?.dir ?? 0,
        zonePierced: a.zoneSignal?.pierced ?? false,
        zoneConfirmed: a.zoneSignal?.confirmed ?? false,
        zoneAgo: a.zoneSignal?.barsAgo ?? 999,
        zoneKind: a.zoneSignal?.levelKind ?? null,
        zoneRR: a.zoneSignal?.rr ?? 0,
      };
      return row;
    },
    6,
    onProgress,
    signal,
  );
  return res.filter((r): r is ScanRow => r !== null);
}

/** Детальный разбор: после удаления MTF-таблиц нужна только серия выбранного ТФ. */
export async function deepAnalyze(
  symbol: string,
  tf: string,
  S: Settings = DEFAULTS,
  signal?: AbortSignal,
) {
  const main = await fetchKlines(symbol, TF_MAP[tf], historyLimit(S), {
    signal,
    cacheMs: 2_500,
  });
  const a = analyze(symbol, main, S);
  return { a };
}

/**
 * Подгрузка более старых свечей и пересчёт индикаторов на объединённой серии.
 * Возвращает новый анализ и количество добавленных баров.
 */
export async function loadHistory(
  symbol: string,
  tf: string,
  existing: Candle[],
  signal?: AbortSignal,
  chunk = 400,
): Promise<{ candles: Candle[]; added: number }> {
  if (!existing.length) return { candles: existing, added: 0 };
  const oldest = existing[0].t;
  const older = await fetchKlines(symbol, TF_MAP[tf], chunk, { signal }, oldest - 1);
  if (!older.length) return { candles: existing, added: 0 };

  // склеиваем без дублей по времени
  const seen = new Set(existing.map((c) => c.t));
  const fresh = older.filter((c) => !seen.has(c.t));
  if (!fresh.length) return { candles: existing, added: 0 };

  const merged = [...fresh, ...existing].sort((x, y) => x.t - y.t);
  // ограничиваем историю, чтобы не раздувать память
  const MAX = 3000;
  const trimmed = merged.length > MAX ? merged.slice(merged.length - MAX) : merged;
  return { candles: trimmed, added: trimmed.length - existing.length };
}
