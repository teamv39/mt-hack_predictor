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
    <aside className="w-[390px] xl:w-[410px] h-full flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden shrink-0 pointer-events-auto ring-1 ring-slate-900/5">
      {/* 1. Header: Борт P1042, ЛиАЗ-6274 (Электробус), Status Banner */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-blue-600 tracking-tight">
                Борт {vehicle.id}
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                {vehicle.model}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              Рейс: {vehicle.routeId} ({vehicle.routeName})
            </p>
          </div>

          <button className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* High contrast Status Banner */}
        <div
          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-2xs ${
            isApplied
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {isApplied ? (
            <>
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Опоздание 2.5 мин → Прогноз: +2.5 мин (Штатно)</span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>Опоздание 3 мин → Прогноз на задержки: +16 мин</span>
            </>
          )}
        </div>
      </div>

      {/* 2. Scrollable Body with Cleanly Separated Cards */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin">
        {/* Section 1: Card «ПЛАН VS ПРОГНОЗ ЗАДЕРЖКИ» */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-tight">
              <TrendingUp size={15} className="text-blue-600" />
              <span>ПЛАН VS ПРОГНОЗ ЗАДЕРЖКИ</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
              По остановкам
            </span>
          </div>

          {/* Recharts LineChart */}
          <div className="w-full h-[155px] -ml-2 pt-1">
            <ResponsiveContainer width="100%" height={155}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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

                {/* Plan Line */}
                <Line
                  type="monotone"
                  dataKey="plan"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />

                {/* Without DSS: Red curve */}
                <Line
                  type="monotone"
                  dataKey="withoutAction"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#ef4444" }}
                />

                {/* With AI Holding: Green line */}
                <Line
                  type="monotone"
                  dataKey="withHolding"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[10px] text-slate-600 border-t border-slate-100 pt-2 px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-slate-400 rounded-full"></span>
              <span className="font-medium">План (график)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-xs"></span>
              <span className="font-bold text-rose-700">Прогноз (без мер)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
              <span className="font-bold text-emerald-700">С рекомендацией ИИ</span>
            </div>
          </div>
        </div>

        {/* Section 2: Card «ФАКТОРНЫЙ АНАЛИЗ ЗАДЕРЖКИ (SHAP)» */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-tight">
              <Cpu size={15} className="text-blue-600" />
              <span>ФАКТОРНЫЙ АНАЛИЗ ЗАДЕРЖКИ (SHAP)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
              +12.0 мин
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {shapFactors.map((factor, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                    {factor.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-black text-slate-900">
                      {factor.delayMinutes > 0 ? `+${factor.delayMinutes.toFixed(1)}` : factor.delayMinutes.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      ({factor.percent}%)
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${factor.percent}%`,
                      backgroundColor: factor.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Card «РЕКОМЕНДАЦИЯ АЛГОРИТМА» */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/80 to-sky-50/60 border border-emerald-300 shadow-sm space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-blue-900 uppercase tracking-tight">
              <Bot size={16} className="text-blue-600" />
              <span>Рекомендация алгоритма</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              ЭФФЕКТ: {recommendation.effectPercent}%
            </span>
          </div>

          {/* Operational Action Sub-label */}
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
            ОПЕРАТИВНОЕ ДЕЙСТВИЕ ДИСПЕТЧЕРА:
          </div>

          {/* Main Action Instruction Callout */}
          <div className="p-2.5 rounded-xl bg-white/95 border border-slate-200/90 shadow-2xs">
            <p className="text-xs font-black text-slate-900 leading-relaxed">
              {recommendation.text}
            </p>
          </div>

          {/* Info Impact Explanation */}
          <div className="p-2 rounded-lg bg-emerald-100/60 border border-emerald-200/70 flex items-start gap-1.5 text-[11px] text-emerald-900 leading-snug">
            <Info size={14} className="text-emerald-700 shrink-0 mt-0.5" />
            <span>{recommendation.infoText}</span>
          </div>
          {/* Infrastructure Safeguard Badges */}
          <div className="mt-2.5 pt-2 border-t border-sky-100 flex flex-wrap gap-1.5 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-medium text-slate-700 border border-slate-200 shadow-2xs">
              <span className="text-emerald-500 font-bold">✓</span> Заездной карман: Есть
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-medium text-slate-700 border border-slate-200 shadow-2xs">
              <span className="text-emerald-500 font-bold">✓</span> Смежные линии: 1 (Свободно)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white font-medium text-slate-700 border border-slate-200 shadow-2xs">
              <span className="text-blue-500 font-bold">⏱</span> Демпфер: max 180с
            </span>
          </div>

          {/* Passenger Cabin Media Screen Live Preview */}
          <div className="mt-3 p-2.5 rounded-xl bg-slate-900 text-white shadow-inner border border-slate-800">
            <div className="flex items-center justify-between text-[10px] pb-1.5 mb-1.5 border-b border-slate-800 text-slate-400 font-bold tracking-wide uppercase">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                ТАБЛО САЛОНА (БОРТ №{vehicle.badgeLabel})
              </span>
              <span className="text-emerald-400 font-mono text-[11px] font-bold">
                {isApplied ? "СТОЯНКА: 02:18" : "В ДВИЖЕНИИ"}
              </span>
            </div>

            <div className="text-[11px] leading-tight font-medium text-slate-200">
              {isApplied ? (
                <>
                  <div className="text-amber-300 font-bold text-[12px] mb-1">
                    ⚠️ Техническая стоянка для выравнивания интервала
                  </div>
                  <div className="text-[10px] text-slate-300">
                    АСУ-РДС • Двери разблокированы для выхода • До м. Бауманская 4 мин
                  </div>
                </>
              ) : (
                <div className="text-slate-400 text-[10px]">
                  Режим штатного информирования: «Следующая остановка: ул. Бауманская»
                </div>
              )}
            </div>
          </div>

          {/* Full-width Juicy CTA Button */}
          <button
            onClick={() => !isApplied && onApplyHolding(alert.id)}
            disabled={isApplied}
            className={`w-full mt-2 flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl shadow-md transition-all ${
              isApplied
                ? "bg-emerald-700 text-white cursor-default shadow-emerald-700/30"
                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer shadow-emerald-600/30 hover:shadow-lg"
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
