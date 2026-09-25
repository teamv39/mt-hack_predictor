import React from "react";
import { Bus, Clock, CheckCircle2, TrendingUp, Cpu } from "lucide-react";

export function Inspector({ vehicle, alert, onApplyHolding }) {
  if (!vehicle) return null;

  const isHoldingApplied = alert?.recommendation?.applied;
  const delayMinutes = Math.abs((vehicle.delay_seconds / 60).toFixed(1));
  const headwayMinutes = (vehicle.headway_seconds / 60).toFixed(1);

  return (
    <div className="inspector-panel glass-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Bus size={15} color="#3b82f6" />
          <span>Инспектор рейса</span>
        </div>
        <span className="bus-badge">{vehicle.route_id} • РЕЙС 101</span>
      </div>

      {/* Bus Status Card */}
      <div className="bus-meta-card">
        <div className="bus-id">
          <span>Борт №{vehicle.id}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div className="metric-pill">
            <span className="metric-label">Отставание</span>
            <span
              className={`metric-value ${
                vehicle.delay_seconds > 180 ? "red" : "emerald"
              }`}
            >
              +{delayMinutes} мин
            </span>
          </div>

          <div className="metric-pill">
            <span className="metric-label">Интервал (Headway)</span>
            <span
              className={`metric-value ${
                vehicle.headway_seconds < 180 && !isHoldingApplied
                  ? "red"
                  : "emerald"
              }`}
            >
              {isHoldingApplied ? "7.5 мин" : `${headwayMinutes} мин`}
            </span>
          </div>
        </div>
      </div>

      {/* Trajectory Prediction Graph */}
      <div className="graph-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <TrendingUp size={13} color="#3b82f6" />
            Прогнозная траектория движения
          </span>
        </div>

        {/* Dynamic SVG Curves */}
        <svg className="graph-svg" viewBox="0 0 360 110">
          {/* Grid lines */}
          <line x1="20" y1="20" x2="340" y2="20" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="20" y1="55" x2="340" y2="55" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="20" y1="90" x2="340" y2="90" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

          {/* Time markers */}
          <text x="20" y="105" fill="#64748b" fontSize="9">Сейчас</text>
          <text x="170" y="105" fill="#64748b" fontSize="9">+15 мин</text>
          <text x="310" y="105" fill="#64748b" fontSize="9">+30 мин</text>

          {/* Blue: Schedule plan */}
          <path
            d="M 20 55 L 180 55 L 340 55"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Red: Forecast without DSS intervention (collapse) */}
          <path
            d="M 20 55 Q 160 85 340 98"
            fill="none"
            stroke={isHoldingApplied ? "rgba(239, 68, 68, 0.2)" : "#ef4444"}
            strokeWidth={isHoldingApplied ? "1.5" : "2.5"}
          />

          {/* Green: Forecast with AI Holding intervention */}
          {isHoldingApplied && (
            <path
              d="M 20 55 Q 140 70 340 57"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            />
          )}

          {/* Current point */}
          <circle cx="20" cy="55" r="4" fill="#38bdf8" />
        </svg>

        {/* Legend */}
        <div className="graph-legend">
          <div className="legend-item">
            <div className="legend-color blue" />
            <span>План</span>
          </div>
          <div className="legend-item">
            <div className="legend-color red" />
            <span>Без мер</span>
          </div>
          <div className="legend-item">
            <div className="legend-color green" />
            <span>С ИИ (Holding)</span>
          </div>
        </div>
      </div>

      {/* Explainable AI (SHAP Factors) */}
      <div className="shap-container">
        <span
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#cbd5e1",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Cpu size={13} color="#f59e0b" />
          Факторы прогноза задержки (SHAP XAI)
        </span>

        {alert?.factors ? (
          alert.factors.map((factor, idx) => (
            <div key={idx} className="shap-row">
              <div className="shap-label-row">
                <span className="shap-title">{factor.title}</span>
                <span className="shap-val">+{factor.weight}%</span>
              </div>
              <div className="shap-bar-bg">
                <div
                  className="shap-bar-fill"
                  style={{ width: `${factor.weight}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Факторы влияния в норме
          </div>
        )}
      </div>

      {/* Actionable CTA: Holding Button */}
      {alert?.recommendation && (
        <button
          className="cta-button"
          onClick={() => onApplyHolding && onApplyHolding(alert.id)}
          disabled={isHoldingApplied}
        >
          {isHoldingApplied ? (
            <>
              <CheckCircle2 size={16} />
              <span>Рекомендация передана в АСУ-РДС</span>
            </>
          ) : (
            <>
              <Clock size={16} />
              <span>
                Применить Holding: придержать №
                {alert.recommendation.target_vehicle_id} на{" "}
                {(alert.recommendation.duration_seconds / 60).toFixed(1)} мин
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
