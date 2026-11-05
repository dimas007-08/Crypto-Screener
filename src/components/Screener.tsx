import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Copy, FileCode, Pencil, RefreshCw, Settings2, Square, Trash2, X, Zap } from "lucide-react";
import ChartPane from "./screener/ChartPane";
import OscPane from "./screener/OscPane";
import MacdPane from "./screener/MacdPane";
import AdxPane from "./screener/AdxPane";
import EfiPane from "./screener/EfiPane";
import CoinList from "./screener/CoinList";
import AnalysisPanel from "./screener/AnalysisPanel";
import SettingsPanel from "./screener/SettingsPanel";
import { isAbortError, TF_LIST, type TF, type Ticker } from "../lib/bybit";
import { deepAnalyze, loadHistory, loadUniverse, scanMarket, type ScanRow } from "../lib/scan";
import { analyze, type Analysis } from "../lib/indicators";
import { loadSettings, saveSettings, type Settings } from "../lib/settings";
import {
  exportMarks,
  loadMarks,
  markColor,
  MARK_KINDS,
  marksFor,
  saveMarks,
  type Mark,
  type MarkKind,
} from "../lib/marks";

const DEPTHS = [100, 200, 350, 500];

export default function Screener({ onShowPine }: { onShowPine: () => void }) {
  const [tf, setTf] = useState<TF>("15m");
  const [depth, setDepth] = useState(100);
  const [universe, setUniverse] = useState<Ticker[]>([]);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Analysis | null>(null);
  const [detLoading, setDetLoading] = useState(false);
  const [oscH, setOscH] = useState(140);
  const [macdH, setMacdH] = useState(120);
  const [adxH, setAdxH] = useState(105);
  const [efiH, setEfiH] = useState(90);
  const [view, setView] = useState({ right: 0, count: 110 });
  // индекс бара под курсором — для кроссхэйра во всех окнах
  const [crossIdx, setCrossIdx] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState("score");
  const [minScore, setMinScore] = useState(0);
  const [minChg, setMinChg] = useState(0);
  const [side, setSide] = useState("all");
  const [onlyCombo, setOnlyCombo] = useState(false);
  const [onlyZone, setOnlyZone] = useState(false);
  const [onlyAdx, setOnlyAdx] = useState(false);
  const [onlyEw, setOnlyEw] = useState(false);
  const [demaFilter, setDemaFilter] = useState<"all" | "above" | "below">("all");
  const [macdFilter, setMacdFilter] = useState<"all" | "buy" | "sell">("all");
  const [macdDivFilter, setMacdDivFilter] = useState<"all" | "bull" | "bear">("all");
  const [efiFilter, setEfiFilter] = useState<"all" | "up" | "dn">("all");
  const [squatFilter, setSquatFilter] = useState<"all" | "up" | "dn">("all");

  // сворачивание окон индикаторов
  const [oscCollapsed, setOscCollapsed] = useState(false);
  const [macdCollapsed, setMacdCollapsed] = useState(false);
  const [adxCollapsed, setAdxCollapsed] = useState(false);
  const [efiCollapsed, setEfiCollapsed] = useState(false);

  const [S, setS] = useState<Settings>(() => loadSettings());
  const [showSet, setShowSet] = useState(false);
  const [live, setLive] = useState(true);

  // ── ручная разметка уровней ──
  const [marks, setMarks] = useState<Mark[]>(() => loadMarks());
  const [markMode, setMarkMode] = useState<MarkKind | null>(null);
  const [showMarkPanel, setShowMarkPanel] = useState(false);

  const updateMarks = (next: Mark[]) => {
    setMarks(next);
    saveMarks(next);
  };

  const addMark = (price: number, barIdx: number, barTime: number) => {
    if (!markMode || !selected) return;
    const digits = price >= 1000 ? 2 : price >= 1 ? 4 : price >= 0.01 ? 5 : 7;
    const next: Mark = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol: selected,
      tf,
      kind: markMode,
      price: parseFloat(price.toFixed(digits)),
      barIdx,
      barTime,
      createdAt: Date.now(),
    };
    updateMarks([...marks, next]);
  };

  const visibleMarks = useMemo(() => marksFor(marks, selected, tf), [marks, selected, tf]);

  // ── подгрузка истории ──
  const [histLoading, setHistLoading] = useState(false);
  const histAbort = useRef<AbortController | null>(null);
  const histGuard = useRef(false);

  const applySettings = (next: Settings) => {
    setS(next);
    saveSettings(next);
  };

  const scanId = useRef(0);
  const scanAbort = useRef<AbortController | null>(null);
  const detailAbort = useRef<AbortController | null>(null);
  const settingsRef = useRef(S);

  useEffect(() => {
    settingsRef.current = S;
  }, [S]);

  useEffect(() => {
    const controller = new AbortController();
    loadUniverse(controller.signal)
      .then(setUniverse)
      .catch((error) => {
        if (!isAbortError(error)) setErr("Не удалось получить список Bybit. Проверь соединение или VPN.");
      });
    return () => controller.abort();
  }, []);

  const runScan = useCallback(async () => {
    if (!universe.length) return;
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    const id = ++scanId.current;
    const list = universe.slice(0, depth);
    const settingsSnapshot = structuredClone(S);
    let lastProgressAt = 0;
    setProgress({ done: 0, total: list.length });
    setErr(null);
    try {
      const res = await scanMarket(
        list,
        tf,
        (done, total) => {
          const now = performance.now();
          if (scanId.current === id && (done === total || now - lastProgressAt >= 120)) {
            lastProgressAt = now;
            setProgress({ done, total });
          }
        },
        settingsSnapshot,
        controller.signal,
      );
      if (scanId.current !== id || controller.signal.aborted) return;
      setRows(res);
      if (!selected && res.length) setSelected(res.slice().sort((a, b) => b.score - a.score)[0].symbol);
    } catch (error) {
      if (!isAbortError(error)) {
        setErr("Ошибка сканирования — Bybit ограничил запросы, попробуй меньше монет");
      }
    } finally {
      if (scanId.current === id) {
        setProgress(null);
        scanAbort.current = null;
      }
    }
  }, [universe, depth, tf, S]);

  const cancelScan = () => {
    scanId.current++;
    scanAbort.current?.abort();
    scanAbort.current = null;
    setProgress(null);
  };

  useEffect(() => {
    runScan();
  }, [universe, depth, tf]);

  useEffect(
    () => () => {
      scanId.current++;
      scanAbort.current?.abort();
      detailAbort.current?.abort();
    },
    [],
  );

  // детальный разбор
  useEffect(() => {
    if (!selected) return;
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    setDetLoading(true);
    deepAnalyze(selected, tf, settingsRef.current, controller.signal)
      .then((d) => {
        if (controller.signal.aborted) return;
        setDetail(d.a);
        if (d.a) setView({ right: d.a.candles.length - 1, count: 110 });
      })
      .catch((error) => {
        if (!isAbortError(error)) setErr("Не удалось загрузить график выбранной монеты");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [selected, tf]);

  // локальный пересчёт при смене настроек
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDetail((previous) => {
        if (!previous) return previous;
        return analyze(previous.symbol, previous.candles, S) ?? previous;
      });
    }, 180);
    return () => window.clearTimeout(id);
  }, [S]);

  // LIVE-обновление
  useEffect(() => {
    if (!selected || !live) return;
    const periods: Record<string, number> = {
      "5m": 15_000,
      "15m": 30_000,
      "30m": 45_000,
      "1h": 60_000,
      "4h": 120_000,
      "1d": 300_000,
    };
    let active = true;
    let timeoutId = 0;
    let request: AbortController | null = null;

    const update = async () => {
      if (!active) return;
      if (!document.hidden) {
        request = new AbortController();
        try {
          const d = await deepAnalyze(selected, tf, settingsRef.current, request.signal);
          if (active && d.a) {
            setDetail((prev) => {
              if (prev && prev.candles.length !== d.a!.candles.length) {
                setView((v) =>
                  v.right >= prev.candles.length - 1 ? { ...v, right: d.a!.candles.length - 1 } : v,
                );
              }
              return d.a;
            });
          }
        } catch (error) {
          if (!isAbortError(error)) console.warn("LIVE update failed", error);
        }
      }
      if (active) timeoutId = window.setTimeout(update, periods[tf] ?? 60_000);
    };

    timeoutId = window.setTimeout(update, periods[tf] ?? 60_000);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      request?.abort();
    };
  }, [selected, tf, live]);

  const fetchOlder = useCallback(async () => {
    if (!detail || histGuard.current) return;
    histGuard.current = true;
    histAbort.current?.abort();
    const controller = new AbortController();
    histAbort.current = controller;
    setHistLoading(true);
    try {
      const res = await loadHistory(detail.symbol, tf, detail.candles, controller.signal);
      if (res.added > 0 && !controller.signal.aborted) {
        const next = analyze(detail.symbol, res.candles, settingsRef.current);
        if (next) {
          setDetail(next);
          setView((v) => ({ ...v, right: v.right + res.added }));
        }
      }
    } catch {
      /* история может закончиться */
    } finally {
      setHistLoading(false);
      window.setTimeout(() => (histGuard.current = false), 600);
    }
  }, [detail, tf]);

  useEffect(() => {
    if (!detail || histLoading) return;
    const from = view.right - view.count + 1;
    if (from <= 5 && detail.candles.length < 3000) fetchOlder();
  }, [view, detail, histLoading, fetchOlder]);

  const listRows = useMemo(() => {
    let r = rows.filter((x) => x.score >= minScore && Math.abs(x.changePct) >= minChg);
    if (q.trim()) {
      const s = q.trim().toUpperCase();
      r = r.filter((x) => x.symbol.includes(s));
    }
    if (side === "long") r = r.filter((x) => x.dir === 1);
    if (side === "short") r = r.filter((x) => x.dir === -1);
    if (onlyCombo) r = r.filter((x) => x.combo || x.jawCross || x.rfDouble);
    if (onlyZone) r = r.filter((x) => x.zoneRev !== 0);
    if (onlyAdx) r = r.filter((x) => x.adxFresh && x.adxDir !== 0);
    if (onlyEw) r = r.filter((x) => x.ewFresh && x.ewDir !== 0);
    if (demaFilter === "above") r = r.filter((x) => x.demaDir === 1);
    if (demaFilter === "below") r = r.filter((x) => x.demaDir === -1);
    if (macdFilter === "buy") r = r.filter((x) => x.macdFresh && x.macdDir === 1);
    if (macdFilter === "sell") r = r.filter((x) => x.macdFresh && x.macdDir === -1);
    if (macdDivFilter === "bull") r = r.filter((x) => x.macdDiv === 1 && x.macdDivAgo <= S.macd.freshBars);
    if (macdDivFilter === "bear") r = r.filter((x) => x.macdDiv === -1 && x.macdDivAgo <= S.macd.freshBars);
    if (efiFilter === "up") r = r.filter((x) => x.efiDir === 1 && x.efiAngle >= S.efi.angleFilterUp && x.efiAgo <= S.efi.freshBars);
    if (efiFilter === "dn") r = r.filter((x) => x.efiDir === -1 && x.efiAngle >= S.efi.angleFilterDn && x.efiAgo <= S.efi.freshBars);

    // ── приоритет: монеты с активным сигналом поднимаются наверх ──
    const hasActiveSignal = (x: ScanRow): number => {
      if (macdFilter === "buy" && x.macdFresh && x.macdDir === 1) return 1;
      if (macdFilter === "sell" && x.macdFresh && x.macdDir === -1) return 1;
      if (macdDivFilter === "bull" && x.macdDiv === 1) return 1;
      if (macdDivFilter === "bear" && x.macdDiv === -1) return 1;
      if (efiFilter === "up" && x.efiDir === 1 && x.efiAngle >= S.efi.angleFilterUp) return 1;
      if (efiFilter === "dn" && x.efiDir === -1 && x.efiAngle >= S.efi.angleFilterDn) return 1;
      if (squatFilter === "up" && x.squatFresh && x.squatDir === 1) return 1;
      if (squatFilter === "dn" && x.squatFresh && x.squatDir === -1) return 1;
      if (onlyAdx && x.adxFresh && x.adxDir !== 0) return 1;
      if (onlyEw && x.ewFresh && x.ewDir !== 0) return 1;
      if (onlyZone && x.zoneRev !== 0) return 1;
      if (onlyCombo && (x.combo || x.jawCross || x.rfDouble)) return 1;
      if (demaFilter === "above" && x.demaDir === 1) return 1;
      if (demaFilter === "below" && x.demaDir === -1) return 1;
      return 0;
    };

    const cmp: Record<string, (a: ScanRow, b: ScanRow) => number> = {
      score: (a, b) => hasActiveSignal(b) - hasActiveSignal(a) || b.score - a.score || a.fresh - b.fresh,
      fresh: (a, b) => hasActiveSignal(b) - hasActiveSignal(a) || a.fresh - b.fresh || b.score - a.score,
      chg: (a, b) => hasActiveSignal(b) - hasActiveSignal(a) || Math.abs(b.changePct) - Math.abs(a.changePct),
      vol: (a, b) => hasActiveSignal(b) - hasActiveSignal(a) || b.turnover - a.turnover,
    };
    return r.sort(cmp[sort]);
  }, [rows, q, sort, minScore, minChg, side, onlyCombo, onlyZone, onlyAdx, onlyEw, macdFilter, macdDivFilter, efiFilter, demaFilter, S]);

  const strong = rows.filter((r) => r.score >= S.strongScore).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0f16] text-[#e6edf3]">
      <header className="flex flex-wrap items-center gap-3 border-b hairline bg-[#0d1117] px-4 py-2.5">
        <div className="flex items-center gap-2 font-display text-sm font-bold">
          <Activity size={16} className="text-[#00ff88]" />
          Bybit Futures Screener
        </div>
        <span className="rounded bg-[#2962ff]/15 px-2 py-0.5 font-mono text-[9.5px] text-[#8fb0ff]">USDT.P</span>

        <div className="flex overflow-hidden rounded-lg border hairline">
          {TF_LIST.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-2.5 py-1 font-mono text-[10px] transition-colors ${
                tf === t ? "bg-[#2962ff] text-white" : "text-[#8b98ab] hover:text-[#e6edf3]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-lg border hairline">
          {DEPTHS.map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`px-2 py-1 font-mono text-[10px] transition-colors ${
                depth === d ? "bg-[#161b22] text-[#00ff88]" : "text-[#5d6b80] hover:text-[#8b98ab]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#8b98ab]">
          <span>
            монет: <span className="text-[#e6edf3]">{rows.length}</span>
          </span>
          <span className="flex items-center gap-1">
            <Zap size={10} className="text-[#ffd600]" />
            сильных: <span className="text-[#ffd600]">{strong}</span>
          </span>
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] transition-colors ${
              live ? "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]" : "hairline bg-[#161b22] text-[#5d6b80]"
            }`}
            title="Автообновление свечей"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-[#00ff88]" : "bg-[#5d6b80]"}`} />
            LIVE
          </button>
          <button
            onClick={() => setShowMarkPanel((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] transition-colors ${
              showMarkPanel || markMode
                ? "border-[#ff69b4]/50 bg-[#ff69b4]/15 text-[#ff69b4]"
                : "hairline bg-[#161b22] text-[#c8d3e0] hover:text-[#ff69b4]"
            }`}
            title="Ручная разметка уровней"
          >
            <Pencil size={11} />
            Разметка
            {visibleMarks.length > 0 && (
              <span className="rounded bg-[#ff69b4] px-1 text-[8px] font-bold text-[#0b0f16]">
                {visibleMarks.length}
              </span>
            )}
          </button>
          <button
            onClick={onShowPine}
            className="flex items-center gap-1.5 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/10 px-2.5 py-1.5 font-mono text-[10px] text-[#00ff88] transition-colors hover:bg-[#00ff88]/20"
            title="Pine Script код для TradingView"
          >
            <FileCode size={11} />
            Pine
          </button>
          <button
            onClick={() => setShowSet(true)}
            className="flex items-center gap-1.5 rounded-lg border hairline bg-[#161b22] px-2.5 py-1.5 font-mono text-[10px] text-[#c8d3e0] transition-colors hover:border-[#2962ff]/60 hover:text-[#8fb0ff]"
          >
            <Settings2 size={11} />
            Настройки
          </button>
          {progress ? (
            <button
              onClick={cancelScan}
              className="flex items-center gap-1.5 rounded-lg bg-[#ff4466] px-3 py-1.5 font-mono text-[10px] font-bold text-white transition-all hover:bg-[#ff6b82]"
            >
              <Square size={10} fill="currentColor" />
              Остановить
            </button>
          ) : (
            <button
              onClick={runScan}
              className="flex items-center gap-1.5 rounded-lg bg-[#00ff88] px-3 py-1.5 font-mono text-[10px] font-bold text-[#052018] transition-all hover:bg-[#5affb0]"
            >
              <RefreshCw size={11} />
              Сканировать
            </button>
          )}
        </div>
      </header>

      {err && (
        <div className="border-b border-[#ff4466]/30 bg-[#ff4466]/10 px-4 py-2 font-mono text-[10.5px] text-[#ff9aa3]">
          {err}
        </div>
      )}

      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[240px_minmax(0,1fr)_290px]">
        <div className="h-[420px] lg:h-[calc(100vh-90px)]">
          <CoinList
            rows={listRows}
            selected={selected}
            onSelect={setSelected}
            q={q}
            setQ={setQ}
            sort={sort}
            setSort={setSort}
            minScore={minScore}
            setMinScore={setMinScore}
            minChg={minChg}
            setMinChg={setMinChg}
            side={side}
            setSide={setSide}
            onlyCombo={onlyCombo}
            setOnlyCombo={setOnlyCombo}
            onlyZone={onlyZone}
            setOnlyZone={setOnlyZone}
            onlyAdx={onlyAdx}
            setOnlyAdx={setOnlyAdx}
            onlyEw={onlyEw}
            setOnlyEw={setOnlyEw}
            demaFilter={demaFilter}
            setDemaFilter={setDemaFilter}
            macdFilter={macdFilter}
            setMacdFilter={setMacdFilter}
            macdDivFilter={macdDivFilter}
            setMacdDivFilter={setMacdDivFilter}
            efiFilter={efiFilter}
            setEfiFilter={setEfiFilter}
            efiAngleUp={S.efi.angleFilterUp}
            efiAngleDn={S.efi.angleFilterDn}
            squatFilter={squatFilter}
            setSquatFilter={setSquatFilter}

            progress={progress}
          />
        </div>

        <div className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border hairline bg-[#0d1117] lg:h-[calc(100vh-90px)]">
          <ChartPane
            a={detail}
            tf={tf}
            loading={detLoading}
            S={S}
            view={view}
            setView={setView}
            marks={visibleMarks}
            markMode={markMode}
            onAddMark={addMark}
            histLoading={histLoading}
            onLoadHistory={fetchOlder}
            onCrosshair={setCrossIdx}
          />
          <OscPane
            a={detail}
            height={oscH}
            onResize={setOscH}
            view={view}
            crossIdx={crossIdx}
            collapsed={oscCollapsed}
            onToggle={() => setOscCollapsed((v) => !v)}
          />
          <MacdPane
            a={detail}
            height={macdH}
            onResize={setMacdH}
            view={view}
            S={S}
            crossIdx={crossIdx}
            collapsed={macdCollapsed}
            onToggle={() => setMacdCollapsed((v) => !v)}
          />
          {S.adx.enabled && (
            <AdxPane
              a={detail}
              height={adxH}
              onResize={setAdxH}
              view={view}
              S={S}
              crossIdx={crossIdx}
              collapsed={adxCollapsed}
              onToggle={() => setAdxCollapsed((v) => !v)}
            />
          )}
          {S.efi.enabled && (
            <EfiPane
              a={detail}
              height={efiH}
              onResize={setEfiH}
              view={view}
              S={S}
              crossIdx={crossIdx}
              collapsed={efiCollapsed}
              onToggle={() => setEfiCollapsed((v) => !v)}
            />
          )}
        </div>

        <div className="h-[600px] lg:h-[calc(100vh-90px)]">
          <AnalysisPanel
            a={detail}
            tf={tf}
            showLevels={S.showTradeLevels}
            onToggleLevels={(v) => applySettings({ ...S, showTradeLevels: v })}
          />
        </div>
      </div>

      {showMarkPanel && (
        <div className="fixed right-4 bottom-4 z-40 w-[280px] rounded-xl border border-[#ff69b4]/35 bg-[#0d1117] shadow-2xl">
          <div className="flex items-center gap-2 border-b hairline px-3 py-2">
            <Pencil size={12} className="text-[#ff69b4]" />
            <span className="font-mono text-[11px] font-bold text-[#e6edf3]">Разметка уровней</span>
            <button
              onClick={() => {
                setShowMarkPanel(false);
                setMarkMode(null);
              }}
              className="ml-auto rounded p-0.5 text-[#8b98ab] hover:text-[#ff4466]"
            >
              <X size={12} />
            </button>
          </div>
          <div className="p-2.5">
            <div className="font-mono text-[9px] text-[#5d6b80]">
              {markMode ? "Кликни по графику, чтобы поставить линию" : "Выбери тип линии"}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {MARK_KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setMarkMode(markMode === k.id ? null : k.id)}
                  className="rounded px-2 py-1 font-mono text-[9.5px] font-bold transition-all"
                  style={{
                    background: markMode === k.id ? k.color : "#161b22",
                    color: markMode === k.id ? "#0b0f16" : k.color,
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="mt-2.5 max-h-[180px] overflow-y-auto">
              {visibleMarks.length === 0 ? (
                <div className="py-3 text-center font-mono text-[9.5px] text-[#3f4c60]">
                  нет линий на {selected || "—"} {tf}
                </div>
              ) : (
                visibleMarks
                  .slice()
                  .sort((x, y) => y.price - x.price)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 border-b border-white/[0.04] py-1 font-mono text-[9.5px]"
                    >
                      <span className="w-14 font-bold" style={{ color: markColor(m.kind) }}>
                        {m.kind}
                      </span>
                      <span className="flex-1 text-[#c8d3e0]">{m.price}</span>
                      <span className="text-[#3f4c60]">#{m.barIdx}</span>
                      <button
                        onClick={() => updateMarks(marks.filter((x) => x.id !== m.id))}
                        className="rounded p-0.5 text-[#5d6b80] hover:text-[#ff4466]"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))
              )}
            </div>
            <div className="mt-2 flex gap-1">
              <button
                onClick={() => {
                  const txt = exportMarks(marks, selected, tf);
                  navigator.clipboard?.writeText(txt).catch(() => void 0);
                }}
                disabled={!visibleMarks.length}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-[#161b22] px-2 py-1 font-mono text-[9.5px] text-[#8b98ab] hover:text-[#00e5ff] disabled:opacity-40"
              >
                <Copy size={10} />
                Копировать
              </button>
              <button
                onClick={() => updateMarks(marks.filter((m) => !(m.symbol === selected && m.tf === tf)))}
                disabled={!visibleMarks.length}
                className="flex items-center justify-center gap-1 rounded bg-[#161b22] px-2 py-1 font-mono text-[9.5px] text-[#8b98ab] hover:text-[#ff4466] disabled:opacity-40"
              >
                <Trash2 size={10} />
                Очистить
              </button>
            </div>
            {detail?.zones && (
              <div className="mt-2 rounded border hairline bg-[#161b22]/60 p-2">
                <div className="font-mono text-[9px] tracking-wider text-[#5d6b80] uppercase">Авто-расчёт сейчас</div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 font-mono text-[9px]">
                  <span className="text-[#00e5ff]">L-High {detail.zones.localHigh ?? "—"}</span>
                  <span className="text-[#ffab00]">High-D {detail.zones.rangeHigh}</span>
                  <span className="text-[#ffab00]">Low-D {detail.zones.rangeLow}</span>
                  <span className="text-[#00e5ff]">L-Low {detail.zones.localLow ?? "—"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSet && <SettingsPanel S={S} set={applySettings} onClose={() => setShowSet(false)} />}
    </div>
  );
}
