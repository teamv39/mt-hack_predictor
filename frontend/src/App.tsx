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

export default function App() {
  const [isScenariosOpen, setIsScenariosOpen] = useState(false);

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

  return (
    <div className="relative w-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans select-none">
      {/* 1. Top Navigation & Metrics Bar */}
      <TopBar
        metrics={metrics}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSimPlaying={isSimPlaying}
        simSpeed={simSpeed}
        onControl={controlSimulation}
      />

      {/* 2. Main Dashboard Workspace */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        {activeTab === "marey" ? (
          <MareyDiagram
            onApplyHolding={applyHolding}
            onOpenScenarios={() => setIsScenariosOpen(true)}
            isApplied={selectedAlert?.recommendation?.applied || false}
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
                onSelectVehicle={handleSelectVehicle}
                flyToTarget={flyToTarget}
                timeStep={timeStep}
                onTimeStepChange={(step) => controlSimulation("step", step)}
                camera={camera}
              />
            </div>

            {/* Floating Left Panel (Alert Radar) */}
            <div className="absolute top-4 bottom-8 left-4 z-10 pointer-events-none flex flex-col">
              <AlertRadar
                alerts={alerts}
                selectedAlertId={selectedAlertId}
                onSelectAlert={handleSelectAlert}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
              />
            </div>

            {/* Floating Right Panel (Inspector) */}
            <div className="absolute top-4 bottom-6 right-4 z-10 pointer-events-none flex flex-col">
              <Inspector
                vehicle={selectedVehicle}
                alert={selectedAlert}
                onApplyHolding={applyHolding}
                onOpenScenarios={() => setIsScenariosOpen(true)}
              />
            </div>
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
