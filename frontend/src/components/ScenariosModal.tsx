import React, { useState } from "react";
import { Check, CheckCircle2, Cpu, X, Star } from "lucide-react";

export interface ScenarioItem {
  id: string;
  code: string;
  title: string;
  badge: string;
  effect: string;
  command: string;
  bullets: string[];
  stars: number;
  tagline: string;
  btnLabel: string;
  theme: "emerald" | "amber" | "blue" | "slate";
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: "holding",
    code: "HOLDING",
    title: "СЦЕНАРИЙ 1: HOLDING (Удержание лидера)",
    badge: "★ РЕКОМЕНДАЦИЯ ИИ • ЭФФЕКТ 96%",
    effect: "96%",
    command: "Придержать идущий следом лидер №1043 на остановке м. Бауманская на 2.5 мин.",
    bullets: [
      "Интервал: восстановится до 7.5 мин",
      "Экономия: 18 мин ожидания для 240 пассажиров",
      "Сдвиг графика: минимальный (+2.5 мин)",
    ],
    stars: 5,
    tagline: "Наивысшая эффективность • Мин. риски",
    btnLabel: "Применить выбранный сценарий (Holding 90с)",
    theme: "emerald",
  },
  {
    id: "skip_stop",
    code: "SKIP-STOP",
    title: "СЦЕНАРИЙ 2: SKIP-STOP (Экспресс-пропуск)",
    badge: "АЛЬТЕРНАТИВА • ЭФФЕКТ 74%",
    effect: "74%",
    command: "Направить борт №1042 в экспресс-режим без посадки на 2 остановках.",
    bullets: [
      "Сократит отставание на 4.5 мин",
      "Пассажиры на пропущенных остановках ждут +6 мин",
      "Риск жалоб пассажиров: средний",
    ],
    stars: 3,
    tagline: "Компромиссное решение",
    btnLabel: "Применить выбранный сценарий (Skip-stop 2 ост)",
    theme: "amber",
  },
  {
    id: "short_turning",
    code: "SHORT-TURNING",
    title: "СЦЕНАРИЙ 3: SHORT-TURNING (Укорачивание рейса)",
    badge: "АЛЬТЕРНАТИВА • ЭФФЕКТ 68%",
    effect: "68%",
    command: "Разворот борта №1042 на пл. Разгуляй для закрытия «интервальной дыры» встречного потока.",
    bullets: [
      "Стабилизирует встречное направление (+12 мин)",
      "Вынужденная высадка 45 пассажиров в салоне",
      "Трудоёмкость диспетчеризации: высокая",
    ],
    stars: 3,
    tagline: "Оперативное перестроение",
    btnLabel: "Применить выбранный сценарий (Short-turning)",
    theme: "blue",
  },
  {
    id: "depot_reserve",
    code: "DEPOT",
    title: "СЦЕНАРИЙ 4: ВВОД РЕЗЕРВА ИЗ ПАРКА",
    badge: "РЕЗЕРВ • ЭФФЕКТ 82%",
    effect: "82%",
    command: "Выпуск электробуса №3105 из парка Сокольники на остановку Электрозаводская.",
    bullets: [
      "Ввод в строй через 14 мин",
      "Дополнительные затраты: 1 машино-рейс",
      "Полное восстановление такта без высадки",
    ],
    stars: 4,
    tagline: "Высокая надёжность",
    btnLabel: "Применить выбранный сценарий (Ввод резерва)",
    theme: "slate",
  },
];

interface ScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScenario: (scenarioId: string, title: string) => void;
  incidentId?: string;
  vehicleId?: string;
  leaderId?: string;
  intervalSec?: number;
  isDarkMode?: boolean;
}

export const ScenariosModal: React.FC<ScenariosModalProps> = ({
  isOpen,
  onClose,
  onApplyScenario,
  incidentId = "#1042-м3",
  vehicleId = "№1042",
  leaderId = "№1043",
  intervalSec = 96,
  isDarkMode = false,
}) => {
  const [selectedId, setSelectedId] = useState<string>("holding");
  const [sendToTerminal, setSendToTerminal] = useState<boolean>(true);

  if (!isOpen) return null;

  const activeScenario = SCENARIOS.find((s) => s.id === selectedId) || SCENARIOS[0];
  const intervalMin = (intervalSec / 60).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-4xl border shadow-2xl rounded-2xl overflow-hidden font-sans flex flex-col my-auto transition-colors ${
          isDarkMode
            ? "bg-[#151D2A] border-slate-700 text-slate-200 shadow-black/60"
            : "bg-white border-slate-200/90 text-slate-800 shadow-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-6 pb-4 flex items-start justify-between border-b shrink-0 ${
          isDarkMode ? "border-slate-800 bg-[#111827]" : "border-slate-100 bg-white"
        }`}>
          <div className="flex items-start space-x-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs border ${
              isDarkMode ? "bg-blue-950/60 border-blue-700 text-cyan-400" : "bg-blue-50 border-blue-200 text-blue-600"
            }`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-lg font-bold tracking-tight leading-snug ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                СИТУАЦИОННАЯ МАТРИЦА СППР: ЛИКВИДАЦИЯ ПАЧКОВАНИЯ М3
              </h3>
              <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <span className={`px-2 py-0.5 rounded font-semibold border ${
                  isDarkMode ? "bg-rose-950/80 text-rose-300 border-rose-700" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {incidentId}
                </span>
                <span className={`font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  Борт {vehicleId} ➔ Лидер {leaderId}
                </span>
                <span className="text-slate-500">•</span>
                <span>Перегон м. Бауманская</span>
                <span className="text-slate-500">•</span>
                <span className={`font-bold px-1.5 py-0.5 rounded ${
                  isDarkMode ? "bg-rose-950/60 text-rose-300 border border-rose-800" : "text-red-600 bg-red-50/60"
                }`}>
                  Интервал: {intervalMin} мин (Норма: 8 мин)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isDarkMode ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            }`}
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 4 Tactical Strategies Grid */}
        <div className={`grid grid-cols-2 gap-4 p-6 pt-4 overflow-y-auto max-h-[calc(85vh-160px)] ${
          isDarkMode ? "bg-[#0B0F17]" : "bg-slate-50/60"
        }`}>
          {SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedId;
            let borderClass = isDarkMode
              ? "border-slate-700/80 hover:border-slate-600"
              : "border-slate-200 hover:border-slate-300 hover:shadow-xs";
            let bgClass = isDarkMode ? "bg-[#111827]" : "bg-white";

            if (isSelected) {
              if (sc.theme === "emerald") {
                borderClass = "border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10";
              } else if (sc.theme === "amber") {
                borderClass = "border-2 border-amber-500 shadow-md ring-4 ring-amber-500/10";
              } else if (sc.theme === "blue") {
                borderClass = "border-2 border-blue-500 shadow-md ring-4 ring-blue-500/10";
              } else {
                borderClass = isDarkMode
                  ? "border-2 border-slate-500 shadow-md ring-4 ring-slate-400/10"
                  : "border-2 border-slate-700 shadow-md ring-4 ring-slate-500/10";
              }
            }

            return (
              <div
                key={sc.id}
                onClick={() => setSelectedId(sc.id)}
                className={`relative rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between ${bgClass} ${borderClass}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        sc.theme === "emerald"
                          ? isDarkMode ? "bg-emerald-950/80 text-emerald-300 border-emerald-700" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : sc.theme === "amber"
                          ? isDarkMode ? "bg-amber-950/80 text-amber-300 border-amber-700" : "bg-amber-50 text-amber-800 border-amber-200"
                          : sc.theme === "blue"
                          ? isDarkMode ? "bg-blue-950/80 text-blue-300 border-blue-700" : "bg-blue-50 text-blue-800 border-blue-200"
                          : isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {sc.badge}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? sc.theme === "emerald"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : sc.theme === "amber"
                            ? "bg-amber-600 text-white shadow-xs"
                            : sc.theme === "blue"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-700 text-white shadow-xs"
                          : isDarkMode ? "border-2 border-slate-600" : "border-2 border-slate-300"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  </div>

                  <h4 className={`mt-3 text-sm font-bold font-mono tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {sc.title}
                  </h4>

                  <div
                    className={`mt-2.5 text-xs leading-relaxed font-medium p-2.5 rounded-lg border ${
                      sc.theme === "emerald"
                        ? isDarkMode
                          ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-200"
                          : "bg-emerald-50/70 border-emerald-200/60 text-slate-700"
                        : isDarkMode
                        ? "bg-[#0B0F17] border-slate-800 text-slate-300"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span
                      className={`font-bold ${
                        sc.theme === "emerald"
                          ? isDarkMode ? "text-emerald-300" : "text-emerald-900"
                          : isDarkMode ? "text-white" : "text-slate-800"
                      }`}
                    >
                      Команда:
                    </span>{" "}
                    {sc.command}
                  </div>

                  <div className={`mt-3 space-y-1.5 text-xs font-sans ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    {sc.bullets.map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            sc.theme === "emerald"
                              ? "bg-emerald-500"
                              : sc.theme === "amber"
                              ? "bg-amber-500"
                              : sc.theme === "blue"
                              ? "bg-blue-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                  isDarkMode ? "border-slate-800" : "border-slate-100"
                }`}>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Star
                        key={st}
                        className={`w-3.5 h-3.5 ${
                          st <= sc.stars
                            ? "fill-amber-400 text-amber-400"
                            : isDarkMode ? "text-slate-700 fill-slate-800" : "text-slate-200 fill-slate-100"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      sc.theme === "emerald"
                        ? isDarkMode ? "text-emerald-300" : "text-emerald-800"
                        : sc.theme === "amber"
                        ? isDarkMode ? "text-amber-300" : "text-amber-700"
                        : sc.theme === "blue"
                        ? isDarkMode ? "text-blue-300" : "text-blue-700"
                        : isDarkMode ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {sc.tagline}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 shadow-xs gap-4 ${
          isDarkMode ? "bg-[#111827] border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
        }`}>
          <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendToTerminal}
              onChange={(e) => setSendToTerminal(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <span className={`font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              Автоматически передать команду водителю в терминал ЕГПТС и на табло остановок
            </span>
          </label>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isDarkMode
                  ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Отмена / Вернуться к карте
            </button>
            <button
              onClick={() => {
                onApplyScenario(activeScenario.id, activeScenario.title);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00965E] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{activeScenario.btnLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
