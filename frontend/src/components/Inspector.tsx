import React from "react";
import {
  X,
  CheckCircle2,
  GitBranch,
  Gauge,
  Clock,
  MapPin,
  Grid2x2,
  ArrowRight,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Vehicle, AlertItem } from "../mock/telemetry";

export interface InspectorProps {
  vehicle?: Vehicle | null;
  alert?: AlertItem | null;
  onApplyHolding?: (alertId: string) => void;
  onOpenScenarios?: () => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export const Inspector: React.FC<InspectorProps> = ({
  vehicle,
  alert,
  onApplyHolding,
  onOpenScenarios,
  onClose,
  isDarkMode = false,
}) => {
  const chartData = alert?.delayChartData?.length
    ? alert.delayChartData.map((d) => ({
        stop: d.stop,
        plan: d.plan,
        withoutAction: d.withoutAction,
        withHolding: d.withHolding,
      }))
    : [
        { stop: "Покровка", plan: 10, withoutAction: 15, withHolding: 15 },
        { stop: "Доброслободская", plan: 20, withoutAction: 45, withHolding: 30 },
        { stop: "м. Бауманская", plan: 30, withoutAction: 85, withHolding: 52 },
        { stop: "м. Семёновская", plan: 45, withoutAction: 145, withHolding: 58 },
      ];

  const recommendation = alert?.recommendation;
  const isApplied = recommendation?.applied || false;
  const alertId = alert?.id || "alert_1042";

  const shapFactors = alert?.shapFactors?.length
    ? alert.shapFactors.map((f, i) => ({
        code: ["BUR", "PHR", "SSR", "SRP", "CFD", "PET", "FHR"][i] || `F${i}`,
        percent: f.percent,
        delayMinutes: f.delayMinutes,
        title: f.title,
      }))
    : [
        { code: "BUR", percent: 46, delayMinutes: 2.3, title: "Затор на перегоне" },
        { code: "PHR", percent: 28, delayMinutes: 1.1, title: "Посадка в непогоду" },
        { code: "SSR", percent: 16, delayMinutes: 0.8, title: "Светофорный цикл" },
        { code: "SRP", percent: 10, delayMinutes: 0.5, title: "Интервальный сдвиг" },
      ];

  const vehicleCleanId = vehicle ? vehicle.id.replace(/^P/, "") : "1042";
  const vehicleTitle = `Электробус №${vehicleCleanId}`;
  const routeBadge = vehicle
    ? `${vehicle.routeId} • ${vehicle.routeName.split("—")[0].trim()} → ${vehicle.routeName.split("—")[1]?.trim() || "Лужники"}`
    : `${alert?.routeNumberBadge || "м3"} • Семёновская → Лужники`;

  const targetVehId = recommendation?.targetVehicleId || "№1043";
  const effectPercent = recommendation?.effectPercent || 96;
  const recText =
    recommendation?.text ||
    `Придержать лидер ${targetVehId} на остановке «м. Бауманская» на 2.5 мин.`;
  const recInfoText =
    recommendation?.infoText || "Интервал восстановится с 1.4 мин до 8.0 мин.";

  return (
    <aside
      className={`w-[350px] max-h-[calc(100vh-80px)] overflow-y-auto rounded-xl border shadow-lg p-3.5 flex flex-col gap-3 z-20 pointer-events-auto shrink-0 select-none scrollbar-thin backdrop-blur-xl transition-colors duration-200 ${
        isDarkMode
          ? "bg-[#18181b]/95 border-white/10 text-zinc-200 shadow-black/50"
          : "bg-white/95 border-zinc-200 text-zinc-800 shadow-xs"
      }`}
    >
      {/* 1. Header: Inspector Title and Close */}
      <div
        className={`flex items-center justify-between pb-2 border-b ${
          isDarkMode ? "border-white/10 text-zinc-400" : "border-zinc-100 text-zinc-600"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <GitBranch size={14} className="opacity-70" />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-zinc-300" : "text-zinc-800"}`}>
            Инспектор СППР
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDarkMode ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
            }`}
            title="Свернуть инспектор"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2. Unit Title, Route Badge, and Telemetry Capsules */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={`text-base font-bold tracking-tight ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
            {vehicleTitle}
          </h2>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              vehicle?.status === "BUNCHING_RISK" || alert?.category === "critical"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            {vehicle?.status === "BUNCHING_RISK" ? "ПАЧКОВАНИЕ" : "РИСК СБОЯ"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isDarkMode
                ? "bg-[#27272a] border-white/10 text-zinc-200"
                : "bg-zinc-100 border-zinc-200 text-zinc-800"
            }`}
          >
            {routeBadge}
          </span>
          <span
            className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
              isDarkMode ? "bg-[#222226] text-zinc-400 border-white/5" : "bg-zinc-100 text-zinc-600 border-zinc-200"
            }`}
          >
            {vehicle?.plateNumber || "В 042 АХ 777"}
          </span>
        </div>

        {/* Live Telemetry Metric Capsules */}
        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
          <div
            className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center ${
              isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-0.5">
              <Gauge size={11} className="opacity-70" />
              <span>Скорость</span>
            </div>
            <span className={`text-xs font-bold font-mono ${isDarkMode ? "text-zinc-100" : "text-zinc-900"}`}>
              {vehicle?.speedKmh ?? 14} км/ч
            </span>
          </div>

          <div
            className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center ${
              isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-0.5">
              <Clock size={11} className="opacity-70" />
              <span>Задержка</span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-400">
              +{Math.round((vehicle?.delaySeconds ?? 180) / 60)} мин
            </span>
          </div>

          <div
            className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center ${
              isDarkMode ? "bg-[#222226] border-white/5" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-0.5">
              <MapPin size={11} className="opacity-70" />
              <span>Остановка</span>
            </div>
            <span className={`text-[11px] font-semibold truncate max-w-full ${isDarkMode ? "text-zinc-200" : "text-zinc-700"}`}>
              {vehicle?.nextStop || "м. Бауманская"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Recharts Trajectory comparison curve */}
      <div
        className={`rounded-lg border p-3 flex flex-col gap-1.5 ${
          isDarkMode ? "bg-[#222226] border-white/10" : "bg-white border-zinc-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
            Прогноз задержки (сек)
          </span>
          <div className="flex items-center gap-2 text-[10px] font-medium">
            <span className="text-zinc-400 flex items-center gap-1">
              <span className="w-2 h-0.5 border-t border-dashed border-zinc-400 inline-block" /> План
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2 h-0.5 bg-rose-500 inline-block" /> Без мер
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-0.5 bg-emerald-500 inline-block" /> Holding
            </span>
          </div>
        </div>

        <div className="h-28 w-full mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
              <XAxis dataKey="stop" tick={{ fontSize: 9, fill: isDarkMode ? "#a1a1aa" : "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: isDarkMode ? "#a1a1aa" : "#71717a" }} axisLine={false} tickLine={false} unit="с" />
              <Tooltip
                contentStyle={{
                  fontSize: "11px",
                  borderRadius: "6px",
                  backgroundColor: isDarkMode ? "rgba(24, 24, 27, 0.95)" : "rgba(255, 255, 255, 0.95)",
                  borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "#e4e4e7",
                  color: isDarkMode ? "#f4f4f5" : "#18181b",
                }}
              />
              <Line type="monotone" dataKey="plan" name="План" stroke="#71717a" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="withoutAction" name="Без мер" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="withHolding" name="С Holding" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Explainable AI: SHAP Factor Decomposition */}
      <div
        className={`rounded-lg border p-3 flex flex-col gap-2 ${
          isDarkMode
            ? "border-white/10 bg-[#222226] text-white"
            : "border-zinc-200 bg-zinc-50/70 text-zinc-900"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>Факторный анализ (SHAP)</span>
          </span>
          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${
            isDarkMode ? "bg-[#18181b] text-zinc-300 border-white/5" : "bg-white text-zinc-700 border-zinc-200"
          }`}>
            CatBoost ML
          </span>
        </div>

        {/* Clear Horizontal Bar List */}
        <div className="space-y-1.5 text-xs">
          {shapFactors.map((f, i) => (
            <div key={f.code}>
              <div className="flex justify-between items-center text-[10px] font-medium mb-0.5">
                <span className={isDarkMode ? "text-zinc-300" : "text-zinc-700"}>
                  {f.title} <span className="opacity-60 font-mono">({f.code})</span>
                </span>
                <span className={`font-mono font-semibold ${i === 0 ? "text-rose-400 font-bold" : "text-zinc-400"}`}>
                  +{f.delayMinutes.toFixed(1)}м ({f.percent}%)
                </span>
              </div>
              <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-zinc-800" : "bg-zinc-200"}`}>
                <div
                  className={`h-full rounded-full ${
                    i === 0 ? "bg-rose-500" : "bg-zinc-500"
                  }`}
                  style={{ width: `${f.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Holding Action DSS Recommendation Box */}
      <div
        className={`rounded-lg border p-3 flex flex-col gap-2 ${
          isDarkMode
            ? "border-zinc-700 bg-[#242429]"
            : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider ${
            isDarkMode ? "text-zinc-100" : "text-zinc-900"
          }`}>
            СППР: Рекомендация Holding
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
            isDarkMode ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60" : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}>
            ЭФФЕКТ: {effectPercent}%
          </span>
        </div>

        <p className={`text-xs leading-relaxed ${isDarkMode ? "text-zinc-300" : "text-zinc-700"}`}>
          {recText}
        </p>
        <span className={`text-[11px] font-medium ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
          {recInfoText}
        </span>

        {/* Primary Action Button */}
        <button
          onClick={() => !isApplied && onApplyHolding && onApplyHolding(alertId)}
          disabled={isApplied}
          className={`w-full h-9 px-3 rounded-lg text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer ${
            isApplied
              ? "bg-zinc-700 text-zinc-300 cursor-default"
              : "bg-emerald-600 hover:bg-emerald-500 active:scale-98 shadow-emerald-900/20"
          }`}
        >
          <CheckCircle2 size={14} />
          <span>
            {isApplied
              ? `Holding применён • Команда на ${targetVehId}`
              : `Применить Holding (${targetVehId})`}
          </span>
        </button>

        {/* Secondary: Scenarios Matrix */}
        {onOpenScenarios && (
          <button
            onClick={onOpenScenarios}
            className={`w-full h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isDarkMode
                ? "bg-[#1c1c20] hover:bg-white/5 border-white/10 text-zinc-300"
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}
          >
            <Grid2x2 size={12} />
            <span>Матрица альтернативных сценариев (4)</span>
          </button>
        )}
      </div>
    </aside>
  );
};
