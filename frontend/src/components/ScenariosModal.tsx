import React, { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Cpu, X, Star } from "lucide-react";
import { AlertItem } from "../mock/telemetry";

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

export interface ScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScenario: (scenarioId: string, title: string) => void;
  alert?: AlertItem | null;
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
  alert,
  incidentId: defaultIncidentId = "#alert_1042",
  vehicleId: defaultVehicleId = "№1042",
  leaderId: defaultLeaderId = "№1043",
  intervalSec: defaultIntervalSec = 96,
  isDarkMode = false,
}) => {
  const [selectedId, setSelectedId] = useState<string>("recommended");
  const [sendToTerminal, setSendToTerminal] = useState<boolean>(true);

  const routeId = alert?.routeNumberBadge || alert?.routeId || "м3";
  const incidentId = alert?.id ? `#${alert.id}` : defaultIncidentId;
  const vehicleId = alert?.vehicleId ? `№${alert.vehicleId.replace(/^P/, "")}` : defaultVehicleId;
  const leaderId =
    alert?.recommendation?.targetVehicleId ||
    (alert?.followingVehicleId ? `№${alert.followingVehicleId.replace(/^P/, "")}` : defaultLeaderId);
  const intervalSec = alert?.metrics?.headway_collapse_sec ?? defaultIntervalSec;
  const effectPercent = alert?.recommendation?.effectPercent ?? 96;

  const isM7 = routeId.includes("7") || alert?.id === "alert_2198";
  const isT88 = routeId.includes("88") || alert?.id === "alert_0814";

  const modalTitle = isM7
    ? "Ситуационная матрица СППР: Ликвидация задержки м7"
    : isT88
    ? "Ситуационная матрица СППР: Устранение сжатия такта т88"
    : "Ситуационная матрица СППР: Ликвидация пачкования м3";

  const locationText = isM7
    ? "Узел Таганская пл. — Николоямская"
    : isT88
    ? "Перегон Старая Басманная → Лубянка"
    : "Перегон м. Бауманская";

  const intervalMin = (intervalSec / 60).toFixed(1);
  const metricText = isM7
    ? "Задержка: 9.0 мин (Затор)"
    : isT88
    ? "Сжатие: 1.5 мин (Светофорный цикл)"
    : `Интервал: ${intervalMin} мин (Норма: 8 мин)`;

  const targetDirectiveText = isM7
    ? `Автоматически передать директиву в АСУ-ДД ЦОДД на светофоры Т-12, Т-14`
    : `Автоматически передать директиву в АСУ-РДС на борт ${leaderId || vehicleId}`;

  const scenarios: ScenarioItem[] = useMemo(() => {
    if (isM7) {
      return [
        {
          id: "green_corridor",
          code: "GREEN-WAVE",
          title: "СЦЕНАРИЙ 1: ЗЕЛЁНЫЙ КОРИДОР ЦОДД",
          badge: `РЕКОМЕНДАЦИЯ ИИ • ЭФФЕКТ ${effectPercent}%`,
          effect: `${effectPercent}%`,
          command: "Активация фазы продления зелёного сигнала на светофорах Т-12 и Т-14 ул. Николоямская.",
          bullets: [
            "Ликвидация задержки на 8 мин за счет безостановочного проезда",
            "Приоритетный пропуск электробуса в потоке по выделенной полосе",
            "Минимальное влияние на поперечные направления трафика",
          ],
          stars: 5,
          tagline: "Наивысшая эффективность • Без задержек",
          btnLabel: "Применить зелёный коридор (ЦОДД Т-12)",
          theme: "emerald",
        },
        {
          id: "skip_stop",
          code: "SKIP-STOP",
          title: "СЦЕНАРИЙ 2: SKIP-STOP (Экспресс-пропуск)",
          badge: "АЛЬТЕРНАТИВА • ЭФФЕКТ 76%",
          effect: "76%",
          command: "Следование борта №2198 без промежуточной остановки «Доброслободская».",
          bullets: [
            "Нагон отставания на 4 мин",
            "Снижение задержки на последующих перегонах",
            "Альтернатива для пассажиров: следующий рейс через 5 мин",
          ],
          stars: 3,
          tagline: "Умеренный риск жалоб",
          btnLabel: "Применить Skip-Stop (1 ост)",
          theme: "amber",
        },
        {
          id: "short_turning",
          code: "SHORT-TURNING",
          title: "СЦЕНАРИЙ 3: ОПЕРАТИВНЫЙ РАЗВОРОТ",
          badge: "АЛЬТЕРНАТИВА • ЭФФЕКТ 65%",
          effect: "65%",
          command: "Разворот борта №2198 через Таганский тоннель для закрытия интервала в центр.",
          bullets: [
            "Закрытие встречной интервальной дыры (+10 мин)",
            "Высадка пассажиров на Таганской площади",
            "Высокая диспетчерская нагрузка",
          ],
          stars: 3,
          tagline: "Оперативное перестроение",
          btnLabel: "Применить оперативный разворот",
          theme: "blue",
        },
        {
          id: "depot_reserve",
          code: "DEPOT",
          title: "СЦЕНАРИЙ 4: ВВОД РЕЗЕРВА ИЗ ПАРКА",
          badge: "РЕЗЕРВ • ЭФФЕКТ 80%",
          effect: "80%",
          command: "Выпуск резервного электробуса из парка Новокосино на Нижегородскую ул.",
          bullets: [
            "Ввод на маршрут через 12 мин",
            "1 дополнительный машино-рейс",
            "Полное покрытие пассажиропотока без высадки",
          ],
          stars: 4,
          tagline: "Высокая надёжность",
          btnLabel: "Применить ввод резерва",
          theme: "slate",
        },
      ];
    }

    if (isT88) {
      return [
        {
          id: "skip_stop",
          code: "SKIP-STOP",
          title: "СЦЕНАРИЙ 1: SKIP-STOP (Экспресс-пропуск)",
          badge: `РЕКОМЕНДАЦИЯ ИИ • ЭФФЕКТ ${effectPercent}%`,
          effect: `${effectPercent}%`,
          command: "Пропуск остановки «Садовая-Черногрязская» без посадки для разрыва сжатия интервала.",
          bullets: [
            "Ликвидация сжатия до 5.5 мин",
            "Опережение узлового светофорного затора на Басманной",
            "Пассажиропоток на остановке низкий (офф-пик)",
          ],
          stars: 5,
          tagline: "Наивысшая эффективность • Быстрый эффект",
          btnLabel: "Применить Skip-Stop (№0814)",
          theme: "emerald",
        },
        {
          id: "pace_control",
          code: "PACE-CONTROL",
          title: "СЦЕНАРИЙ 2: РЕГУЛИРОВАНИЕ СКОРОСТИ",
          badge: "АЛЬТЕРНАТИВА • ЭФФЕКТ 84%",
          effect: "84%",
          command: "Директива в терминал №0814: снижение крейсерской скорости до 20 км/ч до Лубянки.",
          bullets: [
            "Плавное растягивание интервала без резких остановок",
            "Максимальный комфорт для пассажиров в салоне",
            "Без пропуска остановок",
          ],
          stars: 4,
          tagline: "Мягкое регулирование",
          btnLabel: "Установить лимит скорости",
          theme: "amber",
        },
        {
          id: "holding",
          code: "HOLDING",
          title: "СЦЕНАРИЙ 3: HOLDING ЛИДЕРА №0815",
          badge: "АЛЬТЕРНАТИВА • ЭФФЕКТ 72%",
          effect: "72%",
          command: "Кратковременная регулировочная задержка лидера №0815 на 60 сек.",
          bullets: [
            "Выравнивание шага движения на перегоне",
            "Незначительный сдвиг графика (+1 мин)",
            "Стандартная процедура регламента АСУ-РДС",
          ],
          stars: 3,
          tagline: "Классический Holding",
          btnLabel: "Применить Holding (60с)",
          theme: "blue",
        },
        {
          id: "depot_reserve",
          code: "DEPOT",
          title: "СЦЕНАРИЙ 4: ВВОД РЕЗЕРВА ИЗ ПАРКА",
          badge: "РЕЗЕРВ • ЭФФЕКТ 78%",
          effect: "78%",
          command: "Оперативный вывод резервного борта с к/ст Комсомольская на маршрут.",
          bullets: [
            "Ввод через 8 мин",
            "Ликвидация риска сбоя такта",
            "1 дополнительный машино-рейс",
          ],
          stars: 4,
          tagline: "Высокая надёжность",
          btnLabel: "Применить ввод резерва",
          theme: "slate",
        },
      ];
    }

    // Route м3 default
    return [
      {
        id: "holding",
        code: "HOLDING",
        title: "СЦЕНАРИЙ 1: HOLDING (Удержание лидера)",
        badge: `РЕКОМЕНДАЦИЯ ИИ • ЭФФЕКТ ${effectPercent}%`,
        effect: `${effectPercent}%`,
        command: "Придержать идущий следом лидер №1043 на остановке м. Бауманская на 2.5 мин.",
        bullets: [
          "Интервал: восстановится до 7.5 мин",
          "Экономия: 18 мин ожидания для 240 пассажиров",
          "Сдвиг графика: минимальный (+2.5 мин)",
        ],
        stars: 5,
        tagline: "Наивысшая эффективность • Мин. риски",
        btnLabel: "Применить выбранный сценарий (Holding 150с • 2.5 мин)",
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
  }, [isM7, isT88, effectPercent]);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(scenarios[0]?.id || "");
    }
  }, [isOpen, alert?.id, scenarios]);

  if (!isOpen) return null;

  const activeScenario =
    scenarios.find((s) => s.id === selectedId) || scenarios[0];

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
        <div
          className={`p-4 border-b flex items-start justify-between shrink-0 ${
            isDarkMode ? "border-white/10 bg-[#141416]" : "border-zinc-100 bg-zinc-50/70"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                isDarkMode ? "bg-[#222226] border-white/10 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"
              }`}
            >
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold tracking-tight uppercase ${isDarkMode ? "text-white" : "text-zinc-900"}`}>
                {modalTitle}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold border ${
                    isDarkMode ? "bg-rose-950/80 text-rose-300 border-rose-800" : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {incidentId}
                </span>
                <span>
                  Борт {vehicleId} → Лидер {leaderId}
                </span>
                <span>•</span>
                <span>{locationText}</span>
                <span>•</span>
                <span className="text-rose-400 font-bold">{metricText}</span>
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
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-4 overflow-y-auto max-h-[calc(85vh-140px)] ${
            isDarkMode ? "bg-[#141416]" : "bg-zinc-50/50"
          }`}
        >
          {scenarios.map((sc) => {
            const isSelected = sc.id === activeScenario.id;

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
                          ? isDarkMode
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : sc.theme === "amber"
                          ? isDarkMode
                            ? "bg-amber-950/80 text-amber-300 border-amber-800"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                          : isDarkMode
                          ? "bg-zinc-800 text-zinc-300 border-white/10"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200"
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

                  <p
                    className={`mt-2 text-xs leading-relaxed p-2 rounded border ${
                      isDarkMode ? "bg-[#141416] border-white/5 text-zinc-300" : "bg-zinc-50 border-zinc-100 text-zinc-700"
                    }`}
                  >
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

                <div
                  className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs ${
                    isDarkMode ? "border-white/5" : "border-zinc-100"
                  }`}
                >
                  <span className="text-[11px] font-medium text-zinc-400">{sc.tagline}</span>
                  <span className="font-mono font-bold text-emerald-400">Эффект: {sc.effect}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between shrink-0 ${
            isDarkMode ? "border-white/10 bg-[#141416]" : "border-zinc-100 bg-white"
          }`}
        >
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={sendToTerminal}
              onChange={(e) => setSendToTerminal(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500"
            />
            <span>{targetDirectiveText}</span>
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
