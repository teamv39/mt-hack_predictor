import React from "react";
import { useTelemetry } from "./hooks/useTelemetry";
import { TopBar } from "./components/TopBar";
import { AlertRadar } from "./components/AlertRadar";
import { MapView } from "./components/MapView";
import { Inspector } from "./components/Inspector";
import { ToastContainer } from "./components/Toast";

export default function App() {
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
        <div className="absolute top-4 bottom-[260px] left-4 z-10 pointer-events-none flex flex-col">
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
          />
        </div>
      </main>

      {/* 3. Toast Notifications for Dispatcher Feedback */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
