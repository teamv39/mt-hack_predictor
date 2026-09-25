import React, { useState } from "react";
import { useTelemetry } from "./hooks/useTelemetry";
import { TopBar } from "./components/TopBar";
import { MapView } from "./components/MapView";
import { AlertRadar } from "./components/AlertRadar";
import { Inspector } from "./components/Inspector";

export default function App() {
  const {
    vehicles,
    alert,
    status,
    route,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    applyHolding,
    controlSimulation,
  } = useTelemetry();

  const [flyToTarget, setFlyToTarget] = useState(null);

  const handleSelectAlert = (activeAlert) => {
    // Fly to Baumanskaya problem zone
    setFlyToTarget({ lat: 55.7724, lon: 37.6791 });
    if (activeAlert.vehicle_id) {
      setSelectedVehicleId(activeAlert.vehicle_id);
    }
  };

  return (
    <div className="app-container">
      {/* Background 100% Map */}
      <MapView
        route={route}
        vehicles={vehicles}
        alert={alert}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={setSelectedVehicleId}
        flyToTarget={flyToTarget}
      />

      {/* Floating Glassmorphism Cockpit UI */}
      <div className="ui-overlay">
        {/* TopBar with Metrics & Simulation Toggles */}
        <TopBar status={status} onControl={controlSimulation} />

        {/* Workspace Panels */}
        <div className="dashboard-body">
          {/* Left Panel: Predictive Alert Radar */}
          <AlertRadar alert={alert} onSelectAlert={handleSelectAlert} />

          {/* Right Panel: Incident Inspector */}
          <Inspector
            vehicle={selectedVehicle}
            alert={alert}
            onApplyHolding={applyHolding}
          />
        </div>
      </div>
    </div>
  );
}
