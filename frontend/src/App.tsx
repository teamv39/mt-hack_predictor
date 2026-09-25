import React, { useState } from "react";
import { useTelemetry } from "./hooks/useTelemetry";
import { TopBar } from "./components/TopBar";
import { AlertRadar } from "./components/AlertRadar";
import { MapView } from "./components/MapView";
import { Inspector } from "./components/Inspector";
import { ToastContainer } from "./components/Toast";
import { ScenariosModal } from "./components/ScenariosModal";
import { MareyDiagram } from "./components/MareyDiagram";
import { DriverTerminal } from "./components/DriverTerminal";
import { SlidersHorizontal } from "lucide-react";

export default function App() {
  const [isScenariosOpen, setIsScenariosOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const {
    vehicles,
    alerts,
    selectedAlert,
    selectedVehicle,
    selectedAlertId,
    selectedVehicleId,
    metrics,
    route,
    camera,
    timeStep,
    setTimeStep,
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
    handleSelectAlert,
    handleSelectVehicle,
    applyHolding,
    applyScenario,
    controlSimulation,
  } = useTelemetry();

  const handleAlertClick = (alert: any) => {
    handleSelectAlert(alert);
    setIsInspectorOpen(true);
  };

  const handleVehicleClick = (id: string) => {
    handleSelectVehicle(id);
    setIsInspectorOpen(true);
  };

  return (
    <div
      className={`relative w-screen h-screen flex flex-col overflow-hidden font-sans select-none transition-colors duration-200 ${
        isDarkMode ? "bg-[#0B0F17] text-slate-100" : "bg-slate-100 text-slate-900"
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
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />

      {/* 2. Main Dashboard Workspace */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        {activeTab === "marey" ? (
          <MareyDiagram
            onApplyHolding={() => applyHolding(selectedAlertId || "alert_1042")}
            onOpenScenarios={() => setIsScenariosOpen(true)}
            isApplied={selectedAlert?.recommendation?.applied || false}
            isDarkMode={isDarkMode}
          />
        ) : activeTab === "terminal" ? (
          <DriverTerminal
            vehicleId="1043"
            routeNumber="м3"
            isHoldingActive={true}
            onAcknowledge={() => {
              applyHolding("alert_1042");
            }}
          />
        ) : (
          <>
            {/* Fullscreen Interactive Map */}
            <div className="absolute inset-0 w-full h-full z-0">
              <MapView
                route={route}
                vehicles={vehicles}
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
            <div className="absolute top-5 bottom-5 left-5 z-10 pointer-events-none flex flex-col">
              <AlertRadar
                alerts={alerts}
                selectedAlertId={selectedAlertId}
                onSelectAlert={handleAlertClick}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                isDarkMode={isDarkMode}
              />
            </div>

            {/* Floating Right Panel (Inspector) */}
            {isInspectorOpen ? (
              <div className="absolute top-5 bottom-5 right-5 z-10 pointer-events-none flex flex-col animate-in fade-in slide-in-from-right-4 duration-200">
                <Inspector
                  vehicle={selectedVehicle}
                  alert={selectedAlert}
                  onApplyHolding={applyHolding}
                  onOpenScenarios={() => setIsScenariosOpen(true)}
                  onClose={() => setIsInspectorOpen(false)}
                  isDarkMode={isDarkMode}
                />
              </div>
            ) : (
              /* Collapsed Inspector Button */
              <div className="absolute top-5 right-5 z-10 pointer-events-auto">
                <button
                  onClick={() => setIsInspectorOpen(true)}
                  className={`px-3.5 py-2 rounded-xl border shadow-lg flex items-center gap-2 text-xs font-bold transition-all cursor-pointer backdrop-blur-md ${
                    isDarkMode
                      ? "bg-[#151D2A]/90 hover:bg-[#1C2637] border-slate-700/80 text-cyan-300"
                      : "bg-white/95 hover:bg-slate-50 border-slate-200 text-slate-800 shadow-slate-900/10"
                  }`}
                  title="Открыть инспектор СППР"
                >
                  <SlidersHorizontal size={15} />
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
        incidentId={selectedAlert?.id ? `#${selectedAlert.id}` : "#1042-м3"}
        vehicleId={selectedVehicle?.id ? `№${selectedVehicle.id.replace("P", "")}` : "№1042"}
        leaderId="№1043"
        intervalSec={selectedAlert?.metrics?.headway_collapse_sec || 96}
      />

      {/* 4. Toast Notifications for Dispatcher Feedback */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
