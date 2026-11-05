import { Check, Minus, Target, X } from "lucide-react";
import type { Analysis } from "../../lib/indicators";
import { fmtPrice } from "../../lib/bybit";

export default function AnalysisPanel({
  a,
  tf,
  showLevels,
  onToggleLevels,
}: {
  a: Analysis | null;
  tf: string;
  showLevels: boolean;
  onToggleLevels: (v: boolean) => void;
}) {
  if (!a) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border hairline bg-[#0d1117] p-4 font-mono text-[11px] text-[#5d6b80]">
        выбери монету для анализа
      </div>
    );
  }

  const long = a.dir === 1;
  const flat = a.dir === 0;
  const col = long ? "#00ff88" : flat ? "#78909C" : "#ff4466";
  const verdict = a.score >= 70 ? "СИЛЬНЫЙ" : a.score >= 45 ? "СРЕДНИЙ" : "СЛАБЫЙ";
  const riskPct = (Math.abs(a.entry - a.stop) / a.entry) * 100;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-xl border hairline bg-[#0d1117] p-3">
      {/* вердикт */}
      <div className="rounded-lg border p-3" style={{ borderColor: col + "40", background: col + "0d" }}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-[#8b98ab] uppercase">Вердикт · {tf}</span>
          <span className="font-mono text-[10px] text-[#5d6b80]">свежесть {a.fresh}b</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold" style={{ color: col }}>
            {flat ? "НЕТ СИГНАЛА" : long ? "LONG" : "SHORT"}
          </span>
          <span className="font-mono text-sm" style={{ color: col }}>
            {a.score}%
          </span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-[#8b98ab]">
          {verdict} · цена {fmtPrice(a.price)}
        </div>
        {(a.hasJawCombo || a.hasJawCross || a.hasRfDouble || a.hasMacdDiv || a.hasZoneRev || a.hasAdx) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {a.hasJawCombo && (
              <span className="rounded bg-[#ffd600] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#0b0f16]">
                🔥 КРЕСТ + CCI
              </span>
            )}
            {a.hasJawCross && !a.hasJawCombo && (
              <span className="rounded bg-[#00e5ff]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#00e5ff]">
                ✕ RF × ЧЕЛЮСТЬ
              </span>
            )}
            {a.hasRfDouble && (
              <span className="rounded bg-[#ffd600]/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#ffd600]">
                ★ ДВОЙНАЯ МЕТКА RF
              </span>
            )}
            {a.zoneSignal && a.hasZoneRev && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  background: a.zoneSignal.pierced ? (long ? "#00ff88" : "#ff4466") : "rgba(255,171,0,0.2)",
                  color: a.zoneSignal.pierced ? "#0b0f16" : "#ffab00",
                }}
              >
                🎯 РАЗВОРОТ {a.zoneSignal.levelKind === "local" ? "ЛОК." : "ГРАНИЦА"}
                {a.zoneSignal.pierced ? " · ПРОШИЛ" : ""} {a.zoneSignal.barsAgo}b
              </span>
            )}
            {a.hasMacdDiv && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  background: a.macd.divDir > 0 ? "rgba(0,188,212,0.2)" : "rgba(255,68,102,0.2)",
                  color: a.macd.divDir > 0 ? "#00bcd4" : "#ff6b78",
                }}
              >
                📊 MACD Div {a.macd.divDir > 0 ? "▲" : "▼"} {a.macd.divAgo}b
              </span>
            )}
            {a.hasEfi && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  background: a.efi.dir === 1 ? "rgba(255,152,0,0.2)" : "rgba(255,152,0,0.2)",
                  color: "#ff9800",
                }}
              >
                ⚡ EFI {Math.round(a.efi.angle ?? 0)}° {a.efi.dir > 0 ? "▲" : "▼"} {a.efi.ago}b
              </span>
            )}
            {a.squat.isFresh && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  background: "rgba(41,121,255,0.2)",
                  color: "#2979ff",
                }}
              >
                🪑 ПРИСЕДАЮЩИЙ {a.squat.dir > 0 ? "▲" : "▼"} {a.squat.lastSeriesLen}× {a.squat.ago}b{a.squat.efiConfirm ? " · EFI✓" : ""}
              </span>
            )}
            {a.hasAdx && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  background: a.adx.signalDir > 0 ? "rgba(0,255,136,0.18)" : "rgba(255,68,102,0.18)",
                  color: a.adx.signalDir > 0 ? "#00ff88" : "#ff4466",
                }}
              >
                📶 ADX {a.adx.lastAdx.toFixed(1)} {a.adx.signalDir > 0 ? "▲" : "▼"} {a.adx.signalAgo}b
              </span>
            )}
          </div>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-[#161b22]">
          <div className="h-full transition-all" style={{ width: `${a.score}%`, background: col }} />
        </div>
      </div>

      {/* уровни */}
      {!flat && (
        <div className="rounded-lg border hairline bg-[#161b22]/60 p-3">
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-[#8b98ab] uppercase">
            <Target size={11} className="text-[#00e5ff]" />
            Точки сделки
            <button
              onClick={() => onToggleLevels(!showLevels)}
              className={`ml-auto rounded px-2 py-0.5 font-mono text-[9px] tracking-normal normal-case transition-colors ${
                showLevels
                  ? "bg-[#00e5ff]/20 text-[#00e5ff]"
                  : "bg-[#161b22] text-[#5d6b80] hover:text-[#8b98ab]"
              }`}
              title="Показывать SL / TP1 / TP2 на графике"
            >
              {showLevels ? "◉ на графике" : "○ скрыты"}
            </button>
          </div>
          {[
            { l: "Вход", v: a.entry, c: "#e6edf3" },
            { l: "Стоп", v: a.stop, c: "#ff4466" },
            { l: "Тейк 1 (1.5R)", v: a.tp1, c: "#00e5ff" },
            { l: "Тейк 2 (3R)", v: a.tp2, c: "#00ff88" },
          ].map((r) => (
            <div key={r.l} className="flex items-center justify-between border-b border-white/[0.04] py-1 last:border-0">
              <span className="font-mono text-[10.5px] text-[#8b98ab]">{r.l}</span>
              <span className="font-mono text-[11px] font-bold" style={{ color: r.c }}>
                {fmtPrice(r.v)}
              </span>
            </div>
          ))}
          <div className="mt-2 flex justify-between font-mono text-[9.5px] text-[#5d6b80]">
            <span>риск {riskPct.toFixed(2)}%</span>
            <span>ATR {fmtPrice(a.atr)}</span>
            <span>R:R 1:3</span>
          </div>
        </div>
      )}

      {/* зоны S/R */}
      {a.zones && (
        <div className="rounded-lg border hairline bg-[#161b22]/60 p-3">
          <div className="mb-2 font-mono text-[10px] tracking-widest text-[#8b98ab] uppercase">Зоны S/R</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
            {[
              ["L-High", a.zones.localHigh !== null ? fmtPrice(a.zones.localHigh) : "—", "#00e5ff"],
              ["High-D", fmtPrice(a.zones.rangeHigh), "#ffab00"],
              ["Low-D", fmtPrice(a.zones.rangeLow), "#ffab00"],
              ["L-Low", a.zones.localLow !== null ? fmtPrice(a.zones.localLow) : "—", "#00e5ff"],
            ].map(([k, v, c]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-[#5d6b80]">{k}</span>
                <span style={{ color: c as string }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between border-t border-white/[0.06] pt-1.5 font-mono text-[9.5px]">
            <span className="text-[#5d6b80]">
              Диапазон{" "}
              <span style={{ color: a.zones.rangeWideOk ? "#00ff88" : "#ff4466" }}>
                {a.zones.rangePct.toFixed(1)}%
              </span>
            </span>
            <span className="text-[#5d6b80]">
              Зазор ↑ <span className="text-[#c8d3e0]">{a.zones.upGapPct !== null ? Math.round(a.zones.upGapPct) + "%" : "—"}</span>
            </span>
            <span className="text-[#5d6b80]">
              ↓ <span className="text-[#c8d3e0]">{a.zones.dnGapPct !== null ? Math.round(a.zones.dnGapPct) + "%" : "—"}</span>
            </span>
          </div>
          {a.zoneSignal && (
            <div className="mt-2 border-t border-white/[0.06] pt-2 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-[#5d6b80]">Уровень отскока</span>
                <span className="text-[#e6edf3]">{fmtPrice(a.zoneSignal.level)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5d6b80]">Хвост свечи</span>
                <span className="text-[#c8d3e0]">{Math.round(a.zoneSignal.tailPct)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5d6b80]">Подтверждение</span>
                <span style={{ color: a.zoneSignal.confirmed ? "#00ff88" : "#ffab00" }}>
                  {a.zoneSignal.confirmed ? "готово" : `${a.zoneSignal.confirmBars}/2 бара`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5d6b80]">R:R до границы</span>
                <span className="text-[#00e5ff]">1:{a.zoneSignal.rr.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* чек-лист */}
      <div className="rounded-lg border hairline bg-[#161b22]/60 p-3">
        <div className="mb-2 font-mono text-[10px] tracking-widest text-[#8b98ab] uppercase">Разбор сигнала</div>
        {a.reasons.map((r) => (
          <div key={r.text} className="flex items-start gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
            {r.ok ? (
              <Check size={12} className="mt-0.5 shrink-0 text-[#00ff88]" />
            ) : (
              <X size={12} className="mt-0.5 shrink-0 text-[#3f4c60]" />
            )}
            <span className={`flex-1 text-[11px] ${r.ok ? "text-[#c8d3e0]" : "text-[#5d6b80]"}`}>{r.text}</span>
            <span className="font-mono text-[9.5px]" style={{ color: r.ok ? col : "#3f4c60" }}>
              +{r.w}
            </span>
          </div>
        ))}
      </div>

      {/* сырые метрики */}
      <div className="rounded-lg border hairline bg-[#161b22]/60 p-3">
        <div className="mb-2 font-mono text-[10px] tracking-widest text-[#8b98ab] uppercase">Метрики</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
          {[
            ["RF", a.rf.lastDir > 0 ? "LONG" : "SHORT", a.rf.lastDir > 0 ? "#00ff88" : "#ff4466"],
            ["RF→Jaw", a.rf.jawDistPct === null ? "—" : a.rf.jawDistPct < 0.5 ? "0%" : `-${Math.round(a.rf.jawDistPct)}%`, a.rf.jawTouch ? "#00e5ff" : "#8b98ab"],
            ["BB", `${Math.round(Math.abs(a.cc.bbPct))}%`, a.cc.bbPct > 0 ? "#00E676" : a.cc.bbPct < 0 ? "#FF1744" : "#78909C"],
            ["±100", `${Math.round(Math.abs(a.cc.p100))}%`, a.cc.p100 > 0 ? "#00E676" : a.cc.p100 < 0 ? "#FF1744" : "#78909C"],
            ["X", Math.abs(a.cc.xPct) === 777 ? "-" : `${Math.round(Math.abs(a.cc.xPct))}%`, a.cc.xPct > 0 ? "#00E676" : a.cc.xPct < 0 ? "#FF1744" : "#78909C"],
            ["BW", `${Math.round(a.cc.bwPct)}%`, a.cc.bwSig !== 0 ? "#00E5FF" : "#AB47BC"],
            ["СВГ", a.rf.svgBuy ? "BUY" : a.rf.svgSell ? "SELL" : "—", a.rf.svgBuy ? "#00ff88" : a.rf.svgSell ? "#ff4466" : "#5d6b80"],
            ["Ход", a.rf.svgMovePct ? `${a.rf.svgMovePct.toFixed(1)}%` : "—", "#c8d3e0"],
            [
              "MACD",
              a.macd.dir === 0 ? "—" : `${a.macd.dir > 0 ? "▲ BUY" : "▼ SELL"} ${a.macd.ago}b`,
              a.macd.isFresh ? (a.macd.dir > 0 ? "#00bcd4" : "#ff4466") : "#8b98ab",
            ],
            ["MACD DEMA", a.macd.demaOk ? "✓" : "✗", a.macd.demaOk ? "#00ff88" : "#ff4466"],
            [
              "MACD стадия",
              a.macd.sellStage2Bars.length > 0 || a.macd.buyStage2Bars.length > 0 ? "2 (подтв.)" : a.macd.sellStage1Bars.length > 0 || a.macd.buyStage1Bars.length > 0 ? "1 (MACD)" : "—",
              a.macd.sellStage2Bars.length > 0 || a.macd.buyStage2Bars.length > 0 ? "#00e5ff" : "#8b98ab",
            ],
            [
              "MACD Div",
              a.macd.divDir === 0 ? "—" : `${a.macd.divDir > 0 ? "▲" : "▼"} ${a.macd.divAgo}b`,
              a.macd.divDir === 0 ? "#5d6b80" : a.macd.divDir > 0 ? "#00bcd4" : "#ff6b78",
            ],
            [
              "Elliott",
              a.ew.waveLabel === "—" ? "—" : `${a.ew.waveLabel} ${a.ew.dir > 0 ? "▲" : "▼"} ${a.ew.ago}b`,
              a.ew.isFresh ? "#ff69b4" : "#8b98ab",
            ],
            ["EW бокс", a.ew.breakBox ? "пробит" : "—", a.ew.breakBox ? "#ff4466" : "#5d6b80"],
            [
              "DEMA",
              a.dema.dir === 1 ? "выше" : a.dema.dir === -1 ? "ниже" : "—",
              a.dema.dir === 1 ? "#9d8cff" : a.dema.dir === -1 ? "#ff69b4" : "#8b98ab",
            ],
            ["DEMA баров", a.dema.barsOnSide > 0 ? String(a.dema.barsOnSide) : "—", "#c8d3e0"],
            ["DEMA дистанция", `${a.dema.distPct.toFixed(2)}%`, a.dema.distPct >= 0 ? "#9d8cff" : "#ff69b4"],
            ["ADX", a.adx.lastAdx.toFixed(1), a.adx.aboveLevel ? "#ffab00" : "#8b98ab"],
            ["+DI", a.adx.lastPlusDI.toFixed(1), "#00ff88"],
            ["−DI", a.adx.lastMinusDI.toFixed(1), "#ff4466"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="flex justify-between">
              <span className="text-[#5d6b80]">{k}</span>
              <span style={{ color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-[#ffab00]/20 bg-[#ffab00]/[0.04] p-2.5">
        <Minus size={11} className="mt-0.5 shrink-0 text-[#ffab00]" />
        <p className="text-[9.5px] leading-relaxed text-[#8b98ab]">
          Расчёт по закрытым барам Bybit. Не является инвестиционной рекомендацией — проверяй сигнал на графике перед входом.
        </p>
      </div>
    </div>
  );
}
