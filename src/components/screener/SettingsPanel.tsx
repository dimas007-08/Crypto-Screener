import { RotateCcw, X } from "lucide-react";
import { DEFAULTS, type Settings } from "../../lib/settings";

interface Props {
  S: Settings;
  set: (s: Settings) => void;
  onClose: () => void;
}

function Num({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-1" title={hint}>
      <span className="flex-1 font-mono text-[10px] text-[#8b98ab]">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 rounded border hairline bg-[#161b22] px-1.5 py-0.5 text-right font-mono text-[10px] text-[#e6edf3] outline-none focus:border-[#2962ff]/60"
      />
    </label>
  );
}

function Time({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-1" title={hint}>
      <span className="flex-1 font-mono text-[10px] text-[#8b98ab]">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value || "00:00")}
        className="w-20 rounded border hairline bg-[#161b22] px-1.5 py-0.5 text-right font-mono text-[10px] text-[#e6edf3] outline-none focus:border-[#2962ff]/60 [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:invert"
      />
    </label>
  );
}

function Bool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-1">
      <span className="flex-1 font-mono text-[10px] text-[#8b98ab]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`h-4 w-8 rounded-full transition-colors ${value ? "bg-[#00ff88]" : "bg-[#2a3546]"}`}
      >
        <span
          className={`block h-3 w-3 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}

function Group({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border hairline bg-[#161b22]/50 p-2.5">
      <div className="mb-1 font-mono text-[9.5px] tracking-widest uppercase" style={{ color }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPanel({ S, set, onClose }: Props) {
  const rf = (k: keyof Settings["rf"], v: number | boolean) => set({ ...S, rf: { ...S.rf, [k]: v } });
  const cc = (k: keyof Settings["cci"], v: number | boolean) => set({ ...S, cci: { ...S.cci, [k]: v } });
  const wt = (k: keyof Settings["w"], v: number) => set({ ...S, w: { ...S.w, [k]: v } });
  const mc = (k: keyof Settings["macd"], v: number | boolean) =>
    set({ ...S, macd: { ...S.macd, [k]: v } });
  const adx = (k: keyof Settings["adx"], v: number | boolean) =>
    set({ ...S, adx: { ...S.adx, [k]: v } });
  const ewc = (k: keyof Settings["ew"], v: number | boolean) =>
    set({ ...S, ew: { ...S.ew, [k]: v } });
  const dm = (k: keyof Settings["dema"], v: number | boolean) =>
    set({ ...S, dema: { ...S.dema, [k]: v } });
  const ef = (k: keyof Settings["efi"], v: number | boolean) =>
    set({ ...S, efi: { ...S.efi, [k]: v } });
  const sq = (k: keyof Settings["squat"], v: number | boolean) =>
    set({ ...S, squat: { ...S.squat, [k]: v } });
  const zn = (k: keyof Settings["zones"], v: number | boolean) =>
    set({ ...S, zones: { ...S.zones, [k]: v } });
  const znStr = (k: keyof Settings["zones"], v: string) =>
    set({ ...S, zones: { ...S.zones, [k]: v } });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-[340px] flex-col border-l hairline bg-[#0d1117]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b hairline px-3 py-2.5">
          <span className="font-display text-xs font-bold text-[#e6edf3]">Настройки индикаторов</span>
          <button
            onClick={() => set(structuredClone(DEFAULTS))}
            className="ml-auto flex items-center gap-1 rounded bg-[#161b22] px-2 py-1 font-mono text-[9.5px] text-[#8b98ab] hover:text-[#ffab00]"
          >
            <RotateCcw size={10} />
            Сброс
          </button>
          <button onClick={onClose} className="rounded bg-[#161b22] p-1 text-[#8b98ab] hover:text-[#ff4466]">
            <X size={12} />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
          <Group title="⚡ Range Filter" color="#00ff88">
            <Num label="Swing Period" value={S.rf.rngPer} onChange={(v) => rf("rngPer", v)} min={1} />
            <Num label="Swing Multiplier" value={S.rf.rngQty} onChange={(v) => rf("rngQty", v)} step={0.1} min={0.1} />
          </Group>

          <Group title="🐊 Аллигатор" color="#4994ec">
            <Num label="Челюсть период" value={S.rf.jawLen} onChange={(v) => rf("jawLen", v)} min={1} />
            <Num label="Челюсть сдвиг" value={S.rf.jawOff} onChange={(v) => rf("jawOff", v)} min={0} />
            <Num label="Зубы период" value={S.rf.teethLen} onChange={(v) => rf("teethLen", v)} min={1} />
            <Num label="Зубы сдвиг" value={S.rf.teethOff} onChange={(v) => rf("teethOff", v)} min={0} />
            <Num label="Губы период" value={S.rf.lipsLen} onChange={(v) => rf("lipsLen", v)} min={1} />
            <Num label="Губы сдвиг" value={S.rf.lipsOff} onChange={(v) => rf("lipsOff", v)} min={0} />
            <Bool label="Фильтр тренда Аллигатора" value={S.rf.useAlliFilter} onChange={(v) => rf("useAlliFilter", v)} />
          </Group>

          <Group title="📐 СВГ · свинг и хвост" color="#ffab00">
            <Num label="Свинг период" value={S.rf.swingLook} onChange={(v) => rf("swingLook", v)} min={2} />
            <Num label="Рост/падение %" value={S.rf.svgMoveThr} onChange={(v) => rf("svgMoveThr", v)} min={1} />
            <Num label="Хвост ≥ % свечи" value={S.rf.tailPct} onChange={(v) => rf("tailPct", v)} min={20} max={95} />
          </Group>

          <Group title="📊 RF → Челюсть · зона" color="#00e5ff">
            <Num label="Свежее касание, баров" value={S.rf.jawFreshBars} onChange={(v) => rf("jawFreshBars", v)} min={1} max={5} />
            <Num label="Макс. баров зоны = 100%" value={S.rf.zoneBarsMax} onChange={(v) => rf("zoneBarsMax", v)} min={5} />
          </Group>

          <Group title="📈 CCI + Bollinger" color="#2962ff">
            <Num label="CCI Length" value={S.cci.length} onChange={(v) => cc("length", v)} min={1} />
            <Num label="MA Length" value={S.cci.maLength} onChange={(v) => cc("maLength", v)} min={1} />
            <Num label="BB StdDev" value={S.cci.bbMult} onChange={(v) => cc("bbMult", v)} step={0.1} min={0.1} />
          </Group>

          <Group title="🟣 Ширина канала BW" color="#AB47BC">
            <Num
              label="100% шкалы = N пунктов"
              value={S.cci.bwRefMax}
              onChange={(v) => cc("bwRefMax", v)}
              step={10}
              min={20}
              hint="Ширина канала в пунктах CCI, которую считать максимумом шкалы"
            />
            <Num label="База для сигнала, баров" value={S.cci.bwNormLen} onChange={(v) => cc("bwNormLen", v)} min={5} />
          </Group>

          <Group title="⚡ Импульсное расширение" color="#00e5ff">
            <Num label="Прирост за бар ≥ %" value={S.cci.bwSigMin} onChange={(v) => cc("bwSigMin", v)} step={0.5} min={0.5} />
            <Num label="Держать сигнал, баров" value={S.cci.bwSigHold} onChange={(v) => cc("bwSigHold", v)} min={1} max={20} />
            <Bool label="Требовать сильный бар" value={S.cci.sbOn} onChange={(v) => cc("sbOn", v)} />
            <Num label="Тело ≥ N × ATR" value={S.cci.sbBodyAtr} onChange={(v) => cc("sbBodyAtr", v)} step={0.1} min={0.2} />
            <Num label="Доля тела ≥" value={S.cci.sbBodyPct} onChange={(v) => cc("sbBodyPct", v)} step={0.05} min={0.2} max={0.95} />
            <Bool label="Требовать объём" value={S.cci.sbVolOn} onChange={(v) => cc("sbVolOn", v)} />
            <Num label="Объём ≥ N × средний" value={S.cci.sbVolMult} onChange={(v) => cc("sbVolMult", v)} step={0.1} min={1} />
            <Num label="Период объёма" value={S.cci.sbVolLen} onChange={(v) => cc("sbVolLen", v)} min={5} />
          </Group>

          <Group title="📊 MACD" color="#00bcd4">
            <Bool label="Показывать MACD" value={S.macd.enabled} onChange={(v) => mc("enabled", v)} />
            <Num label="Fast Length" value={S.macd.fastLen} onChange={(v) => mc("fastLen", v)} min={1} max={200} />
            <Num label="Slow Length" value={S.macd.slowLen} onChange={(v) => mc("slowLen", v)} min={1} max={400} />
            <Num label="Signal Length" value={S.macd.signalLen} onChange={(v) => mc("signalLen", v)} min={1} max={400} />
            <Num
              label="Сигнал свежий, баров"
              value={S.macd.freshBars}
              onChange={(v) => mc("freshBars", v)}
              min={0}
              max={20}
            />
            <Bool label="Линии на графике" value={S.macd.showLine} onChange={(v) => mc("showLine", v)} />
            <Bool label="Дивергенции" value={S.macd.showDivergence} onChange={(v) => mc("showDivergence", v)} />
          </Group>

          <Group title="📈 DEMA" color="#9d8cff">
            <Bool label="Показывать DEMA" value={S.dema.enabled} onChange={(v) => dm("enabled", v)} />
            <Num
              label="Период"
              value={S.dema.length}
              onChange={(v) => dm("length", v)}
              min={1}
              max={500}
              hint="DEMA = 2·EMA − EMA(EMA). 200 — классический фильтр тренда"
            />
            <Bool label="Линия на графике" value={S.dema.showLine} onChange={(v) => dm("showLine", v)} />
            <Num label="Толщина линии" value={S.dema.lineWidth} onChange={(v) => dm("lineWidth", v)} min={1} max={6} />
          </Group>

          <Group title="⚡ EFI" color="#ff9800">
            <Bool label="Показывать EFI" value={S.efi.enabled} onChange={(v) => ef("enabled", v)} />
            <Num
              label="Период сглаживания"
              value={S.efi.length}
              onChange={(v) => ef("length", v)}
              min={1}
              max={100}
              hint="EFI = (close − close[1]) × volume, сглажено EMA"
            />
            <Num
              label="Мин. угол, °"
              value={S.efi.angleMin}
              onChange={(v) => ef("angleMin", v)}
              min={1}
              max={80}
              hint="Какой угол отклонения EFI от нуля считать всплеском"
            />
            <Num
              label="Кнопка ▲ — угол ≥"
              value={S.efi.angleFilterUp}
              onChange={(v) => ef("angleFilterUp", v)}
              min={1}
              max={80}
              hint="Порог для фильтра EFI вверх"
            />
            <Num
              label="Кнопка ▼ — угол ≥"
              value={S.efi.angleFilterDn}
              onChange={(v) => ef("angleFilterDn", v)}
              min={1}
              max={80}
              hint="Порог для фильтра EFI вниз"
            />
            <Num
              label="Сигнал свежий, баров"
              value={S.efi.freshBars}
              onChange={(v) => ef("freshBars", v)}
              min={0}
              max={20}
            />
            <Bool label="Линия на графике" value={S.efi.showLine} onChange={(v) => ef("showLine", v)} />
          </Group>

          <Group title="🪑 Приседающий бар" color="#2979ff">
            <Bool label="Показывать бары" value={S.squat.enabled} onChange={(v) => sq("enabled", v)} />
            <Num
              label="Баров в серии"
              value={S.squat.seriesLen}
              onChange={(v) => sq("seriesLen", v)}
              min={2}
              max={5}
              hint="Минимум приседающих баров подряд для сигнала"
            />
            <Num
              label="Серия свежая, баров"
              value={S.squat.freshBars}
              onChange={(v) => sq("freshBars", v)}
              min={0}
              max={20}
            />
          </Group>

          <Group title="🌊 Elliott Wave" color="#ff69b4">
            <Bool label="Показывать волны" value={S.ew.enabled} onChange={(v) => ewc("enabled", v)} />
            <Num
              label="ZigZag длина"
              value={S.ew.pivotLen}
              onChange={(v) => ewc("pivotLen", v)}
              min={2}
              max={50}
              hint="Сколько баров слева для определения пивота"
            />
            <Num
              label="Сигнал свежий, баров"
              value={S.ew.freshBars}
              onChange={(v) => ewc("freshBars", v)}
              min={0}
              max={30}
            />
            <Bool label="Линии волн" value={S.ew.showWaves} onChange={(v) => ewc("showWaves", v)} />
            <Bool label="Подписи 12345/ABC" value={S.ew.showLabels} onChange={(v) => ewc("showLabels", v)} />
          </Group>

          <Group title="📶 ADX / DMI" color="#ffab00">
            <Bool label="Показывать ADX" value={S.adx.enabled} onChange={(v) => adx("enabled", v)} />
            <Num label="DI Length" value={S.adx.diLength} onChange={(v) => adx("diLength", v)} min={1} />
            <Num
              label="ADX Smoothing"
              value={S.adx.smoothing}
              onChange={(v) => adx("smoothing", v)}
              min={1}
            />
            <Num
              label="Сигнальный уровень"
              value={S.adx.level}
              onChange={(v) => adx("level", v)}
              min={1}
              max={100}
              hint="Стандартный уровень силы тренда — 20"
            />
            <Num
              label="Сигнал свежий, баров"
              value={S.adx.freshBars}
              onChange={(v) => adx("freshBars", v)}
              min={0}
              max={20}
            />
          </Group>

          <Group title="🎯 Зоны S/R" color="#ffab00">
            <Bool label="Показывать зоны" value={S.zones.enabled} onChange={(v) => zn("enabled", v)} />
            <Time
              label="1-я вертикаль"
              value={S.zones.dayStartTime}
              onChange={(v) => znStr("dayStartTime", v)}
              hint="Начало диапазона. По умолчанию 00:00"
            />
            <Time
              label="2-я вертикаль"
              value={S.zones.dayEndTime}
              onChange={(v) => znStr("dayEndTime", v)}
              hint="Окончание диапазона. По умолчанию 00:00 следующих суток. Если время ≤ начала — переносится на сутки вперёд"
            />
            <Num
              label="Дней назад"
              value={S.zones.daysBack}
              onChange={(v) => zn("daysBack", v)}
              min={1}
              max={10}
              hint="1 = вчерашний день"
            />
            <Bool label="Вертикали границ" value={S.zones.showVertical} onChange={(v) => zn("showVertical", v)} />
            <Bool label="Линии диапазона" value={S.zones.showRange} onChange={(v) => zn("showRange", v)} />
            <Bool label="Локальные экстремумы" value={S.zones.showLocal} onChange={(v) => zn("showLocal", v)} />
            <Num
              label="Пивот, баров по краям"
              value={S.zones.pivotLen}
              onChange={(v) => zn("pivotLen", v)}
              min={1}
              max={20}
              hint="Сколько баров слева и справа должно быть ниже/выше для локального экстремума"
            />
            <Bool label="Заливка зон" value={S.zones.fillZones} onChange={(v) => zn("fillZones", v)} />
            <Num label="Прозрачность заливки" value={S.zones.fillOpacity} onChange={(v) => zn("fillOpacity", v)} min={0} max={50} />
          </Group>

          <Group title="📐 Геометрия зон" color="#ff9800">
            <Num
              label="Диапазон ≥ % от цены"
              value={S.zones.minRangePct}
              onChange={(v) => zn("minRangePct", v)}
              step={0.1}
              min={0.1}
              max={30}
              hint="High-D ↔ Low-D должны быть широко расставлены, иначе тейк бессмысленный"
            />
            <Num
              label="Зазор пары ≤ % диапазона"
              value={S.zones.maxGapPct}
              onChange={(v) => zn("maxGapPct", v)}
              step={5}
              min={5}
              max={100}
              hint="Расстояние High-D ↔ L-High должно быть минимальным. 35% = локальный не дальше трети диапазона"
            />
            <Bool
              label="Требовать широкий диапазон"
              value={S.zones.requireWideRange}
              onChange={(v) => zn("requireWideRange", v)}
            />
          </Group>

          <Group title="🕯 Разворотный сигнал" color="#00ff88">
            <Num
              label="Хвост свечи ≥ %"
              value={S.zones.tailPct}
              onChange={(v) => zn("tailPct", v)}
              min={20}
              max={90}
              hint="Минимальная доля хвоста в разворотной свече"
            />
            <Num
              label="Допуск касания × ATR"
              value={S.zones.touchAtr}
              onChange={(v) => zn("touchAtr", v)}
            />
          </Group>

          <Group title="🕯 Разворотный сигнал" color="#00ff88">
            <Num
              label="Хвост свечи ≥ %"
              value={S.zones.tailPct}
              onChange={(v) => zn("tailPct", v)}
              min={20}
              max={90}
              hint="Минимальная доля хвоста в разворотной свече"
            />
            <Num
              label="Допуск касания × ATR"
              value={S.zones.touchAtr}
              onChange={(v) => zn("touchAtr", v)}
              step={0.05}
              min={0}
              max={2}
              hint="Насколько близко свеча должна подойти к уровню"
            />
            <Num
              label="Сигнал свежий, баров"
              value={S.zones.freshBars}
              onChange={(v) => zn("freshBars", v)}
              min={0}
              max={10}
              hint="Запас после закрытия разворотной свечи"
            />
            <Num
              label="Подтверждение, баров"
              value={S.zones.confirmBars}
              onChange={(v) => zn("confirmBars", v)}
              min={1}
              max={5}
              hint="Сколько уверенных баров нужно для входа"
            />
            <Num
              label="Тело подтв. бара ≥"
              value={S.zones.confirmBodyPct}
              onChange={(v) => zn("confirmBodyPct", v)}
              step={0.05}
              min={0.2}
              max={0.95}
            />
            <Num
              label="Сигнал свежий, баров"
              value={S.zones.freshBars}
              onChange={(v) => zn("freshBars", v)}
              min={0}
              max={10}
              hint="Запас после закрытия разворотной свечи"
            />
            <Num
              label="Подтверждение, баров"
              value={S.zones.confirmBars}
              onChange={(v) => zn("confirmBars", v)}
              min={1}
              max={5}
              hint="Сколько уверенных баров нужно для входа"
            />
            <Num
              label="Тело подтв. бара ≥"
              value={S.zones.confirmBodyPct}
              onChange={(v) => zn("confirmBodyPct", v)}
              step={0.05}
              min={0.2}
              max={0.95}
            />
            <Num label="Глубина поиска, баров" value={S.zones.lookbackBars} onChange={(v) => zn("lookbackBars", v)} min={5} max={200} />
            <Num
              label="Отступ стопа"
              value={S.zones.stopPad}
              onChange={(v) => zn("stopPad", v)}
              step={0.05}
              min={0}
              max={1}
              hint="Доля размаха разворотной свечи, на которую стоп уходит за экстремум"
            />
          </Group>

          <Group title="🔥 Сильные сигналы" color="#ffd600">
            <Num
              label="Сигнал свежий, баров"
              value={S.sig.maxBarsAgo}
              onChange={(v) => set({ ...S, sig: { ...S.sig, maxBarsAgo: v } })}
              min={0}
              max={20}
              hint="Не показывать сигналы старше N баров"
            />
            <Num
              label="Окно совпадения RF×CCI"
              value={S.sig.comboWindow}
              onChange={(v) => set({ ...S, sig: { ...S.sig, comboWindow: v } })}
              min={0}
              max={10}
              hint="Насколько близко должны совпасть пересечение челюсти и сигнал CCI"
            />
          </Group>

          <Group title="🎯 Веса скоринга" color="#ffd600">
            <Num label="Направление RF" value={S.w.rfDir} onChange={(v) => wt("rfDir", v)} min={0} />
            <Num label="Свежий разворот RF" value={S.w.rfFresh} onChange={(v) => wt("rfFresh", v)} min={0} />
            <Num label="СВГ сигнал" value={S.w.svg} onChange={(v) => wt("svg", v)} min={0} />
            <Num label="Касание челюсти" value={S.w.jaw} onChange={(v) => wt("jaw", v)} min={0} />
            <Num label="Пробой BB" value={S.w.bb} onChange={(v) => wt("bb", v)} min={0} />
            <Num label="Зона ±100" value={S.w.p100} onChange={(v) => wt("p100", v)} min={0} />
            <Num label="CCI × MA" value={S.w.x} onChange={(v) => wt("x", v)} min={0} />
            <Num label="Расширение BB" value={S.w.bw} onChange={(v) => wt("bw", v)} min={0} />
            <Num label="★ Двойная метка RF" value={S.w.rfDouble} onChange={(v) => wt("rfDouble", v)} min={0} />
            <Num label="★ RF × челюсть" value={S.w.jawCross} onChange={(v) => wt("jawCross", v)} min={0} />
            <Num label="🔥 Крест + CCI" value={S.w.jawCombo} onChange={(v) => wt("jawCombo", v)} min={0} />
            <Num label="🌊 Дивергенция WT" value={S.w.macdDiv} onChange={(v) => wt("macdDiv", v)} min={0} />
            <Num label="🎯 Разворот от зоны" value={S.w.zoneRev} onChange={(v) => wt("zoneRev", v)} min={0} />
            <Num label="📶 ADX выше уровня" value={S.w.adx} onChange={(v) => wt("adx", v)} min={0} />
            <Num label="🌊 Elliott Wave" value={S.w.ew} onChange={(v) => wt("ew", v)} min={0} />
            <Num label="🪑 Приседающий бар" value={S.w.squat} onChange={(v) => wt("squat", v)} min={0} />
            <Num label="📈 DEMA тренд" value={S.w.dema} onChange={(v) => wt("dema", v)} min={0} />
          </Group>

          <Group title="🛡️ Риск-менеджмент" color="#ff4466">
            <Num label="Отступ стопа × ATR" value={S.slAtrMult} onChange={(v) => set({ ...S, slAtrMult: v })} step={0.1} min={0} />
            <Num label="Тейк 1 (R)" value={S.tp1R} onChange={(v) => set({ ...S, tp1R: v })} step={0.1} min={0.1} />
            <Num label="Тейк 2 (R)" value={S.tp2R} onChange={(v) => set({ ...S, tp2R: v })} step={0.1} min={0.1} />
            <Num label="Сильный сигнал от" value={S.strongScore} onChange={(v) => set({ ...S, strongScore: v })} min={10} max={100} />
            <Bool
              label="Линии SL / TP на графике"
              value={S.showTradeLevels}
              onChange={(v) => set({ ...S, showTradeLevels: v })}
            />
          </Group>

          <p className="px-1 pb-2 text-[9px] leading-relaxed text-[#3f4c60]">
            Настройки сохраняются в браузере. После изменения нажми «Сканировать», чтобы пересчитать рынок с новыми
            параметрами.
          </p>
        </div>
      </div>
    </div>
  );
}
