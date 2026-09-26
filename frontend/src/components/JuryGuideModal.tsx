import React, { useState } from "react";
import {
  X,
  Compass,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
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
        desc: "Переключайте бегунок снизу: «Сейчас» → «+15м (ML)» → «+30м» → «+45м». На T+15 мин наглядно виден очаг пачкования на перегоне Бауманская → Бакунинская.",
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
        desc: "В правой панели «Инспектор» рассчитывается точный вклад факторов: затор на Бакунинской (+2.3 мин, 46%), посадка в непогоду (+1.1 мин, 28%), светофор ТТК (+0.8 мин, 16%).",
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
        desc: "Кнопка «Матрица альтернативных сценариев» открывает 4 тактические стратегии: Holding, экспресс-пропуск, укорачивание рейса, ввод резерва.",
      },
    ],
    actionPrompt: "Нажмите зелёную кнопку «Применить Holding» в Инспекторе",
    tabTarget: "hall",
  },
  {
    id: 4,
    badge: "Шаг 4 • График движения Марея",
    criterion: "Критерий 2 (Глубина визуализации)",
    title: "Диаграмма Марея для магистрали м3",
    summary:
      "Классический железнодорожный и трамвайно-автобусный график движения в осях «Время — Дистанция».",
    points: [
      {
        title: "Пространство — Время",
        desc: "По вертикали — остановочные пункты от м. Семёновская до Лужников (18.4 км). По горизонтали — астрономическое время.",
      },
      {
        title: "Визуальный сбой траекторий",
        desc: "Траектория борта #1042 настигает борт #1043 (красная линия). Видно пересечение ниток (пачкование).",
      },
      {
        title: "Проекция упреждения",
        desc: "После нажатия «Применить Holding» горизонтальная площадка удержания 2.5 мин сдвигает нитку графика и восстанавливает такт 8 минут.",
      },
    ],
    actionPrompt: "Переключите вкладку в шапке на «График Марея (м3)»",
    tabTarget: "marey",
  },
  {
    id: 5,
    badge: "Шаг 5 • Борт ТС",
    criterion: "Критерий 3 (АСУ-РДС интеграция)",
    title: "Интерфейс бортового компьютера водителя",
    summary:
      "Прямая передача управляющей директивы из СППР диспетчера в кабину электробуса ЛиАЗ-6274.",
    points: [
      {
        title: "Таймер технологической выдержки",
        desc: "Крупный обратный отсчёт оставшегося времени стоянки (02:09) с визуальной шкалой заполнения такта.",
      },
      {
        title: "АСМПП и автоинформатор",
        desc: "Мониторинг занятости салона (48/85 пасс.) и автоматическое голосовое оповещение пассажиров в салоне.",
      },
      {
        title: "Квитирование команды",
        desc: "Водитель нажимает «Подтвердить прием и выполнение директивы» — статус исполнения мгновенно возвращается на пульт диспетчера.",
      },
    ],
    actionPrompt: "Переключите вкладку на «Терминал борта»",
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
        className={`w-full max-w-3xl rounded-xl border shadow-xl overflow-hidden flex flex-col transition-all max-h-[90vh] ${
          isDarkMode
            ? "bg-[#18181b] border-white/10 text-zinc-100 shadow-black/80"
            : "bg-white border-zinc-200 text-zinc-900 shadow-zinc-900/15"
        }`}
        data-purpose="jury-guide-modal"
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 text-zinc-200 flex items-center justify-center shadow-xs">
              <Compass className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-200">
                  Инструкция для экспертов и жюри
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                  isDarkMode ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
                }`}>
                  Трек №3 • MT-Hack
                </span>
              </div>
              <h2 className="text-xs font-semibold tracking-tight text-zinc-400">
                Экскурсия по ключевым возможностям решения
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDarkMode
                ? "hover:bg-white/10 text-zinc-400 hover:text-white"
                : "hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900"
            }`}
            title="Закрыть экскурсию"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Navigation Pills */}
        <div
          className={`px-4 py-2 border-b flex items-center justify-between gap-1 overflow-x-auto shrink-0 ${
            isDarkMode ? "bg-[#18181b] border-white/10" : "bg-zinc-100/70 border-zinc-200"
          }`}
        >
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStepIdx;
            const isCompleted = idx < currentStepIdx;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStepIdx(idx)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isActive
                    ? isDarkMode
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                    : isCompleted
                    ? "text-emerald-500 hover:bg-white/5"
                    : isDarkMode
                    ? "text-zinc-400 hover:text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <span className={`w-4 h-4 rounded-full text-[10px] font-mono flex items-center justify-center ${
                    isActive ? "bg-zinc-700 text-white" : "bg-zinc-300 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-400"
                  }`}>
                    {step.id}
                  </span>
                )}
                <span>{step.badge.split("•")[1]?.trim() || `Шаг ${step.id}`}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                {currentStep.badge}
              </span>
              <span className="text-zinc-400">•</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isDarkMode ? "bg-zinc-800 text-zinc-300 border-white/5" : "bg-zinc-100 text-zinc-700 border-zinc-200"
              }`}>
                {currentStep.criterion}
              </span>
            </div>
            <h3 className="text-base font-bold tracking-tight">
              {currentStep.title}
            </h3>
            <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? "text-zinc-300" : "text-zinc-600"}`}>
              {currentStep.summary}
            </p>
          </div>

          {/* Key Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 my-1">
            {currentStep.points.map((pt, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border flex flex-col justify-between transition-colors ${
                  isDarkMode
                    ? "bg-[#222226] border-white/5 text-zinc-200"
                    : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <h4 className="text-[11px] font-bold tracking-tight uppercase">
                      {pt.title}
                    </h4>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${
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
            className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs font-medium ${
              isDarkMode
                ? "bg-amber-950/20 border-amber-800/40 text-amber-300"
                : "bg-amber-50/70 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{currentStep.actionPrompt}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between shrink-0 ${
            isDarkMode ? "bg-[#141416] border-white/10" : "bg-zinc-50 border-zinc-200"
          }`}
        >
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              isFirst
                ? "opacity-40 cursor-not-allowed border-transparent text-zinc-500"
                : isDarkMode
                ? "border-white/10 hover:bg-white/5 text-zinc-300"
                : "border-zinc-300 hover:bg-white text-zinc-700"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Назад</span>
          </button>

          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStepIdx
                    ? "w-5 bg-zinc-400"
                    : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isLast ? "Понятно, начать" : "Далее"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
