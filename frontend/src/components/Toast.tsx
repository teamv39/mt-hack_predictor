import React from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { ToastMessage } from "../hooks/useTelemetry";

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let borderClass = "border-emerald-300 bg-white";
        let iconColor = "text-emerald-500";

        if (toast.type === "warning") {
          Icon = AlertTriangle;
          borderClass = "border-amber-300 bg-white";
          iconColor = "text-amber-500";
        } else if (toast.type === "error") {
          Icon = XCircle;
          borderClass = "border-rose-300 bg-white";
          iconColor = "text-rose-500";
        } else if (toast.type === "info") {
          Icon = Info;
          borderClass = "border-blue-300 bg-white";
          iconColor = "text-blue-500";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${borderClass}`}
          >
            <Icon size={18} className={`${iconColor} shrink-0 mt-0.5`} />
            <div className="flex-1 text-left">
              <h4 className="text-xs font-bold text-slate-900 leading-tight">
                {toast.title}
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                {toast.description}
              </p>
              <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                {toast.timestamp}
              </span>
            </div>
            <button
              onClick={() => onClose(toast.id)}
              className="text-slate-400 hover:text-slate-600 shrink-0 -mt-1 -mr-1 p-1"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
