import React, { useState } from "react";
import {
  AlertTriangle,
  Search,
  Sparkles,
} from "lucide-react";
import { AlertItem } from "../mock/telemetry";

interface AlertRadarProps {
  alerts: AlertItem[];
  selectedAlertId: string;
  onSelectAlert: (alert: AlertItem) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: "all" | "critical" | "bunching";
  setActiveFilter: (filter: "all" | "critical" | "bunching") => void;
  isDarkMode?: boolean;
}

export const AlertRadar: React.FC<AlertRadarProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<"alerts" | "analytics">("alerts");

  const filteredAlerts = alerts.filter((item) => {
    const matchesSearch =
      item.routeNumberBadge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === "critical") return item.category === "critical";
    if (activeFilter === "bunching") return item.category === "bunching";
    return true;
  });

  return (
    <aside
      className={`w-[330px] h-full max-h-[calc(100vh-100px)] rounded-2xl border shadow-2xl overflow-hidden flex flex-col pointer-events-auto shrink-0 select-none backdrop-blur-xl transition-colors duration-200 ${
        isDarkMode
          ? "bg-[#18181b]/95 border-zinc-800 text-zinc-100 shadow-black/60"
          : "bg-white/95 border-slate-300 text-slate-800 shadow-slate-950/15"
      }`}
    >
      {/* 1. Header: Red Dot + AlertRadar + Badge + More Menu */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? "bg-[#121214] border-zinc-800 text-white" : "bg-[#27272a] border-zinc-700 text-white"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h2 className="text-sm font-black tracking-tight text-white">
            AlertRadar СППР
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-black text-[11px] border border-rose-500/40">
            {alerts.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-950 text-cyan-300 border border-blue-800/80">
            LIVE FEED
          </span>
        </div>
      </div>

      {/* 2. Tabs: Текущие алерты | Аналитика ML */}
      <div
        className={`flex h-11 border-b shrink-0 text-xs ${
          isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-slate-100/70 border-slate-200"
        }`}
      >
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex-1 flex items-center justify-center gap-2 font-bold transition-all relative cursor-pointer ${
            activeTab === "alerts"
              ? isDarkMode ? "text-emerald-400 bg-[#222226]" : "text-emerald-800 bg-white"
              : isDarkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>Алерты</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            isDarkMode ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80" : "bg-emerald-100 text-emerald-800"
          }`}>
            {alerts.length}
          </span>
          {activeTab === "alerts" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 flex items-center justify-center gap-1.5 font-bold transition-all relative cursor-pointer ${
            activeTab === "analytics"
              ? isDarkMode ? "text-cyan-400 bg-[#222226]" : "text-blue-800 bg-white"
              : isDarkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Sparkles size={13} className="text-cyan-400" />
          <span>Аналитика ML</span>
          {activeTab === "analytics" && (
            <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${isDarkMode ? "bg-cyan-400" : "bg-blue-600"}`} />
          )}
        </button>
      </div>

      {activeTab === "alerts" ? (
        <>
          {/* 3. Search and Category Filter Chips */}
          <div
            className={`p-3.5 flex flex-col gap-2.5 shrink-0 border-b ${
              isDarkMode ? "bg-[#18181b] border-zinc-800" : "bg-white border-slate-100"
            }`}
          >
            <div className="relative flex items-center h-9">
              <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Поиск по бортам и маршрутам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-9 pl-9 pr-3 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium transition-colors ${
                  isDarkMode
                    ? "bg-[#121214] border border-zinc-700 text-white placeholder-zinc-500"
                    : "bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 text-slate-800 placeholder-slate-400"
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveFilter("all")}
                className={`h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? isDarkMode ? "bg-zinc-700 text-white shadow-xs" : "bg-slate-900 text-white"
                    : isDarkMode ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Все ({alerts.length})
              </button>
              <button
                onClick={() => setActiveFilter("critical")}
                className={`h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "critical"
                    ? "bg-rose-600 text-white shadow-xs"
                    : isDarkMode ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Критич. ({alerts.filter((a) => a.category === "critical").length})
              </button>
              <button
                onClick={() => setActiveFilter("bunching")}
                className={`h-7 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === "bunching"
                    ? "bg-amber-600 text-white shadow-xs"
                    : isDarkMode ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Пачкование ({alerts.filter((a) => a.category === "bunching").length})
              </button>
            </div>
          </div>

          {/* 4. Alert Cards List */}
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
            {filteredAlerts.map((item) => {
              const isSelected = item.id === selectedAlertId;
              const isHigh = item.tagType === "bunching" || item.category === "critical";

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectAlert(item)}
                  className={`rounded-xl p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? isDarkMode
                        ? "border-2 border-rose-500 bg-rose-950/40 shadow-xl ring-2 ring-rose-500/20"
                        : "border-2 border-[#DA251D] bg-rose-50/50 shadow-md"
                      : isDarkMode
                      ? "border border-zinc-700/80 bg-[#222226] hover:border-zinc-600 hover:bg-[#27272b] shadow-sm"
                      : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-xs"
                  }`}
                >
                  {/* Card Header: Icon + Title + Severity Badge */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        size={15}
                        className={isHigh ? "text-rose-500 shrink-0" : "text-amber-500 shrink-0"}
                      />
                      <span className={`text-xs font-bold leading-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {item.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        isDarkMode ? "bg-blue-900/60 text-cyan-300" : "bg-blue-100 text-blue-800"
                      }`}>
                        {item.routeNumberBadge}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        isHigh
                          ? isDarkMode ? "bg-rose-900/60 text-rose-300 border border-rose-700" : "bg-rose-100 text-rose-700"
                          : isDarkMode ? "bg-amber-900/60 text-amber-300 border border-amber-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isHigh ? "HIGH" : "MEDIUM"}
                    </span>
                  </div>

                  {/* Description */}
                  <p className={`text-xs leading-relaxed mb-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    {item.description}
                  </p>

                  {/* Footer metrics line */}
                  <div className={`flex items-center justify-between text-[11px] font-mono pt-2 border-t ${
                    isDarkMode ? "border-slate-700/60" : "border-slate-100"
                  }`}>
                    <span className={isHigh ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>
                      Риск ML: {item.confidence}%
                    </span>
                    <span className={isDarkMode ? "text-slate-400 font-semibold" : "text-slate-500 font-semibold"}>
                      {item.delayLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* ML Analytics Hub View */
        <div className="flex-1 p-3.5 overflow-y-auto flex flex-col gap-3.5">
          {/* Card: Engine Status */}
          <div className={`p-3.5 rounded-xl border ${
            isDarkMode ? "bg-[#18181b] border-zinc-700/80" : "bg-white border-slate-200"
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                CatBoost v24.1 ML Инференс
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                isDarkMode ? "bg-[#222226] text-zinc-300" : "bg-slate-100 text-slate-600"
              }`}>
                3.2 мс
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className={`p-2.5 rounded-xl border ${
                isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-slate-50 border-slate-100"
              }`}>
                <div className="text-[10px] text-slate-400 mb-0.5">Ошибка MAE</div>
                <div className="text-sm font-black font-mono text-cyan-400">±1.2 мин</div>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-slate-50 border-slate-100"
              }`}>
                <div className="text-[10px] text-slate-400 mb-0.5">Точность F1</div>
                <div className="text-sm font-black font-mono text-emerald-400">94.2%</div>
              </div>
            </div>
          </div>

          {/* Card: Global SHAP Factor Importance */}
          <div className={`p-3.5 rounded-xl border ${
            isDarkMode ? "bg-[#18181b] border-zinc-700/80" : "bg-white border-slate-200"
          }`}>
            <span className={`text-xs font-bold block mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Глобальные драйверы задержек (SHAP)
            </span>
            <span className="text-[11px] text-slate-400 block mb-3">
              Анализ 48 электробусных маршрутов
            </span>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Заторы на перегонах (BUR)</span>
                  <span className="text-rose-400 font-mono font-bold">46% (+4.8м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: "46%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Посадка в непогоду (PHR)</span>
                  <span className="text-blue-400 font-mono font-bold">24% (+2.5м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: "24%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Светофорные фазы ЦОДД (SSR)</span>
                  <span className="text-purple-400 font-mono font-bold">18% (+1.8м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: "18%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Нестабильность интервала (SRP)</span>
                  <span className="text-amber-400 font-mono font-bold">12% (+1.2м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "12%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Fleet Stability Status */}
          <div className={`p-3.5 rounded-xl border ${
            isDarkMode ? "bg-[#222226] border-zinc-700/80" : "bg-white border-slate-200"
          }`}>
            <span className={`text-xs font-bold block mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Состояние такта движения
            </span>
            <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden mb-2.5">
              <div className="h-full bg-emerald-500" style={{ width: "82%" }} title="В графике: 82%" />
              <div className="h-full bg-amber-500" style={{ width: "12%" }} title="Задержка: 12%" />
              <div className="h-full bg-rose-500" style={{ width: "6%" }} title="Пачкование: 6%" />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Норма 82%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Риск 12%</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Сбой 6%</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Footer: Real-time monitoring note */}
      <div
        className={`p-3 border-t text-[11px] font-medium text-center shrink-0 ${
          isDarkMode
            ? "bg-[#141416] border-zinc-800 text-zinc-400"
            : "bg-slate-50 border-slate-200 text-slate-500"
        }`}
      >
        Мониторинг 48 электробусных маршрутов LIVE
      </div>
    </aside>
  );
};

export default AlertRadar;
