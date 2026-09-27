import React, { useState, useMemo, useEffect } from "react";
import { useTelemetry } from "./hooks/useTelemetry";
import { TopBar } from "./components/TopBar";
import { AlertRadar } from "./components/AlertRadar";
import { MapView } from "./components/MapView";
import { Inspector } from "./components/Inspector";
import { ToastContainer } from "./components/Toast";
import { ScenariosModal } from "./components/ScenariosModal";
import { MareyDiagram } from "./components/MareyDiagram";
import { DriverTerminal } from "./components/DriverTerminal";
import { JuryGuideModal } from "./components/JuryGuideModal";
import { SlidersHorizontal } from "lucide-react";
import { loadPreferences, savePreferences } from "./utils/storage";
import type { AlertItem } from "./mock/telemetry";

export default function App() {
  const initialPrefs = useMemo(() => loadPreferences(), []);
  const [isScenariosOpen, setIsScenariosOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(!initialPrefs.hasCompletedGuide);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(initialPrefs.theme === "dark");
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(initialPrefs.isInspectorOpen);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const {
    vehicles,
    alerts,
    appliedHoldingIds,
    selectedAlert,
    selectedVehicle,
    selectedAlertId,
    selectedVehicleId,
    metrics,
    allRoutes,
    dataMode,
    setDataMode,
    datasetLoadError,
    camera,
    timeStep,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeTab,
    setActiveTab,
    isSimPlaying,
    simSpeed,
    flyToTarget,
    toasts,
    removeToast,
    dismissAlert,
    handleSelectAlert,
    handleSelectVehicle,
    applyHolding,
    applyScenario,
    controlSimulation,
  } = useTelemetry();

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      savePreferences({ theme: next ? "dark" : "light" });
      return next;
    });
  };

  const handleSetInspectorOpen = (open: boolean) => {
    setIsInspectorOpen(open);
    savePreferences({ isInspectorOpen: open });
  };

  const handleAlertClick = (alert: AlertItem) => {
    handleSelectAlert(alert);
    handleSetInspectorOpen(true);
  };

  const handleVehicleClick = (id: string) => {
    handleSelectVehicle(id);
    handleSetInspectorOpen(true);
  };

  return (
    <div
      className={`relative w-screen h-screen flex flex-col overflow-hidden font-sans select-none transition-colors duration-200 ${
        isDarkMode ? "dark bg-[#121214] text-zinc-100" : "bg-[#f4f4f5] text-zinc-900"
      }`}
    >
      {/* 1. Top Navigation & System Status Bar */}
      <TopBar
        metrics={metrics}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSimPlaying={isSimPlaying}
        simSpeed={simSpeed}
        onControl={controlSimulation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenGuide={() => setIsGuideOpen(true)}
        dataMode={dataMode}
        onDataModeChange={setDataMode}
      />

      {/* 2. Main Dashboard Workspace */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        {activeTab === "marey" ? (
          <MareyDiagram
            selectedRouteId={selectedAlert?.routeNumberBadge || "м3"}
            onApplyHolding={(alertId) => applyHolding(alertId || selectedAlertId || "alert_1042")}
            onOpenScenarios={() => setIsScenariosOpen(true)}
            appliedHoldingIds={appliedHoldingIds}
            isDarkMode={isDarkMode}
          />
        ) : activeTab === "terminal" ? (
          <DriverTerminal
            vehicleId={selectedVehicle?.id ? selectedVehicle.id.replace(/^P/, "") : "1043"}
            routeNumber={selectedVehicle?.routeId || "м3"}
            isHoldingActive={selectedAlert?.recommendation?.applied ?? true}
            onAcknowledge={() => {
              if (selectedAlertId) applyHolding(selectedAlertId);
            }}
            isDarkMode={isDarkMode}
          />
        ) : (
          <>
            {/* Fullscreen Interactive Map */}
            <div className="absolute inset-0 w-full h-full z-0">
              <MapView
                routes={allRoutes}
                vehicles={vehicles}
                dataMode={dataMode}
                datasetLoadError={datasetLoadError}
                alert={selectedAlert}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={handleVehicleClick}
                flyToTarget={flyToTarget}
                timeStep={timeStep}
                onTimeStepChange={(step) => controlSimulation("step", step)}
                camera={camera}
                isDarkMode={isDarkMode}
              />
            </div>

            {/* Floating Left Panel (Alert Radar) */}
            <div className="absolute top-4 bottom-4 left-4 z-10 pointer-events-none flex flex-col">
              <AlertRadar
                alerts={alerts}
                selectedAlertId={selectedAlertId}
                onSelectAlert={handleAlertClick}
                onDismissAlert={dismissAlert}
                appliedHoldingIds={appliedHoldingIds}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                isDarkMode={isDarkMode}
              />
            </div>

            {/* Floating Right Panel (Inspector) */}
            {isInspectorOpen ? (
              <div className="absolute top-4 bottom-4 right-4 z-10 pointer-events-none flex flex-col animate-fade-in">
                <Inspector
                  vehicle={selectedVehicle}
                  alert={selectedAlert}
                  appliedHoldingIds={appliedHoldingIds}
                  onApplyHolding={applyHolding}
                  onOpenScenarios={() => setIsScenariosOpen(true)}
                  onClose={() => handleSetInspectorOpen(false)}
                  isDarkMode={isDarkMode}
                />
              </div>
            ) : (
              /* Collapsed Inspector Button */
              <div className="absolute top-4 right-4 z-10 pointer-events-auto">
                <button
                  onClick={() => handleSetInspectorOpen(true)}
                  className={`px-3 py-1.5 rounded-lg border shadow-md flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer backdrop-blur-md ${
                    isDarkMode
                      ? "bg-[#18181b]/95 hover:bg-[#27272a] border-white/10 text-zinc-200"
                      : "bg-white/95 hover:bg-zinc-50 border-zinc-200 text-zinc-800 shadow-xs"
                  }`}
                  title="Открыть инспектор СППР"
                >
                  <SlidersHorizontal size={14} className="text-zinc-400" />
                  <span>Инспектор СППР</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 3. Tactical Scenarios Modal (Stitch DSS Matrix) */}
      <ScenariosModal
        isOpen={isScenariosOpen}
        onClose={() => setIsScenariosOpen(false)}
        onApplyScenario={(id, title) => applyScenario(id, title)}
        alert={selectedAlert}
        isDarkMode={isDarkMode}
      />

      {/* 4. Jury Guide / Tour Modal */}
      <JuryGuideModal
        isOpen={isGuideOpen}
        onClose={() => {
          setIsGuideOpen(false);
          savePreferences({ hasCompletedGuide: true });
        }}
        isDarkMode={isDarkMode}
      />

      {/* 5. Toast Notifications for Dispatcher Feedback */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
