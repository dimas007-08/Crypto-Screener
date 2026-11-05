// ─────────────────────────────────────────────────────────────
//  Настройки индикаторов — все параметры из Pine-кодов
// ─────────────────────────────────────────────────────────────

export interface RFSettings {
  // Range Filter
  rngPer: number;
  rngQty: number;
  // Аллигатор
  jawLen: number;
  jawOff: number;
  teethLen: number;
  teethOff: number;
  lipsLen: number;
  lipsOff: number;
  useAlliFilter: boolean;
  // СВГ: свинг + хвост
  swingLook: number;
  svgMoveThr: number;
  tailPct: number;
  // RF → Jaw
  jawFreshBars: number;
  // зона тренда
  zoneBarsMax: number;
}

export interface CCISettings {
  // CCI
  length: number;
  // сглаживание
  maLength: number;
  bbMult: number;
  // BW — ширина канала
  bwRefMax: number;
  bwNormLen: number;
  // сигнал импульсного расширения
  bwSigMin: number;
  bwSigHold: number;
  sbOn: boolean;
  sbBodyAtr: number;
  sbBodyPct: number;
  sbVolOn: boolean;
  sbVolMult: number;
  sbVolLen: number;
  // свежесть пробоя
  freshBars: number;
}

export interface ScoreWeights {
  rfDir: number;
  rfFresh: number;
  svg: number;
  jaw: number;
  bb: number;
  p100: number;
  x: number;
  bw: number;
  // ★ комбо-сигналы
  rfDouble: number; // обе метки RF совпали
  jawCross: number; // RF пересёк синюю челюсть
  jawCombo: number; // пересечение + подтверждение CCI на том же баре
  macdDiv: number; // дивергенция MACD
  zoneRev: number; // разворот от зоны поддержки/сопротивления
  adx: number; // свежий выход ADX выше порога
  ew: number; // структура волн Эллиотта
  dema: number; // цена по нужную сторону DEMA
  efi: number; // острый угол EFI
  squat: number; // приседающий бар Вильямса
}

export interface SignalSettings {
  maxBarsAgo: number; // сигнал считается актуальным N баров
  comboWindow: number; // окно совпадения RF-креста и CCI-сигнала
}

export interface MACDSettings {
  enabled: boolean;
  fastLen: number;
  slowLen: number;
  signalLen: number;
  freshBars: number;
  showLine: boolean;
  macdColor: string;
  signalColor: string;
  showDivergence: boolean;
}

export interface ADXSettings {
  enabled: boolean;
  diLength: number;
  smoothing: number;
  level: number;
  freshBars: number;
}

export interface EFISettings {
  enabled: boolean;
  length: number; // сглаживание EFI
  angleMin: number; // минимальный угол в градусах
  angleFilterUp: number; // порог для кнопки "выше"
  angleFilterDn: number; // порог для кнопки "ниже"
  freshBars: number;
  showLine: boolean;
  lineColor: string;
}

export interface DEMASettings {
  enabled: boolean;
  length: number;
  freshBars: number;
  showLine: boolean;
  lineColor: string;
  lineWidth: number;
}

export interface SquatSettings {
  enabled: boolean;
  seriesLen: number;
  freshBars: number;
  barColor: string;
}

export interface EWSettings {
  enabled: boolean;
  pivotLen: number;
  freshBars: number;
  showWaves: boolean;
  showLabels: boolean;
  waveColor: string;
}

export interface ZoneSettings {
  enabled: boolean;
  // границы дня — время в формате "ЧЧ:ММ" по локальному времени графика
  dayStartTime: string; // первая вертикаль, напр. "00:00"
  dayEndTime: string; // вторая вертикаль, напр. "00:00"
  daysBack: number; // 1 = вчерашний день
  showVertical: boolean;
  vertColor: string;
  // линии диапазона
  rangeColor: string;
  showRange: boolean;
  // локальные экстремумы
  pivotLen: number; // сколько баров слева/справа для пивота
  localColor: string;
  showLocal: boolean;
  // геометрия зон
  minRangePct: number; // мин. ширина диапазона High-D ↔ Low-D, % от цены
  maxGapPct: number; // макс. зазор в паре, % от ширины диапазона
  requireWideRange: boolean; // требовать широкий диапазон для сигнала
  // заливка зон
  fillZones: boolean;
  fillOpacity: number;
  // сигналы
  tailPct: number; // мин. доля хвоста разворотной свечи
  touchAtr: number; // допуск касания уровня в ATR
  freshBars: number; // сигнал свежий N баров
  confirmBars: number; // сколько баров подтверждения
  confirmBodyPct: number; // мин. тело подтверждающего бара
  lookbackBars: number; // как глубоко искать разворот
  stopPad: number; // отступ стопа от экстремума свечи
}

export interface Settings {
  rf: RFSettings;
  cci: CCISettings;
  macd: MACDSettings;
  adx: ADXSettings;
  efi: EFISettings;
  dema: DEMASettings;
  squat: SquatSettings;
  ew: EWSettings;
  zones: ZoneSettings;
  w: ScoreWeights;
  sig: SignalSettings;
  // риск-менеджмент
  slAtrMult: number;
  tp1R: number;
  tp2R: number;
  strongScore: number;
  showTradeLevels: boolean; // рисовать SL / TP1 / TP2 на графике
}

export const DEFAULTS: Settings = {
  rf: {
    rngPer: 20,
    rngQty: 3.5,
    jawLen: 13,
    jawOff: 8,
    teethLen: 8,
    teethOff: 5,
    lipsLen: 5,
    lipsOff: 3,
    useAlliFilter: true,
    swingLook: 30,
    svgMoveThr: 20,
    tailPct: 60,
    jawFreshBars: 1,
    zoneBarsMax: 100,
  },
  cci: {
    length: 200,
    maLength: 68,
    bbMult: 1.2,
    bwRefMax: 300,
    bwNormLen: 50,
    bwSigMin: 5,
    bwSigHold: 3,
    sbOn: true,
    sbBodyAtr: 1.2,
    sbBodyPct: 0.55,
    sbVolOn: true,
    sbVolMult: 1.5,
    sbVolLen: 20,
    freshBars: 1,
  },
  macd: {
    enabled: true,
    fastLen: 12,
    slowLen: 34,
    signalLen: 34,
    freshBars: 3,
    showLine: true,
    macdColor: "#00bcd4",
    signalColor: "#ffd600",
    showDivergence: true,
  },
  adx: {
    enabled: true,
    diLength: 14,
    smoothing: 14,
    level: 20,
    freshBars: 2,
  },
  efi: {
    enabled: true,
    length: 13,
    angleMin: 10,
    angleFilterUp: 10,
    angleFilterDn: 10,
    freshBars: 3,
    showLine: true,
    lineColor: "#ff9800",
  },
  dema: {
    enabled: true,
    length: 200,
    freshBars: 2,
    showLine: true,
    lineColor: "#9d8cff",
    lineWidth: 2,
  },
  squat: {
    enabled: true,
    seriesLen: 2,
    freshBars: 3,
    barColor: "#2979ff",
  },
  ew: {
    enabled: true,
    pivotLen: 8,
    freshBars: 3,
    showWaves: true,
    showLabels: true,
    waveColor: "#ff69b4",
  },
  zones: {
    enabled: true,
    dayStartTime: "00:00",
    dayEndTime: "00:00",
    daysBack: 1,
    showVertical: true,
    vertColor: "#8b98ab",
    rangeColor: "#ffab00",
    showRange: true,
    pivotLen: 3,
    localColor: "#00e5ff",
    showLocal: true,
    minRangePct: 1.5,
    maxGapPct: 35,
    requireWideRange: true,
    fillZones: true,
    fillOpacity: 10,
    tailPct: 45,
    touchAtr: 0.35,
    freshBars: 2,
    confirmBars: 2,
    confirmBodyPct: 0.5,
    lookbackBars: 40,
    stopPad: 0.15,
  },
  w: {
    rfDir: 14,
    rfFresh: 8,
    svg: 10,
    jaw: 6,
    bb: 10,
    p100: 8,
    x: 6,
    bw: 10,
    rfDouble: 18,
    jawCross: 16,
    jawCombo: 24,
    macdDiv: 16,
    zoneRev: 22,
    adx: 18,
    ew: 18,
    dema: 12,
    efi: 16,
    squat: 18,
  },
  sig: {
    maxBarsAgo: 1,
    comboWindow: 1,
  },
  slAtrMult: 0.3,
  tp1R: 1.5,
  tp2R: 3.0,
  strongScore: 70,
  showTradeLevels: true,
};

const KEY = "bybit-screener-settings-v9";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const p = JSON.parse(raw);
    return {
      rf: { ...DEFAULTS.rf, ...(p.rf ?? {}) },
      cci: { ...DEFAULTS.cci, ...(p.cci ?? {}) },
      macd: { ...DEFAULTS.macd, ...(p.macd ?? {}) },
      adx: { ...DEFAULTS.adx, ...(p.adx ?? {}) },
      efi: { ...DEFAULTS.efi, ...(p.efi ?? {}) },
      dema: { ...DEFAULTS.dema, ...(p.dema ?? {}) },
      squat: { ...DEFAULTS.squat, ...(p.squat ?? {}) },
      ew: { ...DEFAULTS.ew, ...(p.ew ?? {}) },
      zones: { ...DEFAULTS.zones, ...(p.zones ?? {}) },
      w: { ...DEFAULTS.w, ...(p.w ?? {}) },
      sig: { ...DEFAULTS.sig, ...(p.sig ?? {}) },
      slAtrMult: p.slAtrMult ?? DEFAULTS.slAtrMult,
      tp1R: p.tp1R ?? DEFAULTS.tp1R,
      tp2R: p.tp2R ?? DEFAULTS.tp2R,
      strongScore: p.strongScore ?? DEFAULTS.strongScore,
      showTradeLevels: p.showTradeLevels ?? DEFAULTS.showTradeLevels,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
