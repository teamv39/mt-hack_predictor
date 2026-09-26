import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Grid2x2,
  ChevronDown,
  Activity,
  SlidersHorizontal,
} from "lucide-react";

interface MareyDiagramProps {
  onApplyHolding?: () => void;
  onOpenScenarios?: () => void;
  isApplied?: boolean;
  isDarkMode?: boolean;
}

export const MareyDiagram: React.FC<MareyDiagramProps> = ({
  onApplyHolding,
  onOpenScenarios,
  isApplied = false,
  isDarkMode = false,
}) => {
  const [filterMode, setFilterMode] = useState<"all" | "anomalies">("all");
  const [showPlan, setShowPlan] = useState<boolean>(true);
  const holdingApplied = isApplied;

  const handleApply = () => {
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
    <div className={`w-full h-full flex flex-col font-sans select-none overflow-hidden transition-colors ${
      isDarkMode ? "bg-[#121214] text-zinc-200" : "bg-[#f4f4f5] text-zinc-800"
    }`}>
      {/* 1. Sub-Header: Route m3 KPI Bar */}
      <div className={`h-12 px-4 border-b flex items-center justify-between shrink-0 transition-colors ${
        isDarkMode ? "bg-[#18181b] border-white/10" : "bg-white border-zinc-200"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-6 rounded bg-[#D32F2F] text-white font-bold text-xs flex items-center justify-center font-mono">
            м3
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-bold tracking-tight uppercase ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
              Магистраль м3: «Метро Семёновская ⇄ Стадион Лужники»
            </span>
            <span className="text-[10px] font-medium text-zinc-400 font-mono">
              Оперативный график движения Марея • Мониторинг интервалов и пачкования
            </span>
          </div>
        </div>

        {/* Route Realtime KPIs */}
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
            isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}>
            <span className="text-[10px] text-zinc-400 font-medium">Бортов:</span>
            <span className={`text-xs font-bold font-mono ${isDarkMode ? "text-white" : "text-zinc-900"}`}>12/12</span>
          </div>

          <div className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
            isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}>
            <span className="text-[10px] text-zinc-400 font-medium">Плановый такт:</span>
            <span className={`text-xs font-bold font-mono ${isDarkMode ? "text-zinc-100" : "text-zinc-900"}`}>8.0 мин</span>
          </div>

          <div className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
            isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}>
            <span className="text-[10px] text-zinc-400 font-medium">Факт интервал:</span>
            <span className={`text-xs font-bold font-mono ${holdingApplied ? (isDarkMode ? "text-zinc-100" : "text-zinc-900") : "text-amber-400"}`}>
              {holdingApplied ? "7.5 — 8.2 мин" : "1.4 — 14.8 мин"}
            </span>
          </div>

          <div className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
            isDarkMode ? "bg-[#222226] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}>
            <span className="text-[10px] text-zinc-400 font-medium">Коэфф. вариации CV:</span>
            <span className={`text-xs font-bold font-mono ${holdingApplied ? "text-emerald-400" : "text-rose-400"}`}>
              {holdingApplied ? "0.18" : "0.42"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Workspace: Space-Time Diagram + Fleet Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Space-Time Diagram Workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Controls Bar */}
          <div className={`h-9 px-4 border-b flex items-center justify-between shrink-0 text-xs ${
            isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Факт
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-3 h-0.5 border-t border-dashed border-zinc-400 inline-block" /> План
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" /> Пачкование
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-400 inline-block" /> СППР Holding
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPlan(!showPlan)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  showPlan
                    ? isDarkMode ? "bg-zinc-800 border-white/20 text-white" : "bg-white border-zinc-300 text-zinc-800"
                    : "text-zinc-400 border-transparent"
                }`}
              >
                Сетка плана
              </button>
            </div>
          </div>

          {/* Time-Space SVG Graph Surface */}
          <div className="flex-1 min-h-0 overflow-auto relative">
            <div className="min-w-[900px] h-[640px] relative p-4 flex">
              {/* Station Axis Labels on Left */}
              <div className="w-[180px] shrink-0 flex flex-col justify-between py-4 pr-3 border-r border-zinc-200 dark:border-white/10 text-right">
                {STATIONS.map((st) => (
                  <div key={st.name} className="flex flex-col items-end">
                    <span className={`text-[11px] font-semibold truncate ${
                      st.isCritical
                        ? "text-rose-500 font-bold"
                        : st.isWarning
                        ? "text-amber-500 font-bold"
                        : st.isMajor
                        ? isDarkMode ? "text-white font-bold" : "text-zinc-900 font-bold"
                        : isDarkMode ? "text-zinc-400" : "text-zinc-600"
                    }`}>
                      {st.name}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400">
                      {st.pk} • {st.km}
                    </span>
                  </div>
                ))}
              </div>

              {/* Time-Space Grid & Curves */}
              <div className="flex-1 relative ml-3">
                {/* Horizontal Station Lines */}
                {STATIONS.map((st) => (
                  <div
                    key={st.name}
                    className={`absolute left-0 right-0 border-b ${
                      st.isMajor
                        ? isDarkMode ? "border-white/15" : "border-zinc-300"
                        : isDarkMode ? "border-white/5" : "border-zinc-100"
                    }`}
                    style={{ top: `${(st.y / 600) * 100}%` }}
                  />
                ))}

                {/* Vertical Time Grid Columns */}
                {["14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30"].map((t, idx) => (
                  <div
                    key={t}
                    className={`absolute top-0 bottom-0 border-r ${
                      isDarkMode ? "border-white/10" : "border-zinc-200"
                    }`}
                    style={{ left: `${(idx / 6) * 100}%` }}
                  >
                    <span className={`absolute top-0 -translate-x-1/2 text-[10px] font-mono font-medium ${
                      isDarkMode ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {t}
                    </span>
                  </div>
                ))}

                {/* Trajectory SVG Curves */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 900 600" preserveAspectRatio="none">
                  {/* Plan Lines */}
                  {showPlan && (
                    <g stroke={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"} strokeWidth="1" strokeDasharray="3 3">
                      <line x1="50" y1="30" x2="350" y2="570" />
                      <line x1="200" y1="30" x2="500" y2="570" />
                      <line x1="350" y1="30" x2="650" y2="570" />
                      <line x1="500" y1="30" x2="800" y2="570" />
                    </g>
                  )}

                  {/* Vehicle 1040 */}
                  <path d="M 0 150 L 80 270 L 170 390 L 240 450 L 320 570" fill="none" stroke="#059669" strokeWidth="2.5" />
                  <circle cx="320" cy="570" r="3.5" fill="#059669" />
                  <text x="325" y="565" fill={isDarkMode ? "#cbd5e1" : "#065f46"} fontFamily="monospace" fontSize="9" fontWeight="bold">#1040 (Финиш)</text>

                  {/* Vehicle 1041 */}
                  <path d="M 140 30 L 210 150 L 290 270 L 390 390 L 485 450" fill="none" stroke="#059669" strokeWidth="2.5" />
                  <circle cx="485" cy="450" r="4" fill="#059669" stroke="#fff" strokeWidth="1.5" />
                  <text x="415" y="445" fill={isDarkMode ? "#cbd5e1" : "#065f46"} fontFamily="monospace" fontSize="10" fontWeight="bold">#1041 (+0.4м)</text>

                  {/* Vehicle 1043 (Leader) */}
                  <path d="M 290 30 L 350 90 L 420 150 L 500 210" fill="none" stroke="#059669" strokeWidth="2.8" />
                  <circle cx="500" cy="210" r="4.5" fill="#059669" stroke="#fff" strokeWidth="1.5" />
                  <text x="510" y="205" fill={isDarkMode ? "#cbd5e1" : "#065f46"} fontFamily="monospace" fontSize="10" fontWeight="bold">#1043 (м. Бауманская)</text>

                  {/* Vehicle 1042 (Approaching Leader - Bunching Confluence) */}
                  <path d="M 370 30 L 420 90 L 460 150 L 488 185" fill="none" stroke="#dc2626" strokeWidth="3" />
                  <circle cx="488" cy="185" r="5" fill="#dc2626" stroke="#fff" strokeWidth="1.5" />
                  <text x="390" y="180" fill="#f87171" fontFamily="monospace" fontSize="10" fontWeight="bold">#1042 (+5.8м ДОГОНЯЕТ)</text>

                  {/* Future Projection Lines */}
                  {holdingApplied ? (
                    <>
                      <line x1="500" y1="210" x2="530" y2="210" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
                      <path d="M 530 210 L 590 270 L 660 330 L 730 390 L 800 450 L 880 570" fill="none" stroke="#059669" strokeWidth="2.5" strokeDasharray="4 3" />
                      <path d="M 488 185 L 510 210 L 570 270 L 640 330 L 710 390 L 780 450 L 860 570" fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="3 3" />
                    </>
                  ) : (
                    <>
                      <path d="M 500 210 L 550 270 L 610 330 L 680 390 L 740 450" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.4" />
                      <path d="M 488 185 L 515 210 L 555 270 L 613 330 L 682 390" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.4" />
                    </>
                  )}

                  {/* Now Reference Vertical Line */}
                  <line x1="500" y1="0" x2="500" y2="600" stroke="#dc2626" strokeWidth="1.5" />
                  <g transform="translate(460, 2)">
                    <rect width="80" height="18" rx="4" fill="#dc2626" />
                    <text x="40" y="12" fill="#fff" fontFamily="monospace" fontSize="9" fontWeight="bold" textAnchor="middle">
                      СЕЙЧАС 14:45
                    </text>
                  </g>
                </svg>

                {/* Floating Warning Popover Card */}
                {!holdingApplied ? (
                  <div className={`absolute left-[360px] top-[130px] rounded-xl p-3.5 shadow-lg w-[310px] pointer-events-auto z-30 border ${
                    isDarkMode ? "bg-[#1c1c20] border-rose-500/40 text-zinc-100 shadow-black/60" : "bg-white border-rose-300 text-zinc-800 shadow-zinc-900/10"
                  }`}>
                    <div className="flex items-center justify-between gap-1 border-b border-rose-500/20 pb-2 mb-2">
                      <div className="flex items-center gap-1.5 text-rose-500 font-bold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>ОПАСНОСТЬ ПАЧКОВАНИЯ</span>
                      </div>
                      <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-bold border border-rose-500/30">
                        РИСК 94%
                      </span>
                    </div>
                    <div className={`text-xs leading-relaxed ${isDarkMode ? "text-zinc-300" : "text-zinc-600"}`}>
                      Интервал между <strong className="text-emerald-500">#1043</strong> и <strong className="text-rose-500">#1042</strong> схлопнулся до{" "}
                      <span className="font-mono font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.5 rounded border border-rose-200 dark:border-rose-800">1.4 мин</span> (Норма 8.0 мин).
                    </div>
                    <div className={`mt-2.5 p-2 rounded-lg border flex items-center justify-between ${
                      isDarkMode ? "bg-emerald-950/30 border-emerald-800/60" : "bg-emerald-50 border-emerald-200"
                    }`}>
                      <div className={`text-xs font-bold ${isDarkMode ? "text-emerald-300" : "text-emerald-900"}`}>
                        Holding №1043: +2.5м
                      </div>
                      <button
                        onClick={handleApply}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Применить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute left-[520px] top-[220px] bg-emerald-700 text-white text-[11px] font-mono font-semibold px-3 py-1.5 rounded-lg shadow-md z-20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Holding №1043 активен (+2.5 мин на м. Бауманская)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Info */}
          <div className={`h-8 px-4 border-t flex items-center justify-between shrink-0 text-[10px] font-mono ${
            isDarkMode ? "bg-[#141416] border-white/10 text-zinc-400" : "bg-white border-zinc-200 text-zinc-500"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${isDarkMode ? "text-zinc-300" : "text-zinc-700"}`}>
                Телеметрический срез: 14:45:00
              </span>
              <span>•</span>
              <span>Модель движения: АСУ «Навигатор-ГПТ»</span>
            </div>
            <div>
              <span>Расчётный такт восстановления: </span>
              <span className="text-emerald-500 font-bold">15:02 (через 17 мин)</span>
            </div>
          </div>
        </div>

        {/* Right: Fleet Monitoring Sidebar */}
        <aside className={`w-[280px] border-l flex flex-col shrink-0 transition-colors ${
          isDarkMode ? "bg-[#18181b] border-white/10 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
        }`}>
          {/* Sidebar Header */}
          <div className={`p-3 border-b shrink-0 ${isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-bold ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                Мониторинг бортов м3 (12 ед.)
              </span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isDarkMode ? "bg-white/10 text-zinc-300 border-white/10" : "bg-zinc-100 text-zinc-600 border-zinc-200"
              }`}>
                LIVE
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mb-2">
              ЛиАЗ-6274 • КамАЗ-6282
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  filterMode === "all"
                    ? isDarkMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-white"
                    : isDarkMode ? "bg-[#222226] text-zinc-400" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                Все борта ({BUS_FLEET.length})
              </button>
              <button
                onClick={() => setFilterMode("anomalies")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  filterMode === "anomalies"
                    ? "bg-rose-600 text-white"
                    : isDarkMode ? "bg-[#222226] text-zinc-400" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                Аномалии (2)
              </button>
            </div>
          </div>

          {/* Fleet List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
            {filteredFleet.map((b) => (
              <div
                key={b.id}
                className={`p-2.5 flex items-center justify-between transition-colors ${
                  b.risk === "critical"
                    ? "bg-rose-500/10 border-l-2 border-rose-500"
                    : b.risk === "warning"
                    ? "bg-amber-500/10 border-l-2 border-amber-500"
                    : isDarkMode ? "hover:bg-white/5" : "hover:bg-zinc-50"
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-xs font-bold ${isDarkMode ? "text-white" : "text-zinc-900"}`}>{b.id}</span>
                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                      isDarkMode ? "text-zinc-400 bg-zinc-800/80 border-white/5" : "text-zinc-500 bg-zinc-100 border-zinc-200"
                    }`}>
                      {b.model}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-0.5">{b.pos}</span>
                </div>
                <div className="flex flex-col items-end text-right">
                  <span
                    className={`font-mono text-xs font-bold ${
                      b.risk === "critical"
                        ? "text-rose-400"
                        : b.risk === "warning"
                        ? "text-amber-400"
                        : isDarkMode ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    {b.dev}
                  </span>
                  <span
                    className={`text-[9px] font-bold mt-0.5 ${
                      b.risk === "critical"
                        ? "text-rose-400"
                        : b.risk === "warning"
                        ? "text-amber-400"
                        : isDarkMode ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom DSS Box */}
          <div className={`p-3 border-t flex flex-col gap-2 shrink-0 ${
            isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                isDarkMode ? "text-zinc-300" : "text-zinc-700"
              }`}>
                СППР Регулирование
              </span>
              <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded border ${
                isDarkMode ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60" : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}>
                96% УСПЕХ
              </span>
            </div>

            <p className={`text-[10.5px] leading-relaxed ${isDarkMode ? "text-zinc-400" : "text-zinc-600"}`}>
              Принудительный Holding лидера борта №1043 на остановочном пункте «м. Бауманская» на 2.5 мин.
            </p>

            <button
              onClick={handleApply}
              disabled={holdingApplied}
              className={`w-full h-8 px-2.5 rounded-lg text-white font-bold text-[11px] shadow-xs transition-all flex items-center justify-center gap-1.5 uppercase cursor-pointer ${
                holdingApplied
                  ? "bg-zinc-700 text-zinc-300 cursor-default"
                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-900/20"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{holdingApplied ? "Holding №1043 применён" : "Применить Holding №1043 (2.5м)"}</span>
            </button>

            {onOpenScenarios && (
              <button
                onClick={onOpenScenarios}
                className={`w-full h-7 px-2 rounded-md border text-[10px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  isDarkMode
                    ? "border-white/10 bg-[#222226] hover:bg-zinc-700 text-zinc-300"
                    : "border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700"
                }`}
              >
                <Grid2x2 size={11} className="shrink-0" />
                <span>Матрица сценариев (4)</span>
                <ChevronDown size={11} className="shrink-0" />
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MareyDiagram;
