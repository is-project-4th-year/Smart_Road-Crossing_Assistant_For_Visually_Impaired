import React from "react";
import { CheckCircle, XCircle, AlertCircle, HelpCircle, PauseCircle } from "lucide-react";

export default function StatusDisplay({ status, darkMode, isPaused }) {
  try {
    const getStatusConfig = () => {
      if (isPaused) {
        return {
          bg: "bg-gray-600",
          Icon: PauseCircle,
          iconBg: "bg-white",
          iconColor: "text-gray-600",
          text: "Paused",
          subtext: "Tap to resume",
          vibrations: "",
        };
      }

      // Normalize status to lowercase for comparison
      const normalizedStatus = status?.toLowerCase() || '';

      switch (normalizedStatus) {
        case "safe":
          return {
            bg: "bg-[var(--primary-color)]",
            Icon: CheckCircle,
            iconBg: "bg-white",
            iconColor: "text-[var(--primary-color)]",
            text: "Safe to Go",
            vibrations: "3 vibrations",
          };
        case "danger":
          return {
            bg: "bg-[var(--danger-color)]",
            Icon: XCircle,
            iconBg: "bg-white",
            iconColor: "text-[var(--danger-color)]",
            text: "Do Not Cross",
            vibrations: "2 vibrations",
          };
        case "wait":
        case "preparing":
        case "transition":
        case "caution":
          return {
            bg: "bg-[var(--warning-color)]",
            Icon: AlertCircle,
            iconBg: "bg-white",
            iconColor: "text-[var(--warning-color)]",
            text: "Wait",
            vibrations: "1 vibration",
          };
        default:
          return {
            bg: "bg-gray-500",
            Icon: HelpCircle,
            iconBg: "bg-white",
            iconColor: "text-gray-500",
            text: "Detecting...",
            vibrations: "",
          };
      }
    };

    const config = getStatusConfig();

    return (
      <div
        className={`status-card ${config.bg}`}
        data-name="status-display"
      >
        <div className={`icon-large ${config.iconBg} rounded-full p-6`}>
          <config.Icon className={`${config.iconColor}`} size={80} strokeWidth={2} />
        </div>

        <h2 className="text-5xl font-bold text-white mb-4">
          {config.text}
        </h2>

        {config.vibrations && (
          <p className="text-2xl text-white opacity-90">
            {config.vibrations}
          </p>
        )}

        {config.subtext && (
          <p className="text-2xl text-white opacity-90 mt-2">
            {config.subtext}
          </p>
        )}
      </div>
    );
  } catch (error) {
    console.error("StatusDisplay component error:", error);
    return null;
  }
}

