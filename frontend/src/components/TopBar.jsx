import React from "react";
import { Play, Pause, FastForward, RotateCcw, Activity } from "lucide-react";

export function TopBar({ status, onControl }) {
  const isPlaying = status.live_simulation_active;
  const speed = status.simulation_speed || 1.0;

  return (
    <div className="topbar glass-panel">
      {/* Brand Section */}
      <div className="brand-section">
        <div className="logo-badge">MT-DSS</div>
        <div className="title-group">
          <h1>МОСКОВСКИЙ ТРАНСПОРТ</h1>
          <span>Ситуационный предиктор сбоев & интервалов</span>
        </div>
      </div>

      {/* Real-time System Metrics */}
      <div className="metrics-strip">
        <div className="metric-pill">
          <span className="metric-label">Пунктуальность</span>
          <span className="metric-value emerald">
            {status.punctuality_rate?.toFixed(1) || "94.8"}%
          </span>
        </div>

        <div className="metric-pill">
          <span className="metric-label">Риски пачкования</span>
          <span className={`metric-value ${status.active_alerts_count > 0 ? "red" : "emerald"}`}>
            {status.active_alerts_count}
          </span>
        </div>

        <div className="metric-pill">
          <span className="metric-label">Сбоев предотвращено</span>
          <span className="metric-value emerald">
            {status.prevented_incidents_count || 19}
          </span>
        </div>

        <div className="live-indicator">
          <div className="pulse-dot"></div>
          <span>LIVE SIMULATION (Go Core: {status.engine_latency_ms?.toFixed(1) || "3.2"}ms)</span>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="controls-section">
        <button
          className="btn-ctrl"
          onClick={() => onControl(isPlaying ? "pause" : "play")}
          title={isPlaying ? "Пауза" : "Запуск"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? "Пауза" : "Старт"}</span>
        </button>

        <button
          className="btn-ctrl"
          onClick={() => onControl("speed", speed === 1.0 ? 5.0 : 1.0)}
          title="Скорость симуляции"
        >
          <FastForward size={14} />
          <span>{speed}x</span>
        </button>

        <button
          className="btn-ctrl"
          onClick={() => onControl("reset")}
          title="Сброс к началу"
        >
          <RotateCcw size={14} />
          <span>Сброс</span>
        </button>
      </div>
    </div>
  );
}
