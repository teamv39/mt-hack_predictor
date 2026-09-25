import React from "react";
import {
  TrendingUp,
  Cpu,
  CheckCircle2,
  X,
  Info,
  Bot,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Vehicle, AlertItem } from "../mock/telemetry";

interface InspectorProps {
  vehicle: Vehicle | null;
  alert: AlertItem | null;
  onApplyHolding: (alertId: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  vehicle,
  alert,
  onApplyHolding,
}) => {
  if (!vehicle || !alert) return null;

  const recommendation = alert.recommendation;
  const isApplied = recommendation.applied;
  const chartData = alert.delayChartData;
  const shapFactors = alert.shapFactors;

  return (
    <aside className="w-[400px] h-full max-h-[calc(100vh-100px)] flex flex-col bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden pointer-events-auto shrink-0">
      {/* Scrollable Container with 4 Distinct Card Blocks */}
      <div className="flex flex-col p-3 overflow-y-auto max-h-[calc(100vh-100px)] scrollbar-thin">
        {/* 1. Блок борта (Header card) */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 mb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Борт {vehicle.id}
              </h2>
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-md border border-blue-200/60">
                {vehicle.model}
              </span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={15} />
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-1">
            Рейс: {vehicle.routeId} ({vehicle.routeName})
          </p>

          {/* Status banner */}
          <div
            className={`mt-2 p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
              isApplied
                ? "bg-emerald-50/80 border border-emerald-200 text-emerald-800"
                : "bg-amber-50/80 border border-amber-200 text-amber-800"
            }`}
          >
            {isApplied ? (
              <>
                <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                <span>Опоздание 2.5 мин → Прогноз на задержки: +2.5 мин (Штатно)</span>
              </>
            ) : (
              <>
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>Опоздание 3 мин → Прогноз на задержки: +16 мин</span>
              </>
            )}
          </div>
        </div>

        {/* 2. Блок «План vs Прогноз» (Chart card) */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 mb-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-600" />
              <span>ПЛАН VS ПРОГНОЗ ЗАДЕРЖКИ</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              По остановкам
            </span>
          </div>

          <div className="w-full h-[160px] -ml-2">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="stop"
                  tick={{ fontSize: 9, fill: "#64748b", fontWeight: 600 }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                />
                <YAxis
                  ticks={[0, 50, 100, 150]}
                  domain={[0, 160]}
                  tick={{ fontSize: 9, fill: "#64748b", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                  formatter={(val: any, name: any) => [
                    `${val} с`,
                    name === "plan"
                      ? "План"
                      : name === "withoutAction"
                      ? "Прогноз без мер"
                      : "С рекомендацией ИИ",
                  ]}
                />

                {/* Plan Line: with dots */}
                <Line
                  type="monotone"
                  dataKey="plan"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: "#94a3b8" }}
                />

                {/* Without DSS: Red curve with dots */}
                <Line
                  type="monotone"
                  dataKey="withoutAction"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#ef4444" }}
                />

                {/* With AI Holding: Green line with dots */}
                <Line
                  type="monotone"
                  dataKey="withHolding"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Legend at bottom */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/80 pt-2 px-1 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
              <span>План</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-rose-500 rounded-xs"></span>
              <span className="font-bold text-rose-600">Прогноз (без мер)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="font-bold text-emerald-600">С рекомендацией ИИ</span>
            </div>
          </div>
        </div>

        {/* 3. Блок «Факторный анализ (SHAP)» (XAI card) */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 mb-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Cpu size={14} className="text-blue-600" />
              <span>ФАКТОРНЫЙ АНАЛИЗ (SHAP)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              +12.0 мин
            </span>
          </div>

          <div className="space-y-2.5 mt-2">
            {shapFactors.map((factor, idx) => {
              let barColor = "bg-rose-500";
              const titleLower = factor.title.toLowerCase();
              if (titleLower.includes("посадк") || titleLower.includes("пассажир") || titleLower.includes("осадк")) {
                barColor = "bg-sky-500";
              } else if (titleLower.includes("светофор") || titleLower.includes("регулирован") || titleLower.includes("ттк")) {
                barColor = "bg-indigo-500";
              }

              return (
                <div key={idx}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span className="truncate max-w-[220px]">{factor.title}</span>
                    <span className="font-semibold text-slate-900 shrink-0">
                      {factor.delayMinutes > 0 ? `+${factor.delayMinutes.toFixed(1)}` : factor.delayMinutes.toFixed(1)} мин ({factor.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-700`}
                      style={{ width: `${factor.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Блок «Рекомендация алгоритма» (Action card) */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 mb-2.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-900">
            <div className="flex items-center gap-1.5">
              <Bot size={15} className="text-emerald-700" />
              <span>Рекомендация алгоритма</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              ЭФФЕКТ: {recommendation.effectPercent}%
            </span>
          </div>

          <p className="text-xs font-semibold text-slate-800 mt-1.5 leading-snug">
            {recommendation.text}
          </p>

          <div className="mt-2 p-2 rounded-lg bg-emerald-50/80 border border-emerald-100 flex items-start gap-1.5 text-[11px] text-emerald-900 leading-snug">
            <Info size={13} className="text-emerald-700 shrink-0 mt-0.5" />
            <span>{recommendation.infoText}</span>
          </div>

          {/* Infrastructure Safeguard Badges */}
          <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-medium text-slate-700 border border-slate-200 shadow-2xs">
              <span className="text-emerald-500 font-bold">✓</span> Заездной карман: Есть
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-medium text-slate-700 border border-slate-200 shadow-2xs">
              <span className="text-emerald-500 font-bold">✓</span> Смежные линии: Свободно
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-medium text-slate-700 border border-slate-200 shadow-2xs">
              <span className="text-blue-500 font-bold">⏱</span> Демпфер: max 180с
            </span>
          </div>

          {/* Full-width Big Button */}
          <button
            onClick={() => !isApplied && onApplyHolding(alert.id)}
            disabled={isApplied}
            className={`w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
              isApplied ? "bg-emerald-700 text-white cursor-default shadow-none" : "cursor-pointer"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{isApplied ? "✓ Применено и передано в АСУ" : "✓ Применить и передать в АСУ"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
