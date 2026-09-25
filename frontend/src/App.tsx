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
      <main className="relative flex-1 w-full overflow-hidden">
        {/* Fullscreen Interactive Map with CartoDB Positron & Floating Widgets */}
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

        {/* Floating Side Panels Overlay (Glassmorphism & Cards) */}
        <div className="absolute inset-0 pointer-events-none flex justify-between z-10">
          {/* Left Column: Center of Incidents / Alert Radar */}
          <AlertRadar
            alerts={alerts}
            selectedAlertId={selectedAlertId}
            onSelectAlert={handleSelectAlert}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />

          {/* Right Column: Fleet Inspector & DSS Prescriptive Recommendations */}
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
