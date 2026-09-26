import React, { useState } from "react";
import { Check, CheckCircle2, Cpu, X, Star, Shield, ArrowRight } from "lucide-react";

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
    badge: "РЕКОМЕНДАЦИЯ ИИ • ЭФФЕКТ 96%",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none font-sans"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl border shadow-xl rounded-xl overflow-hidden flex flex-col my-auto transition-colors ${
          isDarkMode
            ? "bg-[#18181b] border-white/10 text-zinc-200"
            : "bg-white border-zinc-200 text-zinc-800"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-start justify-between shrink-0 ${
          isDarkMode ? "border-white/10 bg-[#141416]" : "border-zinc-100 bg-zinc-50/70"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
              isDarkMode ? "bg-[#222226] border-white/10 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}>
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold tracking-tight uppercase ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                Ситуационная матрица СППР: Ликвидация пачкования м3
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                <span className={`px-1.5 py-0.5 rounded font-semibold border ${
                  isDarkMode ? "bg-rose-950/80 text-rose-300 border-rose-800" : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  {incidentId}
                </span>
                <span>
                  Борт {vehicleId} → Лидер {leaderId}
                </span>
                <span>•</span>
                <span>Перегон м. Бауманская</span>
                <span>•</span>
                <span className="text-rose-400 font-bold">
                  Интервал: {intervalMin} мин (Норма: 8 мин)
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDarkMode ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
            }`}
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 4 Tactical Strategies Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-4 overflow-y-auto max-h-[calc(85vh-140px)] ${
          isDarkMode ? "bg-[#141416]" : "bg-zinc-50/50"
        }`}>
          {SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedId;

            return (
              <div
                key={sc.id}
                onClick={() => setSelectedId(sc.id)}
                className={`rounded-lg p-3.5 cursor-pointer transition-all border flex flex-col justify-between ${
                  isSelected
                    ? isDarkMode
                      ? "border-zinc-400 bg-[#222226] shadow-md ring-1 ring-zinc-500/30"
                      : "border-zinc-500 bg-white shadow-md ring-1 ring-zinc-400/30"
                    : isDarkMode
                    ? "border-white/10 bg-[#18181b] hover:border-white/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        sc.theme === "emerald"
                          ? isDarkMode ? "bg-emerald-950/80 text-emerald-300 border-emerald-800" : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : sc.theme === "amber"
                          ? isDarkMode ? "bg-amber-950/80 text-amber-300 border-amber-800" : "bg-amber-50 text-amber-800 border-amber-200"
                          : sc.theme === "blue"
                          ? isDarkMode ? "bg-zinc-800 text-zinc-300 border-white/10" : "bg-zinc-100 text-zinc-800 border-zinc-200"
                          : isDarkMode ? "bg-zinc-800 text-zinc-300 border-white/10" : "bg-zinc-100 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      {sc.badge}
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: sc.stars }).map((_, i) => (
                        <Star key={i} size={11} className="text-amber-500 fill-amber-500" />
                      ))}
                    </div>
                  </div>

                  <h4 className={`text-xs font-bold font-mono tracking-tight ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                    {sc.title}
                  </h4>

                  <p className={`mt-2 text-xs leading-relaxed p-2 rounded border ${
                    isDarkMode ? "bg-[#141416] border-white/5 text-zinc-300" : "bg-zinc-50 border-zinc-100 text-zinc-700"
                  }`}>
                    {sc.command}
                  </p>

                  <ul className="mt-2.5 space-y-1 text-[11px] text-zinc-400">
                    {sc.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs ${
                  isDarkMode ? "border-white/5" : "border-zinc-100"
                }`}>
                  <span className="text-[11px] font-medium text-zinc-400">{sc.tagline}</span>
                  <span className="font-mono font-bold text-emerald-400">Эффект: {sc.effect}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
          isDarkMode ? "border-white/10 bg-[#141416]" : "border-zinc-100 bg-white"
        }`}>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={sendToTerminal}
              onChange={(e) => setSendToTerminal(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
            />
            <span>Автоматически передать директиву в АСУ-РДС на борт №1043</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                isDarkMode ? "border-white/10 hover:bg-white/5 text-zinc-300" : "border-zinc-200 hover:bg-zinc-50 text-zinc-700"
              }`}
            >
              Отмена
            </button>
            <button
              onClick={() => {
                onApplyScenario(activeScenario.id, activeScenario.title);
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={13} />
              <span>{activeScenario.btnLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
