// ─────────────────────────────────────────────────────────────
//  RF + СВГ + Зоны S/R — Pine Script v6 для TradingView
//  Range Filter · Аллигатор · СВГ · High-D/Low-D · L-High/L-Low
// ─────────────────────────────────────────────────────────────

export const PINE_RF_ZONES = `//@version=6
indicator("⚡ RF + СВГ + Зоны S/R", shorttitle="RF+СВГ+SR", overlay=true,
     max_lines_count=500, max_labels_count=500, max_boxes_count=500)

// ═════════════════════════════════════════════════════════════
//  ⚙️ НАСТРОЙКИ
// ═════════════════════════════════════════════════════════════

// ── Range Filter ──
string g1 = "⚡ Range Filter"
float rngSrc  = input.source(close, "Swing Source",     group=g1)
int   rngPer  = input.int(20,   "Swing Period",         minval=1, group=g1)
float rngQty  = input.float(3.5,"Swing Multiplier",     minval=0.0000001, group=g1)

// ── Аллигатор ──
string g2 = "🐊 Аллигатор"
bool  showJaw    = input.bool(true, "Показывать челюсть",  group=g2)
int   jawLen     = input.int(13,    "Челюсть период",      minval=1, group=g2)
int   jawOff     = input.int(8,     "Челюсть сдвиг",       minval=0, group=g2)

// ── СВГ ──
string g3 = "📐 СВГ"
bool  showSVG    = input.bool(true,  "Показать СВГ",       group=g3)
int   swingLook  = input.int(30,     "Свинг период",       minval=2, group=g3)
float svgMoveThr = input.float(20.0, "Рост/падение %",     group=g3)
float tailPctIn  = input.float(60.0, "Хвост ≥ % свечи",    group=g3)
color svgBuyCol  = input.color(#05ff9b, "BUY",  group=g3, inline="sv")
color svgSellCol = input.color(#ff0583, "SELL", group=g3, inline="sv")

// ── Зоны S/R: границы диапазона ──
string g4 = "🎯 Зоны S/R · Границы"
bool  zonesOn     = input.bool(true,  "Показывать зоны",          group=g4)
string tStart     = input.timeframe("D", "ТФ диапазона",          group=g4,
     tooltip="Таймфрейм, по которому считаются границы суток. D = дневной")
int   daysBackIn  = input.int(1,     "Дней назад",                minval=1, maxval=10, group=g4,
     tooltip="1 = вчерашний день. Границы берутся за N дней назад")
bool  showVert    = input.bool(true, "Вертикали 00:00",           group=g4)
color vertCol     = input.color(#8b98ab, "Цвет вертикалей",        group=g4)
bool  showRange   = input.bool(true, "Линии High-D / Low-D",      group=g4)
color rangeCol    = input.color(#ffab00, "Цвет диапазона",        group=g4)
bool  showLocal   = input.bool(true, "Линии L-High / L-Low",      group=g4)
color localCol    = input.color(#00e5ff, "Цвет локальных",        group=g4)
bool  fillZones   = input.bool(true, "Заливка зон",               group=g4)
color supFillCol  = input.color(#00ff88, "Заливка поддержки",     group=g4, inline="fz")
color resFillCol  = input.color(#ff4466, "Заливка сопротивления", group=g4, inline="fz")
int   fillTransp  = input.int(88,    "Прозрачность заливки",      minval=50, maxval=98, group=g4)

// ── Зоны S/R: параметры поиска ──
string g5 = "🔍 Зоны S/R · Поиск"
int   pivotLen    = input.int(3,     "Пивот, баров по краям",     minval=1, maxval=20, group=g5,
     tooltip="Сколько баров слева и справада должно быть ниже/выше для локального экстремума")
float minRangePct = input.float(1.5, "Диапазон ≥ % от цены",      minval=0.1, step=0.1, group=g5,
     tooltip="Минимальная ширина High-D ↔ Low-D, иначе тейк не имеет смысла")
float maxGapPct   = input.float(35.0,"Зазор пары ≤ % диапазона",  minval=5, maxval=100, step=5, group=g5,
     tooltip="Максимальное расстояние High-D ↔ L-High в процентах от ширины диапазона")
bool  requireWide = input.bool(true, "Требовать широкий диапазон", group=g5)

// ── Зоны S/R: разворотный сигнал ──
string g6 = "🕯 Разворотный сигнал"
bool  revOn       = input.bool(true,  "Искать развороты",          group=g6)
float revTailPct  = input.float(45.0, "Хвост свечи ≥ %",           minval=20, maxval=90, group=g6)
float touchAtr    = input.float(0.35, "Допуск касания × ATR",      minval=0.05, step=0.05, group=g6)
int   freshBars   = input.int(2,     "Сигнал свежий, баров",       minval=0, maxval=10, group=g6)
int   confirmBars = input.int(2,     "Подтверждение, баров",       minval=1, maxval=5, group=g6)
float confBodyPct = input.float(0.5, "Тело подтв. бара ≥",         minval=0.2, maxval=0.95, group=g6)
int   lookbackBrs = input.int(40,    "Глубина поиска, баров",      minval=5, maxval=200, group=g6)
float stopPad     = input.float(0.15,"Отступ стопа",               minval=0, maxval=1, step=0.05, group=g6)
bool  showRevMark = input.bool(true, "Маркер разворота",           group=g6)
bool  showSLTP    = input.bool(true, "Линии SL / TP на графике",   group=g6)

// ── МТФ таблица ──
string g7 = "🌐 МТФ"
bool   showTable    = input.bool(true,                "Показать таблицу",          group=g7)
string tblSymbol1   = input.string("BINANCE:BTCUSDT", "Символ 1 (базовый)",       group=g7)
string tblSymbol2   = input.string("",                "Символ 2 (пусто=текущий)", group=g7)
string tblPosition  = input.string("Справа вверху",   "Позиция", options=["Слева вверху","Центр вверху","Справа вверху","Слева в центре","Центр","Справа в центре","Слева внизу","Центр внизу","Справа внизу"], group=g7)
string tblSize      = input.string("small",            "Размер", options=["tiny","small","normal","large"], group=g7)
color  tblBuyCol    = input.color(#00ff88,            "Фон BUY",   group=g7, inline="t1")
color  tblSellCol   = input.color(#ff4466,            "Фон SELL",  group=g7, inline="t1")
color  tblFreshCol  = input.color(#00e5ff,            "Цвет свежего", group=g7)

string tf1 = input.timeframe("5",   "TF 1", group=g7, inline="a")
string tf2 = input.timeframe("15",  "TF 2", group=g7, inline="a")
string tf3 = input.timeframe("30",  "TF 3", group=g7, inline="b")
string tf4 = input.timeframe("60",  "TF 4", group=g7, inline="b")
string tf5 = input.timeframe("240", "TF 5", group=g7, inline="c")
string tf6 = input.timeframe("D",   "TF 6", group=g7, inline="c")

// ═════════════════════════════════════════════════════════════
//  ⚡ RANGE FILTER
// ═════════════════════════════════════════════════════════════

f_rfFilter() =>
    int   wper  = rngPer * 2 - 1
    float avrng = ta.ema(math.abs(rngSrc - rngSrc[1]), rngPer)
    float r     = ta.ema(avrng, wper) * rngQty
    var float rf = rngSrc
    if rngSrc - r > rf[1]
        rf := rngSrc - r
    if rngSrc + r < rf[1]
        rf := rngSrc + r
    [rf, r]

[rfLine, rfRange] = f_rfFilter()

// Направление RF: var сохраняет предыдущее значение при отсутствии изменения
var float dir = 0.0
dir := rfLine > rfLine[1] ? 1 : rfLine < rfLine[1] ? -1 : dir
var int barsZone = 0
barsZone := dir != dir[1] ? 1 : barsZone + 1

// сигналы разворота RF
var int condIni = 0
bool longCond  = rngSrc > rfLine and dir == 1
bool shortCond = rngSrc < rfLine and dir == -1
condIni := longCond ? 1 : shortCond ? -1 : condIni
bool rfBuy  = longCond  and condIni[1] == -1
bool rfSell = shortCond and condIni[1] == 1

// ═════════════════════════════════════════════════════════════
//  🐊 АЛЛИГАТОР — только синяя челюсть
// ═════════════════════════════════════════════════════════════

float jaw = ta.rma(hl2, jawLen)
// Pine не поддерживает CSS-функцию rgba(). Второй аргумент color.new —
// прозрачность 0…100; 10 соответствует примерно 90% непрозрачности.
plot(showJaw ? jaw : na, "Челюсть", color=color.new(#2962ff, 10), linewidth=2, offset=jawOff)

// RF × Jaw пересечения
float jawVis = nz(jaw[jawOff], jaw)
bool jawCrossUp = rfLine[1] <= nz(jaw[jawOff+1], jaw[1]) and rfLine > jawVis
bool jawCrossDn = rfLine[1] >= nz(jaw[jawOff+1], jaw[1]) and rfLine < jawVis
var int jawCrossDir = 0
var int jawCrossAgo = 999
if jawCrossUp
    jawCrossDir := 1
    jawCrossAgo := 0
else if jawCrossDn
    jawCrossDir := -1
    jawCrossAgo := 0
else
    jawCrossAgo := jawCrossAgo + 1

// ═════════════════════════════════════════════════════════════
//  🎯 ЗОНЫ S/R
// ═════════════════════════════════════════════════════════════

// ── Границы диапазона за N дней назад ──
// Берём данные дневного ТФ через request.security
f_dayBounds() =>
    [h, l, o, c] = request.security(syminfo.tickerid, tStart,
         [high, low, open, close], lookahead=barmerge.lookahead_off)
    [h, l, o, c]

// Максимум и минимум выбранного дня
// daysBackIn=1 → вчерашний день
float dayHigh = request.security(syminfo.tickerid, tStart,
     high[daysBackIn], lookahead=barmerge.lookahead_on)
float dayLow  = request.security(syminfo.tickerid, tStart,
     low[daysBackIn],  lookahead=barmerge.lookahead_on)

// Время границ (00:00 начала и 00:00 окончания)
var int dayStartTime = na
var int dayEndTime   = na
if barstate.isfirst or na(dayStartTime)
    dayStartTime := time - (daysBackIn + 1) * 86400000
    dayEndTime   := dayStartTime + 86400000

// Точнее: берём фактическое время из дневного ТФ
f_dayTime() =>
    request.security(syminfo.tickerid, tStart,
         time[daysBackIn], lookahead=barmerge.lookahead_on)

float rawDayTime = f_dayTime()
if not na(rawDayTime)
    dayStartTime := int(rawDayTime)
    dayEndTime   := int(rawDayTime) + 86400000

// ── Локальные экстремумы после границы дня ──
// L-High: первый пивот-максимум выше High-D
// L-Low:  первый пивот-минимум ниже Low-D
var float lHigh    = na
var int   lHighBar = na
var float lLow     = na
var int   lLowBar  = na

// ta.pivothigh/ta.pivotlow возвращают цену пивота (float) или na, не bool.
float pivotHighPrice = ta.pivothigh(high, pivotLen, pivotLen)
float pivotLowPrice  = ta.pivotlow(low,  pivotLen, pivotLen)

// ищем только после окончания дня
bool afterDay = time >= dayEndTime

if zonesOn and afterDay
    if na(lHigh) and not na(pivotHighPrice) and pivotHighPrice > dayHigh
        lHigh    := pivotHighPrice
        lHighBar := bar_index - pivotLen
    if na(lLow) and not na(pivotLowPrice) and pivotLowPrice < dayLow
        lLow    := pivotLowPrice
        lLowBar := bar_index - pivotLen

// сброс при новом дне
if ta.change(time(tStart)) != 0
    lHigh    := na
    lLow     := na
    lHighBar := na
    lLowBar  := na

// ── Геометрия зон ──
float rangeSize  = dayHigh - dayLow
float rangePct   = dayLow > 0 ? (rangeSize / dayLow) * 100 : 0
bool  rangeWide  = rangePct >= minRangePct
float upGapPct   = not na(lHigh) and rangeSize > 0 ? ((lHigh - dayHigh) / rangeSize) * 100 : na
float dnGapPct   = not na(lLow)  and rangeSize > 0 ? ((dayLow - lLow) / rangeSize) * 100 : na

// ═════════════════════════════════════════════════════════════
//  🕯 РАЗВОРОТНЫЕ СИГНАЛЫ ОТ ЗОН
// ═════════════════════════════════════════════════════════════

float atr14 = ta.atr(14)

// Разворотная свеча: коснулась/прошила уровень и закрылась обратно
f_checkRev() =>
    float rng    = high - low
    float upTail = high - math.max(open, close)
    float dnTail = math.min(open, close) - low

    // уровни для продажи (сопротивление)
    bool touchedLH = not na(lHigh) and high >= lHigh - atr14 * touchAtr
    bool piercedLH = not na(lHigh) and high > lHigh
    bool closedLH  = close < lHigh
    bool sellLH    = touchedLH and closedLH and (upTail / rng >= revTailPct / 100)

    bool touchedHD = high >= dayHigh - atr14 * touchAtr
    bool piercedHD = high > dayHigh
    bool closedHD  = close < dayHigh
    bool sellHD    = touchedHD and closedHD and (upTail / rng >= revTailPct / 100)

    // уровни для покупки (поддержка)
    bool touchedLL = not na(lLow) and low <= lLow + atr14 * touchAtr
    bool piercedLL = not na(lLow) and low < lLow
    bool closedLL  = close > lLow
    bool buyLL     = touchedLL and closedLL and (dnTail / rng >= revTailPct / 100)

    bool touchedLD = low <= dayLow + atr14 * touchAtr
    bool piercedLD = low < dayLow
    bool closedLD  = close > dayLow
    bool buyLD     = touchedLD and closedLD and (dnTail / rng >= revTailPct / 100)

    [sellLH, piercedLH, sellHD, piercedHD, buyLL, piercedLL, buyLD, piercedLD]

[sellLH, piercLH, sellHD, piercHD, buyLL, piercLL, buyLD, piercLD] = f_checkRev()

// ── Подтверждение: N баров по направлению ──
f_confirm(int dirn) =>
    int cnt = 0
    for k = 1 to confirmBars
        float b = math.abs(close[k] - open[k])
        float r = high[k] - low[k]
        bool strong = r > 0 and b / r >= confBodyPct
        bool right  = dirn == 1 ? close[k] > open[k] : close[k] < open[k]
        if strong and right
            cnt += 1
        else
            break
    cnt

// ── Итоговый сигнал ──
bool zoneSell = revOn and zonesOn and (sellLH or sellHD)
bool zoneBuy  = revOn and zonesOn and (buyLL or buyLD)
bool zonePiercedUp   = piercLH or piercHD
bool zonePiercedDown = piercLL or piercLD

// уровень, от которого отскочили
float sellLevel = sellLH and not na(lHigh) ? lHigh : dayHigh
float buyLevel  = buyLL and not na(lLow)  ? lLow  : dayLow

// подтверждение
int sellConf = zoneSell ? f_confirm(-1) : 0
int buyConf  = zoneBuy  ? f_confirm(1)  : 0
bool sellConfirmed = sellConf >= confirmBars
bool buyConfirmed  = buyConf  >= confirmBars

// стоп и тейк
float sellStop = math.max(not na(lHigh) ? lHigh : high, high) + (high - low) * stopPad
float buyStop  = math.min(not na(lLow)  ? lLow  : low,  low)  - (high - low) * stopPad
float sellTP   = dayLow
float buyTP    = dayHigh

// R:R
float sellRR = math.abs(sellTP - close) / math.abs(sellStop - close)
float buyRR  = math.abs(buyTP - close)  / math.abs(buyStop - close)

// ═════════════════════════════════════════════════════════════
//  🖼️ ОТРИСОВКА
// ═════════════════════════════════════════════════════════════

// ── Линия RF (цвет по направлению) ──
color rfCol = dir == 1 ? #05ff9b : dir == -1 ? #ff0583 : #cccccc
// linewidth принимает только целое значение.
plot(rfLine, "Range Filter", color=rfCol, linewidth=2)

// ── Треугольники разворотов RF ──
plotshape(rfBuy,  title="RF Buy",  style=shape.triangleup,
     location=location.belowbar, color=#05ff9b, size=size.tiny)
plotshape(rfSell, title="RF Sell", style=shape.triangledown,
     location=location.abovebar, color=#ff0583, size=size.tiny)

// ── СВГ сигналы ──
float swingHigh = ta.highest(high, swingLook)
float swingLow  = ta.lowest(low,  swingLook)
float dropFromHigh = swingHigh > 0 ? (swingHigh - low)  / swingHigh * 100 : 0
float riseFromLow  = swingLow  > 0 ? (high - swingLow)  / swingLow  * 100 : 0

if showSVG and barstate.isconfirmed
    if dropFromHigh >= svgMoveThr and (high - math.max(open, close)) >= tailPctIn / 100 * (high - low)
        label.new(bar_index, low, "▼" + str.tostring(math.round(dropFromHigh)) + "%",
             style=label.style_label_up, color=svgSellCol, textcolor=color.white, size=size.tiny)
    if riseFromLow >= svgMoveThr and (math.min(open, close) - low) >= tailPctIn / 100 * (high - low)
        label.new(bar_index, high, "▲" + str.tostring(math.round(riseFromLow)) + "%",
             style=label.style_label_down, color=svgBuyCol, textcolor=color.white, size=size.tiny)

// ── Вертикали границ диапазона ──
if zonesOn and showVert
    bool isNewDay = ta.change(time(tStart)) != 0
    if isNewDay
        line.new(bar_index, low, bar_index, high,
             xloc=xloc.bar_index, extend=extend.both,
             color=color.new(vertCol, 40), width=1, style=line.style_solid)

// ── Горизонтальные линии зон ──
var line highDLine = na
var line lowDLine  = na
var line lHighLine = na
var line lLowLine  = na

if zonesOn and barstate.islast
    // High-D / Low-D
    if showRange
        if na(highDLine)
            highDLine := line.new(bar_index - 200, dayHigh, bar_index + 20, dayHigh,
                 color=rangeCol, width=2, style=line.style_solid,
                 extend=extend.right)
        else
            line.set_xy1(highDLine, bar_index - 200, dayHigh)
            line.set_xy2(highDLine, bar_index + 20, dayHigh)

        if na(lowDLine)
            lowDLine := line.new(bar_index - 200, dayLow, bar_index + 20, dayLow,
                 color=rangeCol, width=2, style=line.style_solid,
                 extend=extend.right)
        else
            line.set_xy1(lowDLine, bar_index - 200, dayLow)
            line.set_xy2(lowDLine, bar_index + 20, dayLow)

    // L-High / L-Low
    if showLocal
        if not na(lHigh)
            if na(lHighLine)
                lHighLine := line.new(bar_index - 100, lHigh, bar_index + 20, lHigh,
                     color=localCol, width=2, style=line.style_solid,
                     extend=extend.right)
            else
                line.set_xy1(lHighLine, bar_index - 100, lHigh)
                line.set_xy2(lHighLine, bar_index + 20, lHigh)

        if not na(lLow)
            if na(lLowLine)
                lLowLine := line.new(bar_index - 100, lLow, bar_index + 20, lLow,
                     color=localCol, width=2, style=line.style_solid,
                     extend=extend.right)
            else
                line.set_xy1(lLowLine, bar_index - 100, lLow)
                line.set_xy2(lLowLine, bar_index + 20, lLow)

// ── Заливка зон ──
var box resBox = na
var box supBox = na

if zonesOn and fillZones and barstate.islast
    // зона сопротивления: между High-D и L-High
    if not na(lHigh)
        float resTop = math.max(dayHigh, lHigh)
        float resBot = math.min(dayHigh, lHigh)
        if na(resBox)
            resBox := box.new(bar_index - 200, resTop, bar_index + 20, resBot,
                 bgcolor=color.new(resFillCol, fillTransp),
                 border_color=color.new(resFillCol, 70))
        else
            box.set_lefttop(resBox, bar_index - 200, resTop)
            box.set_rightbottom(resBox, bar_index + 20, resBot)

    // зона поддержки: между Low-D и L-Low
    if not na(lLow)
        float supTop = math.max(dayLow, lLow)
        float supBot = math.min(dayLow, lLow)
        if na(supBox)
            supBox := box.new(bar_index - 200, supTop, bar_index + 20, supBot,
                 bgcolor=color.new(supFillCol, fillTransp),
                 border_color=color.new(supFillCol, 70))
        else
            box.set_lefttop(supBox, bar_index - 200, supTop)
            box.set_rightbottom(supBox, bar_index + 20, supBot)

// ── Маркеры разворотов от зон ──
if zonesOn and revOn and showRevMark
    if zoneSell and barstate.isconfirmed
        string pierc = zonePiercedUp ? "прошил " : ""
        label.new(bar_index, high + atr14 * 0.5,
             "🎯 SELL " + pierc + "(" + str.tostring(sellConf) + "/" + str.tostring(confirmBars) + ")",
             style=label.style_label_down,
             color=zonePiercedUp ? color.new(#ff4466, 0) : color.new(#ffab00, 20),
             textcolor=color.white, size=size.small)
    if zoneBuy and barstate.isconfirmed
        string pierc2 = zonePiercedDown ? "прошил " : ""
        label.new(bar_index, low - atr14 * 0.5,
             "🎯 BUY " + pierc2 + "(" + str.tostring(buyConf) + "/" + str.tostring(confirmBars) + ")",
             style=label.style_label_up,
             color=zonePiercedDown ? color.new(#05ff9b, 0) : color.new(#ffab00, 20),
             textcolor=color.white, size=size.small)

// ── Линии SL / TP ──
if zonesOn and revOn and showSLTP and barstate.islast
    if zoneSell and sellConfirmed
        line.new(bar_index, sellStop, bar_index + 20, sellStop,
             color=#ff4466, width=1, style=line.style_dashed)
        line.new(bar_index, sellTP, bar_index + 20, sellTP,
             color=#00ff88, width=1, style=line.style_dashed)
        label.new(bar_index + 22, sellStop, "SL",
             style=label.style_label_left, color=#ff4466, textcolor=color.white, size=size.tiny)
        label.new(bar_index + 22, sellTP, "TP",
             style=label.style_label_left, color=#00ff88, textcolor=color.white, size=size.tiny)

    if zoneBuy and buyConfirmed
        line.new(bar_index, buyStop, bar_index + 20, buyStop,
             color=#ff4466, width=1, style=line.style_dashed)
        line.new(bar_index, buyTP, bar_index + 20, buyTP,
             color=#00ff88, width=1, style=line.style_dashed)
        label.new(bar_index + 22, buyStop, "SL",
             style=label.style_label_left, color=#ff4466, textcolor=color.white, size=size.tiny)
        label.new(bar_index + 22, buyTP, "TP",
             style=label.style_label_left, color=#00ff88, textcolor=color.white, size=size.tiny)

// ═════════════════════════════════════════════════════════════
//  🌐 МТФ ТАБЛИЦА (RF + Jaw)
// ═════════════════════════════════════════════════════════════

f_packed() =>
    int wper  = rngPer * 2 - 1
    float av  = ta.ema(math.abs(close - close[1]), rngPer)
    float rr  = ta.ema(av, wper) * rngQty
    var float rf = close
    if close - rr > rf[1]
        rf := close - rr
    if close + rr < rf[1]
        rf := close + rr
    var float d = 0.0
    d := rf > rf[1] ? 1 : rf < rf[1] ? -1 : d
    var int bars = 0
    bars := d != d[1] ? 1 : bars + 1
    int pk = (d == 1 ? 1 : 0) * 100000 + math.min(bars, 99999)
    pk

float jw = ta.rma(hl2, jawLen)
f_jawPacked() =>
    int wper  = rngPer * 2 - 1
    float av  = ta.ema(math.abs(close - close[1]), rngPer)
    float rr  = ta.ema(av, wper) * rngQty
    var float rf = close
    if close - rr > rf[1]
        rf := close - rr
    if close + rr < rf[1]
        rf := close + rr
    var float d = 0.0
    d := rf > rf[1] ? 1 : rf < rf[1] ? -1 : d
    float jv = nz(jw[jawOff], jw)
    bool onSide = (d == 1 and rf < jv) or (d == -1 and rf > jv)
    float dist = onSide and rr > 0 ? math.min(100, math.max(1, math.abs(rf - jv) / rr * 100)) : 0
    (d == 1 ? 1000.0 : 0.0) + dist

string symbol2 = tblSymbol2 == "" ? syminfo.tickerid : tblSymbol2

int p1_1 = request.security(tblSymbol1, tf1, f_packed(), lookahead=barmerge.lookahead_off)
int p1_2 = request.security(tblSymbol1, tf2, f_packed(), lookahead=barmerge.lookahead_off)
int p1_3 = request.security(tblSymbol1, tf3, f_packed(), lookahead=barmerge.lookahead_off)
int p1_4 = request.security(tblSymbol1, tf4, f_packed(), lookahead=barmerge.lookahead_off)
int p1_5 = request.security(tblSymbol1, tf5, f_packed(), lookahead=barmerge.lookahead_off)
int p1_6 = request.security(tblSymbol1, tf6, f_packed(), lookahead=barmerge.lookahead_off)

int p2_1 = request.security(symbol2, tf1, f_packed(), lookahead=barmerge.lookahead_off)
int p2_2 = request.security(symbol2, tf2, f_packed(), lookahead=barmerge.lookahead_off)
int p2_3 = request.security(symbol2, tf3, f_packed(), lookahead=barmerge.lookahead_off)
int p2_4 = request.security(symbol2, tf4, f_packed(), lookahead=barmerge.lookahead_off)
int p2_5 = request.security(symbol2, tf5, f_packed(), lookahead=barmerge.lookahead_off)
int p2_6 = request.security(symbol2, tf6, f_packed(), lookahead=barmerge.lookahead_off)

float j_1 = request.security(symbol2, tf1, f_jawPacked(), lookahead=barmerge.lookahead_off)
float j_2 = request.security(symbol2, tf2, f_jawPacked(), lookahead=barmerge.lookahead_off)
float j_3 = request.security(symbol2, tf3, f_jawPacked(), lookahead=barmerge.lookahead_off)
float j_4 = request.security(symbol2, tf4, f_jawPacked(), lookahead=barmerge.lookahead_off)
float j_5 = request.security(symbol2, tf5, f_jawPacked(), lookahead=barmerge.lookahead_off)
float j_6 = request.security(symbol2, tf6, f_jawPacked(), lookahead=barmerge.lookahead_off)

getPos(string p) =>
    switch p
        "Слева вверху"   => position.top_left
        "Центр вверху"   => position.top_center
        "Справа вверху"  => position.top_right
        "Слева в центре" => position.middle_left
        "Центр"          => position.middle_center
        "Справа в центре"=> position.middle_right
        "Слева внизу"    => position.bottom_left
        "Центр внизу"    => position.bottom_center
        "Справа внизу"   => position.bottom_right
        => position.top_right

getSz(string s) =>
    s == "tiny" ? size.tiny : s == "normal" ? size.normal : s == "large" ? size.large : size.small

isBull(int pk) => pk >= 100000
barsPct(int pk) =>
    int d = pk >= 100000 ? 1 : 0
    int b = pk - d * 100000
    math.min(math.max(b * 100.0 / 100.0, 5.0), 100.0)

cellBg(int pk) =>
    isBull(pk) ? color.new(tblBuyCol, 80) : color.new(tblSellCol, 80)
cellTx(int pk) =>
    isBull(pk) ? tblBuyCol : tblSellCol
cellTxt(int pk) =>
    str.tostring(int(math.round(barsPct(pk)))) + "%"

jawBase(float pk) => pk >= 10000 ? pk - 10000 : pk
jawDir(float pk)  => pk >= 10000
jawDist(float pk) => jawBase(pk) >= 1000 ? jawBase(pk) - 1000 : jawBase(pk)
jawCross(float pk) => jawDist(pk) < 0.5
jawT(float pk) =>
    jawCross(pk) ? "0%" : "-" + str.tostring(int(math.round(jawDist(pk)))) + "%"
jawB(float pk) =>
    bool b = jawDir(pk)
    jawCross(pk) ? color.new(tblFreshCol, 20) :
         b ? color.new(tblBuyCol, int(math.round(jawDist(pk) * 0.8))) :
             color.new(tblSellCol, int(math.round(jawDist(pk) * 0.8)))

getLbl(string t) =>
    t == "60" ? "1h" : t == "240" ? "4h" : t == "D" ? "1D" : t == "W" ? "1W" : t + "m"

shortSym(string s) =>
    str.contains(s, ":") ? str.substring(s, str.pos(s, ":") + 1) : s

var table mt = na
if showTable and barstate.islast
    if not na(mt)
        table.delete(mt)
    mt := table.new(getPos(tblPosition), 4, 7, bgcolor=#1a1a2e, border_width=1, border_color=#2a2a3e)
    table.cell(mt, 0, 0, "ТФ",                bgcolor=#2d2d44, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 0, shortSym(tblSymbol1), bgcolor=#2d2d44, text_color=#ffab00, text_size=getSz(tblSize))
    table.cell(mt, 2, 0, shortSym(symbol2),   bgcolor=#2d2d44, text_color=#00e5ff, text_size=getSz(tblSize))
    table.cell(mt, 3, 0, "RF→Jaw",            bgcolor=#2d2d44, text_color=#00e5ff, text_size=getSz(tblSize))

    table.cell(mt, 0, 1, getLbl(tf1), bgcolor=#16162b, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 1, cellTxt(p1_1), bgcolor=cellBg(p1_1), text_color=cellTx(p1_1), text_size=getSz(tblSize))
    table.cell(mt, 2, 1, cellTxt(p2_1), bgcolor=cellBg(p2_1), text_color=cellTx(p2_1), text_size=getSz(tblSize))
    table.cell(mt, 3, 1, jawT(j_1), bgcolor=jawB(j_1), text_color=color.white, text_size=getSz(tblSize))

    table.cell(mt, 0, 2, getLbl(tf2), bgcolor=#16162b, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 2, cellTxt(p1_2), bgcolor=cellBg(p1_2), text_color=cellTx(p1_2), text_size=getSz(tblSize))
    table.cell(mt, 2, 2, cellTxt(p2_2), bgcolor=cellBg(p2_2), text_color=cellTx(p2_2), text_size=getSz(tblSize))
    table.cell(mt, 3, 2, jawT(j_2), bgcolor=jawB(j_2), text_color=color.white, text_size=getSz(tblSize))

    table.cell(mt, 0, 3, getLbl(tf3), bgcolor=#16162b, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 3, cellTxt(p1_3), bgcolor=cellBg(p1_3), text_color=cellTx(p1_3), text_size=getSz(tblSize))
    table.cell(mt, 2, 3, cellTxt(p2_3), bgcolor=cellBg(p2_3), text_color=cellTx(p2_3), text_size=getSz(tblSize))
    table.cell(mt, 3, 3, jawT(j_3), bgcolor=jawB(j_3), text_color=color.white, text_size=getSz(tblSize))

    table.cell(mt, 0, 4, getLbl(tf4), bgcolor=#16162b, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 4, cellTxt(p1_4), bgcolor=cellBg(p1_4), text_color=cellTx(p1_4), text_size=getSz(tblSize))
    table.cell(mt, 2, 4, cellTxt(p2_4), bgcolor=cellBg(p2_4), text_color=cellTx(p2_4), text_size=getSz(tblSize))
    table.cell(mt, 3, 4, jawT(j_4), bgcolor=jawB(j_4), text_color=color.white, text_size=getSz(tblSize))

    table.cell(mt, 0, 5, getLbl(tf5), bgcolor=#16162b, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 5, cellTxt(p1_5), bgcolor=cellBg(p1_5), text_color=cellTx(p1_5), text_size=getSz(tblSize))
    table.cell(mt, 2, 5, cellTxt(p2_5), bgcolor=cellBg(p2_5), text_color=cellTx(p2_5), text_size=getSz(tblSize))
    table.cell(mt, 3, 5, jawT(j_5), bgcolor=jawB(j_5), text_color=color.white, text_size=getSz(tblSize))

    table.cell(mt, 0, 6, getLbl(tf6), bgcolor=#16162b, text_color=#888888, text_size=getSz(tblSize))
    table.cell(mt, 1, 6, cellTxt(p1_6), bgcolor=cellBg(p1_6), text_color=cellTx(p1_6), text_size=getSz(tblSize))
    table.cell(mt, 2, 6, cellTxt(p2_6), bgcolor=cellBg(p2_6), text_color=cellTx(p2_6), text_size=getSz(tblSize))
    table.cell(mt, 3, 6, jawT(j_6), bgcolor=jawB(j_6), text_color=color.white, text_size=getSz(tblSize))

// ═════════════════════════════════════════════════════════════
//  🔔 АЛЕРТЫ
// ═════════════════════════════════════════════════════════════

alertcondition(rfBuy,  "RF Buy",  "Range Filter BUY on {{ticker}}")
alertcondition(rfSell, "RF Sell", "Range Filter SELL on {{ticker}}")
alertcondition(jawCrossUp, "RF × Jaw Up",   "RF пересёк челюсть ВВЕРХ on {{ticker}}")
alertcondition(jawCrossDn, "RF × Jaw Down", "RF пересёк челюсть ВНИЗ on {{ticker}}")

alertcondition(zoneBuy  and buyConfirmed,  "🎯 Зона BUY",  "Разворот от зоны ПОДДЕРЖКИ on {{ticker}}")
alertcondition(zoneSell and sellConfirmed, "🎯 Зона SELL", "Разворот от зоны СОПРОТИВЛЕНИЯ on {{ticker}}")
alertcondition(zoneBuy  and buyConfirmed  and zonePiercedDown, "🔥 Зона BUY прошил",  "СИЛЬНЫЙ разворот с прошивкой on {{ticker}}")
alertcondition(zoneSell and sellConfirmed and zonePiercedUp,   "🔥 Зона SELL прошил", "СИЛЬНЫЙ разворот с прошивкой on {{ticker}}")`;
