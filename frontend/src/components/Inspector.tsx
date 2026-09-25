import React from 'react';
import { X, AlertTriangle, Cpu, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Vehicle, AlertItem } from '../mock/telemetry';

export interface InspectorProps {
  vehicle?: Vehicle | null;
  alert?: AlertItem | null;
  onApplyHolding?: (alertId: string) => void;
  onClose?: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  vehicle,
  alert,
  onApplyHolding,
  onClose,
}) => {
  const chartData = alert?.delayChartData
    ? alert.delayChartData.map((d) => ({
        stop: d.stop,
        plan: d.plan,
        pred: d.withoutAction,
        opt: d.withHolding,
      }))
    : [
        { stop: 'Покровка', plan: 15, pred: 15, opt: 15 },
        { stop: 'Доброслободская', plan: 25, pred: 45, opt: 30 },
        { stop: 'м. Бауманская', plan: 32, pred: 85, opt: 50 },
        { stop: 'м. Семёновская', plan: 45, pred: 145, opt: 55 },
      ];

  const recommendation = alert?.recommendation;
  const isApplied = recommendation?.applied || false;
  const alertId = alert?.id || 'alert_1042';

  return (
    <aside className="w-[380px] max-h-[calc(100vh-80px)] overflow-y-auto p-4 flex flex-col gap-3.5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl z-20 pointer-events-auto shrink-0 scrollbar-thin">
      
      {/* 1. ШАПКА БОРТА */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900">
              Борт {vehicle?.id || 'P1042'}
            </h2>
            <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-md">
              {vehicle?.model || 'ЛиАЗ-6274 (Электробус)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <p className="text-xs text-slate-500 mb-2.5">
          Рейс: <span className="font-medium text-slate-700">{vehicle ? `${vehicle.routeId} (${vehicle.routeName})` : 'м3 (Серебряный бор — Семёновская)'}</span>
        </p>
        
        <div
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
            isApplied
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border border-amber-200 text-amber-900'
          }`}
        >
          {isApplied ? (
            <>
              <ShieldCheck className="text-emerald-600 shrink-0" size={15} />
              <span>Опоздание 2.5 мин → Прогноз: <strong className="text-emerald-700">+2.5 мин (Штатно)</strong></span>
            </>
          ) : (
            <>
              <AlertTriangle className="text-amber-600 shrink-0" size={14} />
              <span>Опоздание 3 мин → Прогноз: <strong className="text-rose-600">+16 мин</strong></span>
            </>
          )}
        </div>
      </div>

      {/* 2. ГРАФИК ПРОГНОЗА */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
            <TrendingUp className="text-blue-600" size={13} />
            План vs Прогноз задержки
          </span>
          <span className="text-[10px] text-slate-400 font-medium">ПО ОСТАНОВКАМ</span>
        </div>

        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <XAxis dataKey="stop" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="plan" stroke="#94a3b8" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="pred" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="opt" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-600 font-medium mt-2 pt-2 border-t border-slate-200/60">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> План</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Прогноз без мер</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> С рекомендацией ИИ</span>
        </div>
      </div>

      {/* 3. ФАКТОРНЫЙ АНАЛИЗ SHAP */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
            <Cpu className="text-indigo-600" size={13} />
            Факторный анализ (SHAP)
          </span>
          <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
            +12.0 МИН
          </span>
        </div>

        {/* Фактор 1 */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
            <span>Затор: Бауманская — Электрозаводская</span>
            <span className="text-rose-600 font-bold">-5.0 мин (45%)</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full w-[45%]" />
          </div>
        </div>

        {/* Фактор 2 */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
            <span>Посадка пассажиров (осадки / дождь)</span>
            <span className="text-sky-600 font-bold">+3.0 мин (25%)</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full w-[25%]" />
          </div>
        </div>

        {/* Фактор 3 */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
            <span>Светофорное регулирование ТТК-ДД</span>
            <span className="text-indigo-600 font-bold">+1.5 мин (18%)</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full w-[18%]" />
          </div>
        </div>
      </div>

      {/* 4. РЕКОМЕНДАЦИЯ АЛГОРИТМА */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle2 className="text-emerald-600" size={13} />
            Рекомендация алгоритма
          </span>
          <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
            ЭФФЕКТ: {recommendation?.effectPercent || 96}%
          </span>
        </div>

        <p className="text-xs font-bold text-slate-900 leading-snug">
          {recommendation?.text || 'Придержать идущий следом Борт №1043 на остановке «Метро Бауманская» на 2.5 минуты.'}
        </p>

        <p className="text-[11px] text-slate-600 leading-normal">
          {recommendation?.infoText || 'Интервал восстановится с 2 мин до расчетных 7.5 мин. Пачкование будет устранено на всей линии.'}
        </p>

        <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[10px] text-emerald-950 font-medium">
          <span>✓ Заездной карман: Есть</span>
          <span>✓ Смежные: Свободно</span>
          <span>⏱ Демпфер: max 180с</span>
        </div>

        <button 
          onClick={() => !isApplied && onApplyHolding && onApplyHolding(alertId)}
          disabled={isApplied}
          className={`mt-1 w-full font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
            isApplied
              ? 'bg-emerald-700 text-white cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white cursor-pointer'
          }`}
        >
          <CheckCircle2 size={15} />
          {isApplied ? '✓ Применено и передано в АСУ' : 'Применить и передать в АСУ'}
        </button>
      </div>

    </aside>
  );
};

export default Inspector;
