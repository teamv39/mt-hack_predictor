import React, { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Cpu,
  Bus,
} from "lucide-react";

interface MareyDiagramProps {
  onApplyHolding?: () => void;
  onOpenScenarios?: () => void;
  isApplied?: boolean;
}

export const MareyDiagram: React.FC<MareyDiagramProps> = ({
  onApplyHolding,
  onOpenScenarios,
  isApplied = false,
}) => {
  const [filterMode, setFilterMode] = useState<"all" | "anomalies">("all");
  const [showPlan, setShowPlan] = useState<boolean>(true);
  const [holdingApplied, setHoldingApplied] = useState<boolean>(isApplied);

  const handleApply = () => {
    setHoldingApplied(true);
    if (onApplyHolding) onApplyHolding();
  };

  const STATIONS = [
    { name: "м. Семёновская", pk: "ПК 00+00", km: "0.0 км", y: 30, isMajor: true },
    { name: "м. Электрозаводская", pk: "ПК 18+40", km: "1.8 км", y: 90, isMajor: false },
    { name: "Бакунинская ул.", pk: "ПК 32+10", km: "3.2 км", y: 150, isMajor: false, isWarning: true },
    { name: "м. Бауманская", pk: "ПК 46+80", km: "4.7 км", y: 210, isMajor: true, isCritical: true },
    { name: "пл. Разгуляй", pk: "ПК 62+00", km: "6.2 км", y: 270, isMajor: false },
    { name: "ул. Покровка", pk: "ПК 81+50", km: "8.1 км", y: 330, isMajor: false },
    { name: "Лубянская пл.", pk: "ПК 104+20", km: "10.4 км", y: 390, isMajor: false },
    { name: "Театральная пл.", pk: "ПК 121+00", km: "12.1 км", y: 450, isMajor: false },
    { name: "Храм Христа Спасителя", pk: "ПК 148+30", km: "14.8 км", y: 510, isMajor: false },
    { name: "Стадион Лужники", pk: "ПК 184+00", km: "18.4 км", y: 570, isMajor: true },
  ];

  const BUS_FLEET = [
    { id: "№1042", model: "ЛиАЗ-6274", pos: "Бакунинская ул.", dev: "+5.8м", status: "Пачкование (94%)", risk: "critical" },
    { id: "№1043", model: "ЛиАЗ-6274", pos: "м. Бауманская", dev: "-1.2м", status: holdingApplied ? "Holding 2.5м" : "Лидер (Задержка)", risk: "warning" },
    { id: "№1041", model: "КамАЗ-6282", pos: "Театральная пл.", dev: "+0.4м", status: "Норма", risk: "normal" },
    { id: "№1044", model: "ЛиАЗ-6274", pos: "м. Электрозаводская", dev: "+1.1м", status: "Норма", risk: "normal" },
    { id: "№1045", model: "КамАЗ-6282", pos: "м. Семёновская", dev: "+0.2м", status: "Отправление", risk: "normal" },
    { id: "№1039", model: "ЛиАЗ-6274", pos: "Стадион Лужники", dev: "-0.5м", status: "На отстое", risk: "normal" },
    { id: "№1038", model: "КамАЗ-6282", pos: "Храм Христа Спас.", dev: "+0.9м", status: "Норма", risk: "normal" },
    { id: "№1046", model: "ЛиАЗ-6274", pos: "Парк Сокольники", dev: "0.0м", status: "Зарядка 92%", risk: "reserve" },
  ];

  const filteredFleet = BUS_FLEET.filter((b) => {
    if (filterMode === "anomalies") {
      return b.risk === "critical" || b.risk === "warning";
    }
    return true;
  });

  return (
    <div className="w-full h-full flex flex-col bg-[#f1f4f8] text-slate-800 font-sans select-none overflow-hidden">
      {/* 1. Sub-Header: Route m3 KPI Bar */}
      <div className="h-14 px-4 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-7 rounded bg-[#2563eb] text-white font-black text-xs flex items-center justify-center tracking-tight shadow-xs">
            м3
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-slate-900 uppercase">
              Магистраль м3: «Метро Семёновская ⇄ Стадион Лужники»
            </span>
            <span className="text-[10px] font-medium text-slate-500 font-mono">
              Оперативный график движения Марея • Мониторинг интервалов и пачкования
            </span>
          </div>
        </div>

        {/* Route Realtime KPIs */}
        <div className="flex items-center space-x-2.5">
          <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Бортов на линии</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-extrabold text-slate-900 font-mono">12</span>
              <span className="text-[10px] text-slate-400 font-medium">/ 12 план</span>
            </div>
          </div>

          <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Плановый такт</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-extrabold text-[#2563eb] font-mono">8.0</span>
              <span className="text-[10px] text-slate-400 font-medium">мин</span>
            </div>
          </div>

          <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider">Факт интервал</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black text-amber-900 font-mono">
                {holdingApplied ? "7.5 — 8.2" : "1.4 — 14.8"}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">мин</span>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-lg border flex flex-col ${holdingApplied ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] font-bold uppercase tracking-wider ${holdingApplied ? "text-emerald-800" : "text-red-800"}`}>
                Коэфф. CV
              </span>
              <span className={`text-[9px] font-extrabold ${holdingApplied ? "text-emerald-700" : "text-red-600"}`}>
                {holdingApplied ? "НОРМА" : "СБОЙ"}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xs font-black font-mono ${holdingApplied ? "text-emerald-900" : "text-red-700"}`}>
                {holdingApplied ? "0.18" : "0.42"}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">(Норма &lt;0.20)</span>
            </div>
          </div>

          <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Критический перегон</span>
            <span className="text-xs font-bold text-slate-800">
              Бакунинская — Бауманская
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Work Area: Marey Diagram Canvas + Right Roster/DSS Dock */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center: Marey Canvas Area */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col relative overflow-hidden">
            {/* Toolbar */}
            <div className="h-9 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#2563eb]" />
                  ПРОСТРАНСТВЕННО-ВРЕМЕННАЯ ДИАГРАММА МАРЕЯ (ТРАЕКТОРИИ БОРТОВ)
                </span>
                <div className="h-3 w-px bg-slate-200" />
                {/* Legends */}
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[3px] bg-[#2563eb] rounded-full inline-block" />
                    <span className="text-slate-600 font-medium">Факт</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[1.5px] border-b-2 border-dashed border-slate-400 inline-block" />
                    <span className="text-slate-600 font-medium">План</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[3px] bg-[#ef4444] rounded-full inline-block" />
                    <span className="text-red-700 font-bold">Схлопывание (Пачка)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[2px] border-b-2 border-dashed border-emerald-600 inline-block" />
                    <span className="text-emerald-700 font-bold">СППР Holding</span>
                  </div>
                </div>
              </div>

              {/* Time Step & Controls */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400">Шаг шкалы: 15 мин</span>
                <button
                  onClick={() => setShowPlan(!showPlan)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    showPlan ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  Сетка плана
                </button>
              </div>
            </div>

            {/* Coordinate SVG Space */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Y-Axis: Stations Ruler on Left */}
              <div className="w-48 bg-slate-50/80 border-r border-slate-200 flex flex-col justify-between py-6 px-2.5 text-right select-none shrink-0 z-20">
                {STATIONS.map((st, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-end gap-1.5 pr-1 ${
                      st.isCritical
                        ? "bg-red-50/90 py-1 px-1.5 rounded-lg border-r-2 border-red-500 shadow-2xs"
                        : st.isWarning
                        ? "bg-amber-50/70 py-0.5 px-1.5 rounded"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col text-right">
                      <span
                        className={`text-[10px] leading-tight ${
                          st.isCritical
                            ? "font-black text-red-700"
                            : st.isWarning
                            ? "font-bold text-amber-800"
                            : st.isMajor
                            ? "font-bold text-slate-800"
                            : "font-medium text-slate-600"
                        }`}
                      >
                        {st.name}
                      </span>
                      <span className="text-[8px] font-mono text-slate-400">
                        {st.pk} ({st.km})
                      </span>
                    </div>
                    <span
                      className={`rounded-full shrink-0 ${
                        st.isCritical
                          ? "w-2.5 h-2.5 bg-red-600 border-2 border-white shadow-xs"
                          : st.isWarning
                          ? "w-2 h-2 bg-amber-500"
                          : st.isMajor
                          ? "w-2.5 h-2.5 border-2 border-[#2563eb] bg-white"
                          : "w-1.5 h-1.5 bg-slate-300"
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Central SVG Canvas */}
              <div className="flex-1 h-full w-full relative overflow-hidden bg-white">
                {/* ML Forecast Background Shading (X >= 50%) */}
                <div className="absolute left-1/2 top-0 bottom-0 right-0 bg-blue-50/30 border-l border-blue-200/80 pointer-events-none z-0">
                  <div className="p-2 flex items-center justify-between text-blue-700/80 text-[9px] font-mono font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      ЗОНА ПРЕДИКТИВНОГО МОДЕЛИРОВАНИЯ ML (T+45 МИН)
                    </span>
                    <span>ТОЧНОСТЬ: 96.4%</span>
                  </div>
                </div>

                {/* Top Time Scale Overlay */}
                <div className="absolute top-0 left-0 right-0 h-6 border-b border-slate-200 bg-slate-50/90 backdrop-blur-2xs flex justify-between px-6 z-10 text-[10px] font-mono font-semibold text-slate-600">
                  <span>14:00</span>
                  <span>14:15</span>
                  <span>14:30</span>
                  <span className="text-red-700 font-bold bg-red-100 px-1.5 rounded">
                    14:45 (T=0 СЕЙЧАС)
                  </span>
                  <span className="text-blue-700 font-bold">15:00 (+15м)</span>
                  <span className="text-blue-700 font-bold">15:15 (+30м)</span>
                  <span className="text-blue-700 font-bold">15:30 (+45м)</span>
                </div>

                {/* SVG Vector Marey Canvas */}
                <svg
                  className="w-full h-full pt-6 pb-6"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 600"
                >
                  <defs>
                    <pattern id="mareyGrid" width="16.66" height="66.66" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="16.66" y2="0" stroke="#f1f5f9" strokeWidth="0.5" />
                      <line x1="0" y1="0" x2="0" y2="66.66" stroke="#f8fafc" strokeWidth="0.5" />
                    </pattern>
                  </defs>

                  <rect width="1000" height="600" fill="url(#mareyGrid)" />

                  {/* Horizontal Station Lines */}
                  {STATIONS.map((st, i) => (
                    <line
                      key={i}
                      x1="0"
                      y1={st.y}
                      x2="1000"
                      y2={st.y}
                      stroke={st.isCritical ? "#fee2e2" : "#e2e8f0"}
                      strokeWidth={st.isCritical ? 1.5 : 1}
                      strokeDasharray={st.isMajor ? "none" : "2,2"}
                    />
                  ))}

                  {/* Vertical Time Grid Lines */}
                  <line x1="166.6" y1="0" x2="166.6" y2="600" stroke="#e2e8f0" strokeDasharray="3,3" />
                  <line x1="333.3" y1="0" x2="333.3" y2="600" stroke="#e2e8f0" strokeDasharray="3,3" />
                  <line x1="666.6" y1="0" x2="666.6" y2="600" stroke="#e2e8f0" strokeDasharray="3,3" />
                  <line x1="833.3" y1="0" x2="833.3" y2="600" stroke="#e2e8f0" strokeDasharray="3,3" />

                  {/* Scheduled Nominal Trajectories (Dashed Slate) */}
                  {showPlan && (
                    <g opacity="0.45" stroke="#94a3b8" strokeDasharray="4,4" strokeWidth="1.2">
                      <path d="M 40 30 L 310 570" />
                      <path d="M 130 30 L 400 570" />
                      <path d="M 220 30 L 490 570" />
                      <path d="M 310 30 L 580 570" />
                      <path d="M 400 30 L 670 570" />
                      <path d="M 490 30 L 760 570" />
                      <path d="M 580 30 L 850 570" />
                    </g>
                  )}

                  {/* REALIZED STRING TRAJECTORIES (T <= 500) */}
                  {/* Bus 1040: Ahead */}
                  <path d="M 0 150 L 80 270 L 170 390 L 240 450 L 320 570" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                  <circle cx="320" cy="570" r="3.5" fill="#2563eb" />
                  <text x="325" y="565" fill="#1d4ed8" fontFamily="monospace" fontSize="9" fontWeight="bold">#1040 (Финиш)</text>

                  {/* Bus 1041: Regular Vehicle passing Teatralnaya */}
                  <path d="M 140 30 L 210 150 L 290 270 L 390 390 L 485 450" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                  <circle cx="485" cy="450" r="4" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <text x="415" y="445" fill="#1d4ed8" fontFamily="monospace" fontSize="10" fontWeight="bold">#1041 (+0.4м)</text>

                  {/* Bus 1043 (Leader): slowed down at Baumanskaya */}
                  <path d="M 290 30 L 350 90 L 420 150 L 500 210" fill="none" stroke="#2563eb" strokeWidth="2.8" />
                  <circle cx="500" cy="210" r="4.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <text x="510" y="205" fill="#1d4ed8" fontFamily="monospace" fontSize="10" fontWeight="bold">#1043 (м. Бауманская)</text>

                  {/* Bus 1042 (Trailer): closing in rapidly */}
                  <path d="M 370 30 L 420 90 L 460 150 L 488 185" fill="none" stroke="#ef4444" strokeWidth="3" />
                  <circle cx="488" cy="185" r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                  <text x="405" y="180" fill="#dc2626" fontFamily="monospace" fontSize="10" fontWeight="bold">#1042 (+5.8м ДОГОНЯЕТ!)</text>

                  {/* Danger bracket between 1043 and 1042 */}
                  <line x1="488" y1="185" x2="498" y2="208" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2" />

                  {/* Bus 1044: Behind */}
                  <path d="M 440 30 L 495 90" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                  <circle cx="495" cy="90" r="4" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <text x="420" y="85" fill="#1d4ed8" fontFamily="monospace" fontSize="10" fontWeight="bold">#1044 (+1.1м)</text>

                  {/* Bus 1045: Just dispatched */}
                  <circle cx="500" cy="30" r="4.5" fill="#00875a" stroke="#fff" strokeWidth="1.5" />
                  <text x="510" y="34" fill="#00875a" fontFamily="monospace" fontSize="10" fontWeight="bold">#1045 (0.0м)</text>

                  {/* PREDICTIVE FUTURE TRAJECTORIES (T > 500) */}
                  {/* Bus 1041 future */}
                  <path d="M 485 450 L 530 510 L 580 570" fill="none" stroke="#2563eb" strokeDasharray="3,3" strokeWidth="2" />

                  {holdingApplied ? (
                    /* AFTER HOLDING: Flat dwell holding bar on Baumanskaya, then restored parallel spacing */
                    <>
                      {/* Dwell bar at Y=210 from X=500 to X=530 */}
                      <line x1="500" y1="210" x2="530" y2="210" stroke="#00875a" strokeWidth="4.5" strokeLinecap="round" />
                      <path d="M 530 210 L 590 270 L 660 330 L 730 390 L 800 450 L 880 570" fill="none" stroke="#00875a" strokeWidth="2.5" strokeDasharray="5,3" />
                      {/* Bus 1042 smoothly trailing with 7.5m gap */}
                      <path d="M 488 185 L 510 210 L 570 270 L 640 330 L 710 390 L 780 450 L 860 570" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4,3" />
                    </>
                  ) : (
                    /* BEFORE HOLDING: Catastrophic clash lines */
                    <>
                      <path d="M 500 210 L 550 270 L 610 330 L 680 390 L 740 450" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                      <path d="M 488 185 L 515 210 L 555 270 L 613 330 L 682 390" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.4" />
                      <text x="560" y="275" fill="#ef4444" fontFamily="monospace" fontSize="8" opacity="0.8">Без СППР: Полное слияние (Δ=20 сек)</text>
                    </>
                  )}

                  {/* Future #1044 */}
                  <path d="M 495 90 L 550 150 L 610 210 L 670 270 L 740 330 L 810 390 L 880 450 L 950 570" fill="none" stroke="#2563eb" strokeDasharray="4,3" strokeWidth="2" />

                  {/* Vertical RED "NOW" TIME LINE at X=500 */}
                  <line x1="500" y1="0" x2="500" y2="600" stroke="#dc2626" strokeWidth="2" />
                  <g transform="translate(460, 2)">
                    <rect width="80" height="18" rx="3" fill="#dc2626" />
                    <text x="40" y="12" fill="#fff" fontFamily="monospace" fontSize="9" fontWeight="bold" textAnchor="middle">
                      СЕЙЧАС 14:45
                    </text>
                  </g>
                </svg>

                {/* Floating Warning Card if not yet applied */}
                {!holdingApplied ? (
                  <div className="absolute left-[360px] top-[130px] bg-white border border-slate-300 rounded-xl p-3 shadow-xl w-[320px] pointer-events-auto z-30 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between gap-1 border-b border-red-100 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        ⚠ ОПАСНОСТЬ ПАЧКОВАНИЯ
                      </div>
                      <span className="px-1.5 py-0.2 bg-red-100 text-red-700 rounded text-[9px] font-black">
                        РИСК 94%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 leading-snug">
                      Интервал между <strong className="text-blue-700 font-bold">#1043</strong> и <strong className="text-red-700 font-bold">#1042</strong> схлопнулся до{" "}
                      <span className="font-mono font-bold text-red-700 bg-red-50 px-1 py-0.5 rounded">1.4 мин</span> (Норма 8.0 мин).
                    </div>
                    <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                      <div className="text-emerald-900 text-[10px] font-bold">
                        Holding №1043: +2.5м
                      </div>
                      <button
                        onClick={handleApply}
                        className="bg-[#00875A] hover:bg-[#00965E] text-white px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                      >
                        Применить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute left-[540px] top-[225px] bg-[#00875A] text-white text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg shadow-md z-20 flex items-center gap-1.5 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Holding №1043 активен (2.5 мин на м. Бауманская)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Bar */}
            <div className="h-8 px-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-slate-500 text-[10px] font-mono">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">
                  Телеметрический срез: 14:45:00
                </span>
                <span>•</span>
                <span>Модель движения: АСУ «Навигатор-ГПТ»</span>
                <span>•</span>
                <span>Погрешность: ±1.8м</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Расчётный такт восстановления:</span>
                <span className="font-bold text-emerald-700">15:02 (через 17 мин)</span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="font-semibold text-slate-700">Смена: №0412-Ц</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Fleet Roster & Predictive DSS Box */}
        <aside className="w-88 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-2xs z-30">
          {/* Panel Header */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-[#2563eb]" />
                Мониторинг бортов м3 (12 ед.)
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                Электробусы ЛиАЗ-6274 / КамАЗ-6282
              </div>
            </div>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-mono font-bold border border-blue-200">
              LIVE
            </span>
          </div>

          {/* Roster Filters */}
          <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                  filterMode === "all" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500"
                }`}
              >
                Все борты (12)
              </button>
              <button
                onClick={() => setFilterMode("anomalies")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all flex items-center gap-1 ${
                  filterMode === "anomalies" ? "bg-white text-red-600 shadow-2xs" : "text-red-500"
                }`}
              >
                <span>Аномалии (2)</span>
              </button>
            </div>
          </div>

          {/* Fleet Table */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 font-sans text-xs">
            {filteredFleet.map((b) => (
              <div
                key={b.id}
                className={`p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  b.risk === "critical"
                    ? "bg-red-50/40 border-l-2 border-red-500"
                    : b.risk === "warning"
                    ? "bg-amber-50/40 border-l-2 border-amber-500"
                    : ""
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900">{b.id}</span>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                      {b.model}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5">{b.pos}</span>
                </div>
                <div className="flex flex-col items-end text-right">
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      b.risk === "critical"
                        ? "text-red-600"
                        : b.risk === "warning"
                        ? "text-amber-700"
                        : "text-slate-700"
                    }`}
                  >
                    {b.dev}
                  </span>
                  <span
                    className={`text-[9px] font-semibold mt-0.5 ${
                      b.risk === "critical"
                        ? "text-red-700"
                        : b.risk === "warning"
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom DSS Box */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                СППР Регулирование интервала
              </span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                96% УСПЕХ
              </span>
            </div>

            <p className="text-[10px] text-slate-600 leading-snug">
              Принудительный Holding (удержание лидера) борта №1043 на остановочном пункте «м. Бауманская» на 2.5 мин.
            </p>

            <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono py-1">
              <div className="p-1 rounded bg-white border border-slate-200">
                <span className="text-[8px] text-slate-400 block uppercase">Снижение дисперсии</span>
                <span className="font-extrabold text-emerald-700">-68%</span>
              </div>
              <div className="p-1 rounded bg-white border border-slate-200">
                <span className="text-[8px] text-slate-400 block uppercase">Ликвидация сбоя</span>
                <span className="font-extrabold text-slate-800">через 12 мин</span>
              </div>
            </div>

            <button
              onClick={handleApply}
              disabled={holdingApplied}
              className={`w-full py-2.5 px-3 rounded-xl text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 uppercase cursor-pointer ${
                holdingApplied
                  ? "bg-emerald-800 cursor-default"
                  : "bg-[#00875A] hover:bg-[#00965E] active:scale-95 shadow-emerald-900/20"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{holdingApplied ? "✓ Holding №1043 применён" : "✓ Применить Holding №1043 (2.5м)"}</span>
            </button>

            <button
              onClick={() => onOpenScenarios && onOpenScenarios()}
              className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>⚡ Ситуационная матрица (4 сценария) ▾</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MareyDiagram;
