import React, { useState } from "react";
import {
  X,
  Compass,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  ArrowRight,
  ArrowLeft,
  Cpu,
  ShieldCheck,
  Radio,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface JuryGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

interface StepItem {
  id: number;
  badge: string;
  criterion: string;
  title: string;
  summary: string;
  points: { title: string; desc: string }[];
  actionPrompt: string;
  tabTarget?: "hall" | "marey" | "terminal";
}

const STEPS: StepItem[] = [
  {
    id: 1,
    badge: "Шаг 1 • Горизонт T+15 мин",
    criterion: "Критерий 2 (0–4 балла)",
    title: "Интерактивная карта и упреждающий ML-прогноз",
    summary:
      "Система заблаговременно (за 10–15 минут) выявляет риск схлопывания интервала («пачкования») между электробусами.",
    points: [
      {
        title: "Таймлайн прогнозирования",
        desc: "Переключайте бегунок снизу: «Сейчас» ➔ «+15м (ML)» ➔ «+30м» ➔ «+45м». На T+15 мин наглядно виден очаг пачкования на перегоне Бауманская → Бакунинская.",
      },
      {
        title: "Светофорная индикация",
        desc: "Борта автоматически подсвечиваются: Зелёный (в графике), Жёлтый (задержка), Красный (риск пачкования, борт #1042 настигает #1043).",
      },
      {
        title: "Вектор связки пачкования",
        desc: "Опасная дистанция между сближающимися электробусами соединяется красной линией с указанием критического интервала (1.2 мин вместо нормы 8 мин).",
      },
    ],
    actionPrompt: "Попробуйте переключить таймлайн на «+15м (ML)» на карте",
    tabTarget: "hall",
  },
  {
    id: 2,
    badge: "Шаг 2 • Объяснимый ИИ",
    criterion: "Критерий 4 (0–6 баллов)",
    title: "Explainable AI (XAI) и факторный анализ SHAP",
    summary:
      "Диспетчер видит не «чёрный ящик», а точные математические первопричины прогнозируемого сбоя.",
    points: [
      {
        title: "Декомпозиция задержки",
        desc: "В правой панели «Инспектор» рассчитывается точный вклад факторов: затор на Бакунинской (+2.3 мин, 55%), посадка в дождь (+1.1 мин, 27%), светофор ТТК (+0.8 мин, 18%).",
      },
      {
        title: "Сравнение траекторий (Recharts)",
        desc: "График показывает 3 кривые: Синяя пунктирная (План), Красная (Без мер — задержка до 22 мин), Зелёная (При упреждении Holding).",
      },
      {
        title: "Драйверы CatBoost v24.1",
        desc: "Во вкладке «Аналитика ML» радара отображаются глобальные веса признаков модели на основе анализа 48 электробусных маршрутов.",
      },
    ],
    actionPrompt: "Откройте карточку борта #1042 в правом инспекторе",
    tabTarget: "hall",
  },
  {
    id: 3,
    badge: "Шаг 3 • Готовое действие",
    criterion: "Критерий 4 (Actionable UI)",
    title: "Стратегия Holding и устранение сбоя в 1 клик",
    summary:
      "Система Поддержки Принятия Решений (СППР) выдаёт конкретное регулировочное воздействие по формуле Велдинга.",
    points: [
      {
        title: "Кнопка «Применить Holding»",
        desc: "Рекомендация: придержать лидерный борт #1043 на остановке м. «Бауманская» на 2.5 мин. Нажмите кнопку в Инспекторе — график и прогноз мгновенно стабилизируются!",
      },
      {
        title: "Эффект восстановления",
        desc: "Интервал движения восстанавливается с 1.4 мин до целевых 7.5 мин. Пачкование предотвращено до его наступления.",
      },
      {
        title: "Матрица сценариев СППР (What-if)",
        desc: "Кнопка «Матрица сценариев» открывает 4 тактические стратегии: Holding, нагон графика, размен ниток, ввод резервного борта.",
      },
    ],
    actionPrompt: "Нажмите зелёную кнопку «Применить Holding» в Инспекторе",
    tabTarget: "hall",
  },
  {
    id: 4,
    badge: "Шаг 4 • График Марея",
    criterion: "Бонусная фича (Магистрали)",
    title: "Струнный график движения Марея (маршрут м3)",
    summary:
      "Профессиональный рабочий инструмент главного диспетчера службы движения Мостранспорта.",
    points: [
      {
        title: "12 электробусов в реальном времени",
        desc: "Координатная сетка «Время (X) — Остановочные пункты (Y)». Нитка каждого борта отображает фактическое положение и прогноз.",
      },
      {
        title: "Коэффициент вариации интервалов (CV)",
        desc: "В верхней плашке отображается метрика регулярности CV: норма < 0.20. При пачковании — 0.42 (Сбой), после Holding — 0.18 (Норма).",
      },
      {
        title: "Интерактивная точка пересечения",
        desc: "Клик по зоне пересечения траекторий открывает плавающее окно упреждения с возможностью применить Holding прямо на графике.",
      },
    ],
    actionPrompt: "Перейдите на вкладку «График Марея (м3)» в шапке",
    tabTarget: "marey",
  },
  {
    id: 5,
    badge: "Шаг 5 • Борт ТС",
    criterion: "Бонусная фича (End-to-End)",
    title: "Кабинный терминал водителя (Гранит-Навигатор)",
    summary:
      "Замыкание контура управления: передача управляющей директивы из диспетчерского центра прямо в кабину водителя.",
    points: [
      {
        title: "Таймер технологической выдержки",
        desc: "Большие антибликовые цифры обратного отсчета (150 сек). Водитель точно видит расчетное время отправления (00:53 МСК).",
      },
      {
        title: "Схема перегона и автоинформатор",
        desc: "Наглядный трек дистанции до лидера + автоматическая трансляция сообщения пассажирам: «Уважаемые пассажиры, технологическая регулировка интервала».",
      },
      {
        title: "Квитирование команды",
        desc: "Кнопка подтверждения фиксирует отметку исполнения директивы и отправляет статус обратно в диспетчерскую.",
      },
    ],
    actionPrompt: "Перейдите на вкладку «Терминал борта» в шапке",
    tabTarget: "terminal",
  },
];

export const JuryGuideModal: React.FC<JuryGuideModalProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIdx];
  const isFirst = currentStepIdx === 0;
  const isLast = currentStepIdx === STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) {
      setCurrentStepIdx((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans select-none">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all max-h-[92vh] ${
          isDarkMode
            ? "bg-[#18181b] border-zinc-700/80 text-zinc-100 shadow-black/80"
            : "bg-white border-zinc-200 text-zinc-900 shadow-slate-900/20"
        }`}
        data-purpose="jury-guide-modal"
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-gradient-to-r from-red-50 to-white border-zinc-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D32F2F] text-white flex items-center justify-center shadow-xs">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#D32F2F]">
                  Инструкция для экспертов и жюри
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                  isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700"
                }`}>
                  Трек №3 • MT-Hack
                </span>
              </div>
              <h2 className="text-sm font-extrabold tracking-tight">
                Экскурсия по ключевым возможностям решения
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
            }`}
            title="Закрыть экскурсию"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Navigation Pills */}
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between gap-1 overflow-x-auto shrink-0 ${
            isDarkMode ? "bg-[#151518] border-zinc-800" : "bg-zinc-50 border-zinc-100"
          }`}
        >
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStepIdx;
            const isCompleted = idx < currentStepIdx;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStepIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-[#D32F2F] text-white shadow-xs"
                    : isCompleted
                    ? isDarkMode
                      ? "bg-zinc-800 text-emerald-400 hover:bg-zinc-700"
                      : "bg-white text-emerald-700 border border-zinc-200 hover:bg-zinc-100"
                    : isDarkMode
                    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] font-mono flex items-center justify-center">
                    {step.id}
                  </span>
                )}
                <span>{step.badge.split("•")[1]?.trim() || `Шаг ${step.id}`}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Active Step Badge and Title */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono font-bold text-amber-500 uppercase tracking-wider">
                {currentStep.badge}
              </span>
              <span className="text-zinc-400">•</span>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                isDarkMode ? "bg-zinc-800 text-cyan-300" : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}>
                {currentStep.criterion}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight">
              {currentStep.title}
            </h3>
            <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isDarkMode ? "text-zinc-300" : "text-zinc-600"}`}>
              {currentStep.summary}
            </p>
          </div>

          {/* Key Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-1">
            {currentStep.points.map((pt, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl border flex flex-col justify-between shadow-xs transition-colors ${
                  isDarkMode
                    ? "bg-[#1f1f23] border-zinc-700/80 text-zinc-200"
                    : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D32F2F]" />
                    <h4 className="text-xs font-black tracking-tight uppercase">
                      {pt.title}
                    </h4>
                  </div>
                  <p className={`text-[11px] leading-relaxed font-medium ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-600"
                  }`}>
                    {pt.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Action Prompt Callout */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
              isDarkMode
                ? "bg-amber-950/20 border-amber-600/40 text-amber-200"
                : "bg-amber-50/80 border-amber-300 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Совет для проверки:</strong> {currentStep.actionPrompt}
              </span>
            </div>
          </div>

          {/* System Architecture Micro-Banner */}
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${
              isDarkMode ? "bg-[#121214] border-zinc-800 text-zinc-400" : "bg-zinc-100/70 border-zinc-200 text-zinc-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Архитектура: NDTP TCP :9201 ➔ Go Core :8080 ➔ CatBoost ML :8000 ➔ React :5173</span>
            </div>
            <span className="text-emerald-500 font-bold">100% готовность к защите</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isDarkMode ? "bg-[#121214] border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}
        >
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFirst
                ? "opacity-30 cursor-not-allowed text-zinc-400"
                : isDarkMode
                ? "hover:bg-zinc-800 text-zinc-300"
                : "hover:bg-zinc-200 text-zinc-700"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Назад</span>
          </button>

          {/* Step indicator dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStepIdx
                    ? "w-6 bg-[#D32F2F]"
                    : "w-1.5 bg-zinc-400/40"
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
              isLast
                ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-950/20"
                : "bg-[#D32F2F] hover:bg-[#b71c1c] text-white shadow-red-950/20"
            }`}
          >
            <span>{isLast ? "Понятно, начать работу" : "Далее"}</span>
            {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JuryGuideModal;
