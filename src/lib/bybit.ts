// ─────────────────────────────────────────────────────────────
//  Bybit V5 public API — фьючерсы USDT.P (category=linear)
// ─────────────────────────────────────────────────────────────

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Ticker {
  symbol: string;
  last: number;
  changePct: number; // 24h %
  turnover: number; // 24h оборот в USDT
  volume: number;
}

const BASE = "https://api.bybit.com";

// TF → значение параметра interval у Bybit
export const TF_MAP: Record<string, string> = {
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

export const TF_LIST = ["5m", "15m", "30m", "1h", "4h", "1d"] as const;
export type TF = (typeof TF_LIST)[number];

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  cacheMs?: number;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_ENTRIES = 60;

function pruneCache(): void {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  pruneCache();
  const cached = responseCache.get(path) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) responseCache.delete(path);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const abortFromParent = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromParent, { once: true });

  try {
    if (options.signal?.aborted) controller.abort();
    const r = await fetch(BASE + path, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (j.retCode !== 0) throw new Error(j.retMsg || "api error");
    const result = j.result as T;
    if ((options.cacheMs ?? 0) > 0) {
      responseCache.set(path, { value: result, expiresAt: Date.now() + options.cacheMs! });
      pruneCache();
    }
    return result;
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

/** Все бессрочные USDT-контракты с 24ч статистикой, отсортированы по обороту */
export async function fetchTickers(signal?: AbortSignal): Promise<Ticker[]> {
  const res = await api<{ list: Record<string, string>[] }>("/v5/market/tickers?category=linear", {
    signal,
    cacheMs: 15_000,
  });
  return res.list
    .filter((t) => t.symbol.endsWith("USDT"))
    .map((t) => ({
      symbol: t.symbol,
      last: parseFloat(t.lastPrice),
      changePct: parseFloat(t.price24hPcnt) * 100,
      turnover: parseFloat(t.turnover24h),
      volume: parseFloat(t.volume24h),
    }))
    .filter((t) => Number.isFinite(t.last) && t.last > 0)
    .sort((a, b) => b.turnover - a.turnover);
}

/** Свечи. Bybit отдаёт в обратном порядке — переворачиваем */
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 200,
  options: RequestOptions = {},
  /** загрузить бары СТАРШЕ этой метки времени — для подгрузки истории */
  endTime?: number,
): Promise<Candle[]> {
  const endParam = endTime ? `&end=${endTime}` : "";
  const res = await api<{ list: string[][] }>(
    `/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}${endParam}`,
    options,
  );
  return res.list
    .map((k) => ({
      t: +k[0],
      o: +k[1],
      h: +k[2],
      l: +k[3],
      c: +k[4],
      v: +k[5],
    }))
    .reverse();
}

/** Очередь с ограничением параллельности — бережём rate-limit */
export async function pool<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency = 8,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  let done = 0;

  const run = async () => {
    while (cursor < items.length && !signal?.aborted) {
      const i = cursor++;
      try {
        out[i] = await worker(items[i], i);
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) break;
        out[i] = null;
      }
      done++;
      onProgress?.(done, items.length);

      // Отдаём браузеру кадр на отрисовку и сборку мусора. Без этого сотни
      // последовательных расчётов индикаторов могут надолго заблокировать UI.
      if (done % 4 === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
  return out;
}

export function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const d = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 7;
  return v.toFixed(d);
}

export function fmtTurnover(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toFixed(0);
}
