import { useState } from "react";
import { Search, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import type { ScanRow } from "../../lib/scan";
import { fmtTurnover } from "../../lib/bybit";

interface Props {
  rows: ScanRow[];
  selected: string;
  onSelect: (s: string) => void;
  q: string;
  setQ: (v: string) => void;
  sort: string;
  setSort: (v: string) => void;
  minScore: number;
  setMinScore: (v: number) => void;
  minChg: number;
  setMinChg: (v: number) => void;
  side: string;
  setSide: (v: string) => void;
  onlyCombo: boolean;
  setOnlyCombo: (v: boolean) => void;
  onlyZone: boolean;
  setOnlyZone: (v: boolean) => void;
  onlyAdx: boolean;
  setOnlyAdx: (v: boolean) => void;
  onlyEw: boolean;
  setOnlyEw: (v: boolean) => void;
  demaFilter: "all" | "above" | "below";
  setDemaFilter: (v: "all" | "above" | "below") => void;
  macdFilter: "all" | "buy" | "sell";
  setMacdFilter: (v: "all" | "buy" | "sell") => void;
  macdDivFilter: "all" | "bull" | "bear";
  setMacdDivFilter: (v: "all" | "bull" | "bear") => void;
  efiFilter: "all" | "up" | "dn";
  setEfiFilter: (v: "all" | "up" | "dn") => void;
  efiAngleUp: number;
  efiAngleDn: number;
  squatFilter: "all" | "up" | "dn";
  setSquatFilter: (v: "all" | "up" | "dn") => void;
  progress: { done: number; total: number } | null;
}

const SORTS = [
  { id: "score", label: "Уверенность" },
  { id: "fresh", label: "Свежесть" },
  { id: "chg", label: "Изменение %" },
  { id: "vol", label: "Оборот" },
];

export default function CoinList(p: Props) {
  const [showFilters, setShowFilters] = useState(false);

  const activeCount =
    (p.onlyCombo ? 1 : 0) +
    (p.onlyZone ? 1 : 0) +
    (p.onlyAdx ? 1 : 0) +
    (p.onlyEw ? 1 : 0) +
    (p.demaFilter !== "all" ? 1 : 0) +
    (p.minScore > 0 ? 1 : 0) +
    (p.minChg > 0 ? 1 : 0);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border hairline bg-[#0d1117]">
      {/* поиск — всегда виден, компактно */}
      <div className="shrink-0 border-b hairline p-2 pb-1.5">
        <div className="relative">
          <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-[#5d6b80]" />
          <input
            value={p.q}
            onChange={(e) => p.setQ(e.target.value)}
            placeholder="Поиск монеты…"
            className="w-full rounded-lg border hairline bg-[#161b22] py-1.5 pr-2 pl-7 font-mono text-[11px] text-[#e6edf3] outline-none focus:border-[#2962ff]/60"
          />
        </div>

        {/* сортировка + сторона + фильтры — один компактный ряд */}
        <div className="mt-1.5 flex items-center gap-1">
          <select
            value={p.sort}
            onChange={(e) => p.setSort(e.target.value)}
            className="min-w-0 flex-1 rounded border hairline bg-[#161b22] px-1.5 py-1 font-mono text-[9.5px] text-[#c8d3e0] outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 overflow-hidden rounded border hairline">
            {[
              { id: "all", label: "•" },
              { id: "long", label: "L" },
              { id: "short", label: "S" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => p.setSide(s.id)}
                title={s.id === "all" ? "Все" : s.id === "long" ? "LONG" : "SHORT"}
                className={`px-1.5 py-1 font-mono text-[9.5px] font-bold transition-colors ${
                  p.side === s.id
                    ? s.id === "long"
                      ? "bg-[#00ff88] text-[#0b0f16]"
                      : s.id === "short"
                        ? "bg-[#ff4466] text-[#0b0f16]"
                        : "bg-[#2962ff] text-white"
                    : "text-[#8b98ab]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-1 font-mono text-[9.5px] transition-colors ${
              showFilters || activeCount > 0
                ? "border-[#2962ff]/50 bg-[#2962ff]/15 text-[#8fb0ff]"
                : "hairline bg-[#161b22] text-[#8b98ab]"
            }`}
            title="Фильтры сигналов"
          >
            <SlidersHorizontal size={10} />
            {activeCount > 0 && (
              <span className="rounded bg-[#2962ff] px-1 text-[8px] font-bold text-white">{activeCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* фильтры — сворачиваемая панель */}
      {showFilters && (
        <div className="shrink-0 space-y-1.5 border-b hairline bg-[#10151f]/50 p-2">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => p.setOnlyCombo(!p.onlyCombo)}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.onlyCombo ? "bg-[#ffd600] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ffd600]"}`}
            >
              🔥 Комбо
            </button>
            <button
              onClick={() => p.setOnlyZone(!p.onlyZone)}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.onlyZone ? "bg-[#ffab00] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ffab00]"}`}
            >
              🎯 Зоны S/R
            </button>
            <button
              onClick={() => p.setOnlyAdx(!p.onlyAdx)}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.onlyAdx ? "bg-[#ffab00] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ffab00]"}`}
            >
              📶 ADX &gt; 20
            </button>
            <button
              onClick={() => p.setOnlyEw(!p.onlyEw)}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.onlyEw ? "bg-[#ff69b4] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ff69b4]"}`}
            >
              🌊 Elliott
            </button>
            <button
              onClick={() => p.setEfiFilter(p.efiFilter === "up" ? "all" : "up")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.efiFilter === "up" ? "bg-[#ff9800] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ff9800]"}`}
            >
              ⚡ EFI ▲ {p.efiAngleUp}°
            </button>
            <button
              onClick={() => p.setEfiFilter(p.efiFilter === "dn" ? "all" : "dn")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.efiFilter === "dn" ? "bg-[#ff9800] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ff9800]"}`}
            >
              ⚡ EFI ▼ {p.efiAngleDn}°
            </button>
            <button
              onClick={() => p.setMacdFilter(p.macdFilter === "buy" ? "all" : "buy")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.macdFilter === "buy" ? "bg-[#00bcd4] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#00bcd4]"}`}
            >
              📊 MACD ▲
            </button>
            <button
              onClick={() => p.setMacdFilter(p.macdFilter === "sell" ? "all" : "sell")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.macdFilter === "sell" ? "bg-[#00bcd4] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#00bcd4]"}`}
            >
              📊 MACD ▼
            </button>
            <button
              onClick={() => p.setMacdDivFilter(p.macdDivFilter === "bull" ? "all" : "bull")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.macdDivFilter === "bull" ? "bg-[#00e676] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#00e676]"}`}
            >
              📊 Бычья див
            </button>
            <button
              onClick={() => p.setMacdDivFilter(p.macdDivFilter === "bear" ? "all" : "bear")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.macdDivFilter === "bear" ? "bg-[#ff4466] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ff4466]"}`}
            >
              📊 Медв див
            </button>
            <button
              onClick={() => p.setSquatFilter(p.squatFilter === "up" ? "all" : "up")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.squatFilter === "up" ? "bg-[#2979ff] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#2979ff]"}`}
            >
              🪑 Приседающий ▲
            </button>
            <button
              onClick={() => p.setSquatFilter(p.squatFilter === "dn" ? "all" : "dn")}
              className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${p.squatFilter === "dn" ? "bg-[#2979ff] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#2979ff]"}`}
            >
              🪑 Приседающий ▼
            </button>
          </div>

          <div className="flex gap-1">
            {[
              { id: "all" as const, label: "DEMA —" },
              { id: "above" as const, label: "↑ выше" },
              { id: "below" as const, label: "↓ ниже" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => p.setDemaFilter(f.id)}
                className={`flex-1 rounded px-1 py-1 font-mono text-[9px] transition-colors ${
                  p.demaFilter === f.id
                    ? "bg-[#9d8cff] font-bold text-[#0b0f16]"
                    : "bg-[#161b22] text-[#8b98ab] hover:text-[#9d8cff]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 font-mono text-[9px] text-[#8b98ab]">
            <span className="w-12">Сила ≥</span>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={p.minScore}
              onChange={(e) => p.setMinScore(+e.target.value)}
              className="flex-1 accent-[#2962ff]"
            />
            <span className="w-6 text-right text-[#e6edf3]">{p.minScore}</span>
          </label>
          <label className="flex items-center gap-2 font-mono text-[9px] text-[#8b98ab]">
            <span className="w-12">|Δ24| ≥</span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={p.minChg}
              onChange={(e) => p.setMinChg(+e.target.value)}
              className="flex-1 accent-[#2962ff]"
            />
            <span className="w-6 text-right text-[#e6edf3]">{p.minChg}%</span>
          </label>
        </div>
      )}

      {false && (
        <div className="hidden">
          {/* старый блок фильтров — удалён */}

        <div className="mt-2 flex gap-1">
          {[
            { id: "all", label: "Все" },
            { id: "long", label: "LONG" },
            { id: "short", label: "SHORT" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => p.setSide(s.id)}
              className={`flex-1 rounded px-2 py-1 font-mono text-[9.5px] transition-colors ${
                p.side === s.id
                  ? s.id === "long"
                    ? "bg-[#00ff88]/20 text-[#00ff88]"
                    : s.id === "short"
                      ? "bg-[#ff4466]/20 text-[#ff4466]"
                      : "bg-[#2962ff] text-white"
                  : "bg-[#161b22] text-[#8b98ab]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex gap-1">
          <button
            onClick={() => p.setOnlyCombo(!p.onlyCombo)}
            className={`flex-1 rounded px-2 py-1 font-mono text-[9.5px] transition-colors ${
              p.onlyCombo ? "bg-[#ffd600] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ffd600]"
            }`}
          >
            🔥 Комбо
          </button>
        </div>

        <button
          onClick={() => p.setOnlyZone(!p.onlyZone)}
          className={`mt-1 w-full rounded px-2 py-1 font-mono text-[9.5px] transition-colors ${
            p.onlyZone ? "bg-[#ffab00] font-bold text-[#0b0f16]" : "bg-[#161b22] text-[#8b98ab] hover:text-[#ffab00]"
          }`}
        >
          🎯 Развороты от зон S/R
        </button>

        <button
          onClick={() => p.setOnlyAdx(!p.onlyAdx)}
          className={`mt-1 w-full rounded px-2 py-1 font-mono text-[9.5px] transition-colors ${
            p.onlyAdx
              ? "bg-[#ffab00] font-bold text-[#0b0f16]"
              : "bg-[#161b22] text-[#8b98ab] hover:text-[#ffab00]"
          }`}
        >
          📶 Свежий ADX &gt; 20
        </button>

        <button
          onClick={() => p.setOnlyEw(!p.onlyEw)}
          className={`mt-1 w-full rounded px-2 py-1 font-mono text-[9.5px] transition-colors ${
            p.onlyEw
              ? "bg-[#ff69b4] font-bold text-[#0b0f16]"
              : "bg-[#161b22] text-[#8b98ab] hover:text-[#ff69b4]"
          }`}
        >
          🌊 Elliott Wave
        </button>

        <div className="mt-1 flex gap-1">
          {[
            { id: "all" as const, label: "DEMA" },
            { id: "above" as const, label: "↑ выше" },
            { id: "below" as const, label: "↓ ниже" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => p.setDemaFilter(f.id)}
              className={`flex-1 rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${
                p.demaFilter === f.id
                  ? f.id === "above"
                    ? "bg-[#9d8cff] font-bold text-[#0b0f16]"
                    : f.id === "below"
                      ? "bg-[#ff69b4] font-bold text-[#0b0f16]"
                      : "bg-[#9d8cff] font-bold text-[#0b0f16]"
                  : "bg-[#161b22] text-[#8b98ab] hover:text-[#9d8cff]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-1.5">
          <label className="flex items-center gap-2 font-mono text-[9.5px] text-[#8b98ab]">
            <span className="w-14">Сила ≥</span>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={p.minScore}
              onChange={(e) => p.setMinScore(+e.target.value)}
              className="flex-1 accent-[#2962ff]"
            />
            <span className="w-7 text-right text-[#e6edf3]">{p.minScore}</span>
          </label>
          <label className="flex items-center gap-2 font-mono text-[9.5px] text-[#8b98ab]">
            <span className="w-14">|Δ24ч| ≥</span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={p.minChg}
              onChange={(e) => p.setMinChg(+e.target.value)}
              className="flex-1 accent-[#2962ff]"
            />
            <span className="w-7 text-right text-[#e6edf3]">{p.minChg}%</span>
          </label>
        </div>
      </div>
      )}

      {p.progress && (
        <div className="border-b hairline px-2.5 py-1.5">
          <div className="flex justify-between font-mono text-[9px] text-[#8b98ab]">
            <span>сканирование…</span>
            <span>
              {p.progress.done}/{p.progress.total}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded bg-[#161b22]">
            <div
              className="h-full bg-[#2962ff] transition-all"
              style={{ width: `${(p.progress.done / p.progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* список */}
      <div className="flex-1 overflow-y-auto">
        {p.rows.map((r) => {
          const strong = r.score >= 70;
          return (
            <button
              key={r.symbol}
              onClick={() => p.onSelect(r.symbol)}
              className={`flex w-full items-center gap-2 border-b border-white/[0.04] px-2.5 py-2 text-left transition-colors ${
                p.selected === r.symbol ? "bg-[#2962ff]/15" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate font-mono text-[11px] font-bold text-[#e6edf3]">
                    {r.symbol.replace("USDT", "")}
                  </span>
                  {r.combo && <span className="text-[9px]" title="Пересечение челюсти + CCI">🔥</span>}
                  {!r.combo && r.jawCross && <span className="text-[8px] text-[#00e5ff]" title="RF пересёк челюсть">✕</span>}
                  {!r.combo && r.rfDouble && <span className="text-[8px] text-[#ffd600]" title="Двойная метка RF">★</span>}
                  {r.zoneRev !== 0 && (
                    <span
                      className="text-[8px]"
                      style={{ color: r.zonePierced ? "#ffab00" : "#8b98ab" }}
                      title={`Разворот от ${r.zoneKind === "local" ? "локального уровня" : "границы диапазона"}${r.zonePierced ? " с прошивкой" : ""} · ${r.zoneAgo}b · R:R 1:${r.zoneRR.toFixed(1)}`}
                    >
                      🎯
                    </span>
                  )}
                  {r.ewFresh && r.ewDir !== 0 && (
                    <span
                      className="text-[8px] font-bold text-[#ff69b4]"
                      title={`Elliott ${r.ewLabel} · ${r.ewAgo}b${r.ewBreakBox ? " · бокс пробит" : ""}`}
                    >
                      ℇ
                    </span>
                  )}
                  {r.efiFresh && r.efiDir !== 0 && (
                    <span
                      className="text-[8px] font-bold text-[#ff9800]"
                      title={`EFI ${Math.round(r.efiAngle)}° · ${r.efiAgo}b назад`}
                    >
                      ⚡
                    </span>
                  )}
                  {r.adxFresh && r.adxDir !== 0 && (
                    <span
                      className="text-[8px] font-bold"
                      style={{ color: r.adxDir > 0 ? "#00ff88" : "#ff4466" }}
                      title={`ADX ${r.adx.toFixed(1)} пересёк порог · ${r.adxAgo}b назад`}
                    >
                      A
                    </span>
                  )}
                  {r.macdFresh && r.macdDir !== 0 && (
                    <span
                      className="text-[8px] font-bold"
                      style={{ color: r.macdDir > 0 ? "#00bcd4" : "#ff4466" }}
                      title={`MACD ${r.macdDir > 0 ? "BUY" : "SELL"} · ${r.macdAgo}b назад`}
                    >
                      M
                    </span>
                  )}
                  {!r.combo && !r.jawCross && !r.rfDouble && strong && <span className="text-[9px]">⚡</span>}
                </div>
                <div className="flex items-center gap-2 font-mono text-[9px] text-[#5d6b80]">
                  <span>{fmtTurnover(r.turnover)}</span>
                  <span className={r.changePct >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"}>
                    {r.changePct >= 0 ? "+" : ""}
                    {r.changePct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                    r.dir > 0
                      ? "bg-[#00ff88]/15 text-[#00ff88]"
                      : r.dir < 0
                        ? "bg-[#ff4466]/15 text-[#ff4466]"
                        : "bg-white/5 text-[#5d6b80]"
                  }`}
                >
                  {r.dir > 0 ? <TrendingUp size={9} /> : r.dir < 0 ? <TrendingDown size={9} /> : null}
                  {r.score}
                </span>
                <span className="font-mono text-[8.5px] text-[#5d6b80]">{r.fresh}b</span>
              </div>
            </button>
          );
        })}
        {p.rows.length === 0 && !p.progress && (
          <div className="p-4 text-center font-mono text-[10px] text-[#5d6b80]">
            ничего не найдено — ослабь фильтры
          </div>
        )}
      </div>
    </div>
  );
}
