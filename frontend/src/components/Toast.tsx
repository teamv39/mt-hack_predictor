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
    <div className="fixed top-16 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full select-none font-sans">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let borderClass = "border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-[#1c1c20]";
        let iconColor = "text-emerald-500";

        if (toast.type === "warning") {
          Icon = AlertTriangle;
          borderClass = "border-amber-300 dark:border-amber-800/80 bg-white dark:bg-[#1c1c20]";
          iconColor = "text-amber-500";
        } else if (toast.type === "error") {
          Icon = XCircle;
          borderClass = "border-rose-300 dark:border-rose-800/80 bg-white dark:bg-[#1c1c20]";
          iconColor = "text-rose-500";
        } else if (toast.type === "info") {
          Icon = Info;
          borderClass = "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1c1c20]";
          iconColor = "text-zinc-400";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-200 animate-slide-in ${borderClass}`}
          >
            <Icon size={16} className={`${iconColor} shrink-0 mt-0.5`} />
            <div className="flex-1 text-left">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white leading-tight">
                {toast.title}
              </h4>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5 leading-snug">
                {toast.description}
              </p>
              <span className="text-[9px] text-zinc-400 font-mono mt-1 block">
                {toast.timestamp}
              </span>
            </div>
            <button
              onClick={() => onClose(toast.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 p-0.5 transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
