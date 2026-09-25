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
}

export const ScenariosModal: React.FC<ScenariosModalProps> = ({
  isOpen,
  onClose,
  onApplyScenario,
  incidentId = "#1042-м3",
  vehicleId = "№1042",
  leaderId = "№1043",
  intervalSec = 96,
}) => {
  const [selectedId, setSelectedId] = useState<string>("holding");
  const [sendToTerminal, setSendToTerminal] = useState<boolean>(true);

  if (!isOpen) return null;

  const activeScenario = SCENARIOS.find((s) => s.id === selectedId) || SCENARIOS[0];
  const intervalMin = (intervalSec / 60).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden font-sans flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                СИТУАЦИОННАЯ МАТРИЦА СППР: ЛИКВИДАЦИЯ ПАЧКОВАНИЯ М3
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold border border-red-200">
                  {incidentId}
                </span>
                <span className="font-medium text-slate-700">
                  Борт {vehicleId} ➔ Лидер {leaderId}
                </span>
                <span className="text-slate-300">•</span>
                <span>Перегон м. Бауманская</span>
                <span className="text-slate-300">•</span>
                <span className="text-red-600 font-bold bg-red-50/60 px-1.5 py-0.5 rounded">
                  Интервал: {intervalMin} мин (Норма: 8 мин)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 4 Tactical Strategies Grid */}
        <div className="grid grid-cols-2 gap-4 p-6 pt-4 bg-slate-50/60 overflow-y-auto max-h-[calc(85vh-160px)]">
          {SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedId;
            let borderClass = "border-slate-200 hover:border-slate-300 hover:shadow-xs";
            let bgClass = "bg-white";

            if (isSelected) {
              if (sc.theme === "emerald") {
                borderClass = "border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10";
              } else if (sc.theme === "amber") {
                borderClass = "border-2 border-amber-500 shadow-md ring-4 ring-amber-500/10";
              } else if (sc.theme === "blue") {
                borderClass = "border-2 border-blue-500 shadow-md ring-4 ring-blue-500/10";
              } else {
                borderClass = "border-2 border-slate-700 shadow-md ring-4 ring-slate-500/10";
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
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : sc.theme === "amber"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : sc.theme === "blue"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
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
                          : "border-2 border-slate-300"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  </div>

                  <h4 className="mt-3 text-sm font-bold text-slate-900 font-mono tracking-tight">
                    {sc.title}
                  </h4>

                  <div
                    className={`mt-2.5 text-xs text-slate-700 leading-relaxed font-medium p-2.5 rounded-lg border ${
                      sc.theme === "emerald"
                        ? "bg-emerald-50/70 border-emerald-200/60"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <span
                      className={`font-bold ${
                        sc.theme === "emerald" ? "text-emerald-900" : "text-slate-800"
                      }`}
                    >
                      Команда:
                    </span>{" "}
                    {sc.command}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 font-sans">
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

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Star
                        key={st}
                        className={`w-3.5 h-3.5 ${
                          st <= sc.stars
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200 fill-slate-100"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      sc.theme === "emerald"
                        ? "text-emerald-800"
                        : sc.theme === "amber"
                        ? "text-amber-700"
                        : sc.theme === "blue"
                        ? "text-blue-700"
                        : "text-slate-600"
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
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 shadow-xs gap-4">
          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendToTerminal}
              onChange={(e) => setSendToTerminal(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="font-medium text-slate-700">
              Автоматически передать команду водителю в терминал ЕГПТС и на табло остановок
            </span>
          </label>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
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
