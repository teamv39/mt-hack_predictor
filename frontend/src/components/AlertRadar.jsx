import React from "react";
import { AlertTriangle, Clock, ShieldCheck, MapPin, ChevronRight } from "lucide-react";

export function AlertRadar({ alert, onSelectAlert }) {
  const isApplied = alert?.recommendation?.applied;

  return (
    <div className="radar-panel glass-panel">
      <div className="panel-header">
        <div className="panel-title">
          <AlertTriangle size={15} color={alert && !isApplied ? "#ef4444" : "#10b981"} />
          <span>Предиктивный радар</span>
        </div>
        <span className="badge-alert-count">
          {alert && !isApplied ? "1 алерт" : "0 алертов"}
        </span>
      </div>

      {alert ? (
        <div
          className={`alert-card ${isApplied ? "applied" : ""}`}
          onClick={() => onSelectAlert && onSelectAlert(alert)}
        >
          <div className="alert-top">
            <div className={`alert-timer ${isApplied ? "applied" : ""}`}>
              {isApplied ? (
                <>
                  <ShieldCheck size={14} />
                  <span>РЕКОМЕНДАЦИЯ АКТИВНА</span>
                </>
              ) : (
                <>
                  <Clock size={14} />
                  <span>ЧЕРЕЗ {alert.estimated_time_to_incident || "22"} МИН</span>
                </>
              )}
            </div>

            <div className="alert-risk-prob">
              {isApplied ? "РИСК 8%" : `РИСК ${(alert.probability * 100).toFixed(0)}%`}
            </div>
          </div>

          <div className="alert-title">
            Маршрут {alert.route_id} • Пачкование бортов
          </div>

          <div className="alert-desc">{alert.message}</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "#94a3b8",
              marginTop: "4px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <MapPin size={12} /> м. Бауманская
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px", color: "#60a5fa" }}>
              К инциденту <ChevronRight size={12} />
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "13px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ShieldCheck size={28} color="#10b981" />
          <span>График в норме. Рисков деградации интервалов не обнаружено.</span>
        </div>
      )}
    </div>
  );
}
