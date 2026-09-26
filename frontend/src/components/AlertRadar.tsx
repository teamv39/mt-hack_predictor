import React, { useState } from "react";
import {
  AlertTriangle,
  Search,
  Cpu,
  Radio,
  Layers,
  BarChart3,
  TrendingDown,
  Clock,
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
      className={`w-[330px] h-full max-h-[calc(100vh-80px)] rounded-xl border shadow-lg overflow-hidden flex flex-col pointer-events-auto shrink-0 select-none backdrop-blur-xl transition-colors duration-200 ${
        isDarkMode
          ? "bg-[#18181b]/95 border-white/10 text-zinc-200 shadow-black/50"
          : "bg-white/95 border-zinc-200 text-zinc-800 shadow-xs"
      }`}
    >
      {/* 1. Header: AlertRadar Title + Live status */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
          isDarkMode
            ? "bg-[#141416] border-white/10 text-white"
            : "bg-zinc-50 border-zinc-200 text-zinc-900"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <h2 className="text-xs font-bold tracking-tight uppercase">
            AlertRadar СППР
          </h2>
          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
            isDarkMode
              ? "bg-white/10 text-zinc-300 border border-white/10"
              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
          }`}>
            {alerts.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
            isDarkMode
              ? "bg-[#222226] text-zinc-400 border-white/10"
              : "bg-zinc-100 text-zinc-600 border-zinc-200"
          }`}>
            LIVE FEED
          </span>
        </div>
      </div>

      {/* 2. Tabs: Алерты | Аналитика ML */}
      <div
        className={`flex h-10 border-b shrink-0 text-xs ${
          isDarkMode ? "bg-[#1c1c20] border-white/10" : "bg-zinc-100 border-zinc-200"
        }`}
      >
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex-1 flex items-center justify-center gap-1.5 font-semibold transition-all relative cursor-pointer ${
            activeTab === "alerts"
              ? isDarkMode
                ? "text-white bg-[#242429]"
                : "text-zinc-900 bg-white"
              : isDarkMode
              ? "text-zinc-400 hover:text-zinc-200"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <span>Алерты</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
            isDarkMode ? "bg-zinc-700 text-zinc-200" : "bg-zinc-200 text-zinc-700"
          }`}>
            {alerts.length}
          </span>
          {activeTab === "alerts" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 flex items-center justify-center gap-1.5 font-semibold transition-all relative cursor-pointer ${
            activeTab === "analytics"
              ? isDarkMode
                ? "text-white bg-[#242429]"
                : "text-zinc-900 bg-white"
              : isDarkMode
              ? "text-zinc-400 hover:text-zinc-200"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <Cpu size={12} className="opacity-80" />
          <span>Аналитика ML</span>
          {activeTab === "analytics" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-400" />
          )}
        </button>
      </div>

      {activeTab === "alerts" ? (
        <>
          {/* 3. Search and Category Filter Chips */}
          <div
            className={`p-3 flex flex-col gap-2 shrink-0 border-b ${
              isDarkMode ? "bg-[#1c1c20] border-white/10" : "bg-white border-zinc-100"
            }`}
          >
            <div className="relative flex items-center h-8">
              <Search size={13} className="absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Поиск по бортам и маршрутам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-8 pl-8 pr-2.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 font-medium transition-colors ${
                  isDarkMode
                    ? "bg-[#141416] border border-white/10 text-white placeholder-zinc-500"
                    : "bg-zinc-50 hover:bg-zinc-100 focus:bg-white border border-zinc-200 text-zinc-800 placeholder-zinc-400"
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveFilter("all")}
                className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? isDarkMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-white"
                    : isDarkMode ? "bg-[#222226] text-zinc-400 hover:text-zinc-200" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Все ({alerts.length})
              </button>
              <button
                onClick={() => setActiveFilter("critical")}
                className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === "critical"
                    ? isDarkMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-white"
                    : isDarkMode ? "bg-[#222226] text-zinc-400 hover:text-zinc-200" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>Критич. ({alerts.filter((a) => a.category === "critical").length})</span>
              </button>
              <button
                onClick={() => setActiveFilter("bunching")}
                className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === "bunching"
                    ? isDarkMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-white"
                    : isDarkMode ? "bg-[#222226] text-zinc-400 hover:text-zinc-200" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>Пачкование ({alerts.filter((a) => a.category === "bunching").length})</span>
              </button>
            </div>
          </div>

          {/* 4. Alert Cards List */}
          <div className="flex-1 p-2.5 overflow-y-auto flex flex-col gap-2">
            {filteredAlerts.map((item) => {
              const isSelected = item.id === selectedAlertId;
              const isHigh = item.tagType === "bunching" || item.category === "critical";

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectAlert(item)}
                  className={`rounded-lg p-3 cursor-pointer transition-all border ${
                    isSelected
                      ? isDarkMode
                        ? "border-zinc-400 bg-[#242429] ring-1 ring-zinc-500/40"
                        : "border-zinc-500 bg-zinc-50/80 ring-1 ring-zinc-400/40"
                      : isDarkMode
                      ? "border-white/10 bg-[#1c1c20] hover:border-white/20 hover:bg-[#242429]"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 shadow-2xs"
                  }`}
                >
                  {/* Card Header: Route badge + Title + Severity */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                        isDarkMode ? "bg-[#27272a] text-zinc-200 border border-white/10" : "bg-zinc-100 text-zinc-800 border border-zinc-200"
                      }`}>
                        {item.routeNumberBadge}
                      </span>
                      <span className={`text-xs font-bold leading-tight ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                        {item.title}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        isHigh
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {isHigh ? "HIGH" : "MEDIUM"}
                    </span>
                  </div>

                  {/* Description */}
                  <p className={`text-[11px] leading-relaxed mb-2.5 ${isDarkMode ? "text-zinc-300" : "text-zinc-600"}`}>
                    {item.description}
                  </p>

                  {/* Footer metrics line */}
                  <div className={`flex items-center justify-between text-[10px] font-mono pt-2 border-t ${
                    isDarkMode ? "border-white/5" : "border-zinc-100"
                  }`}>
                    <span className={isHigh ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>
                      Риск ML: {item.confidence}%
                    </span>
                    <span className={isDarkMode ? "text-zinc-400 font-medium" : "text-zinc-500 font-medium"}>
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
        <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3">
          {/* Card: Engine Status */}
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? "bg-[#1c1c20] border-white/10" : "bg-white border-zinc-200"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CatBoost v24.1 ML Инференс
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                isDarkMode ? "bg-[#141416] text-zinc-300 border-white/10" : "bg-zinc-100 text-zinc-600 border-zinc-200"
              }`}>
                3.2 мс
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className={`p-2 rounded-md border ${
                isDarkMode ? "bg-[#141416] border-white/5" : "bg-zinc-50 border-zinc-100"
              }`}>
                <div className="text-[10px] text-zinc-400 mb-0.5">Ошибка MAE</div>
                <div className={`text-xs font-bold font-mono ${isDarkMode ? "text-zinc-200" : "text-zinc-800"}`}>±1.2 мин</div>
              </div>
              <div className={`p-2 rounded-md border ${
                isDarkMode ? "bg-[#141416] border-white/5" : "bg-zinc-50 border-zinc-100"
              }`}>
                <div className="text-[10px] text-zinc-400 mb-0.5">Точность F1</div>
                <div className={`text-xs font-bold font-mono ${isDarkMode ? "text-zinc-200" : "text-zinc-800"}`}>94.2%</div>
              </div>
            </div>
          </div>

          {/* Card: Global SHAP Factor Importance */}
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? "bg-[#1c1c20] border-white/10" : "bg-white border-zinc-200"
          }`}>
            <span className={`text-xs font-bold block mb-0.5 ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
              Глобальные драйверы задержек (SHAP)
            </span>
            <span className="text-[10px] text-zinc-400 block mb-2.5">
              Анализ 48 электробусных маршрутов
            </span>

            {/* Clean Monochromatic Bar List with subtle primary accent */}
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <span className={isDarkMode ? "text-zinc-300" : "text-zinc-700"}>Заторы на перегонах (BUR)</span>
                  <span className="text-rose-400 font-mono font-bold">46% (+4.8м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-zinc-800" : "bg-zinc-100"}`}>
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: "46%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <span className={isDarkMode ? "text-zinc-300" : "text-zinc-700"}>Посадка в непогоду (PHR)</span>
                  <span className={`font-mono font-semibold ${isDarkMode ? "text-zinc-300" : "text-zinc-700"}`}>24% (+2.5м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-zinc-800" : "bg-zinc-100"}`}>
                  <div className="h-full bg-zinc-500 rounded-full" style={{ width: "24%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <span className={isDarkMode ? "text-zinc-300" : "text-zinc-700"}>Светофорные циклы (SSR)</span>
                  <span className={`font-mono font-semibold ${isDarkMode ? "text-zinc-300" : "text-zinc-700"}`}>18% (+1.9м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-zinc-800" : "bg-zinc-100"}`}>
                  <div className="h-full bg-zinc-500 rounded-full" style={{ width: "18%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-medium mb-1">
                  <span className={isDarkMode ? "text-zinc-300" : "text-zinc-700"}>Помехи на остановках (SRP)</span>
                  <span className="text-zinc-400 font-mono font-semibold">12% (+1.2м)</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-zinc-800" : "bg-zinc-100"}`}>
                  <div className="h-full bg-zinc-600 rounded-full" style={{ width: "12%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
