import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { AlertItem } from "../mock/telemetry";

const MAX_VISIBLE_ALERTS = 5;

interface AlertRadarProps {
  alerts: AlertItem[];
  selectedAlertId: string;
  onSelectAlert: (alert: AlertItem) => void;
  onDismissAlert: (alertId: string) => void;
  appliedHoldingIds: string[];
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
  onDismissAlert,
  appliedHoldingIds,
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
  isDarkMode = false,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const dismissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const appliedAlertIds = alerts
    .filter((alert) => alert.recommendation?.applied || appliedHoldingIds.includes(alert.id))
    .map((alert) => alert.id)
    .join("|");

  useEffect(() => {
    const timers = dismissTimers.current;
    const activeIds = new Set(appliedAlertIds ? appliedAlertIds.split("|") : []);

    for (const [id, timer] of timers) {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
    for (const id of activeIds) {
      if (!timers.has(id)) {
        timers.set(id, setTimeout(() => {
          timers.delete(id);
          onDismissAlert(id);
        }, 30000));
      }
    }
  }, [appliedAlertIds, onDismissAlert]);

  useEffect(() => () => {
    for (const timer of dismissTimers.current.values()) clearTimeout(timer);
    dismissTimers.current.clear();
  }, []);

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

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, activeFilter]);

  const totalPages = Math.ceil(filteredAlerts.length / MAX_VISIBLE_ALERTS);
  const page = totalPages === 0 ? 0 : Math.min(currentPage, totalPages - 1);
  const visibleAlerts = filteredAlerts.slice(
    page * MAX_VISIBLE_ALERTS,
    (page + 1) * MAX_VISIBLE_ALERTS,
  );

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
          <span className={`px-1.5 py-0.5 rounded font-mono text-xs font-bold ${
            isDarkMode
              ? "bg-white/10 text-zinc-300 border border-white/10"
              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
          }`}>
            {alerts.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
            isDarkMode
              ? "bg-[#222226] text-zinc-400 border-white/10"
              : "bg-zinc-100 text-zinc-600 border-zinc-200"
          }`}>
            LIVE FEED
          </span>
        </div>
      </div>

      {/* Search and Category Filters */}
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
                className={`h-6 px-2.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? isDarkMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-white"
                    : isDarkMode ? "bg-[#222226] text-zinc-400 hover:text-zinc-200" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Все ({alerts.length})
              </button>
              <button
                onClick={() => setActiveFilter("critical")}
                className={`h-6 px-2.5 rounded-md text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                className={`h-6 px-2.5 rounded-md text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
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

      {/* Alert Cards List */}
      <div className="flex-1 p-2.5 overflow-y-auto flex flex-col gap-2">
        {visibleAlerts.map((item) => {
              const isSelected = item.id === selectedAlertId;
              const isApplied = item.recommendation?.applied;
              const isHigh = !isApplied && (item.tagType === "bunching" || item.category === "critical");

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
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold font-mono ${
                        isDarkMode ? "bg-[#27272a] text-zinc-200 border border-white/10" : "bg-zinc-100 text-zinc-800 border border-zinc-200"
                      }`}>
                        {item.routeNumberBadge}
                      </span>
                      <span className={`min-w-0 text-xs font-bold leading-tight ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {isApplied ? (
                        <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          {item.recommendation?.action === "DEPOT_RESERVE_APPLIED"
                            ? "РЕЗЕРВ"
                            : item.recommendation?.action === "SKIP_STOP_APPLIED"
                            ? "SKIP-STOP"
                            : "HOLDING"}
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded border ${
                            isHigh
                              ? "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {isHigh ? "HIGH" : "MEDIUM"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDismissAlert(item.id);
                        }}
                        className={`rounded p-1 transition-colors cursor-pointer ${
                          isDarkMode
                            ? "text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        }`}
                        aria-label="Закрыть алерт"
                        title="Закрыть алерт"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className={`text-sm leading-relaxed mb-2.5 ${isDarkMode ? "text-zinc-300" : "text-zinc-600"}`}>
                    {item.description}
                  </p>

                  {/* Footer metrics line */}
                  <div className={`flex items-center justify-between text-xs font-mono pt-2 border-t ${
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

      {totalPages > 1 && (
        <div className={`flex items-center justify-between px-4 py-2 border-t ${
          isDarkMode ? "border-white/10" : "border-gray-200"
        }`}>
          <button
            disabled={page === 0}
            onClick={() => setCurrentPage((current) => Math.max(0, current - 1))}
            className="px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            Назад
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Страница {page + 1} из {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setCurrentPage((current) => Math.min(totalPages - 1, current + 1))}
            className="px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            Далее
          </button>
        </div>
      )}
    </aside>
  );
};
