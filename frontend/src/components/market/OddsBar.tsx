import React from "react";

interface OddsBarProps {
  yesPercent: number;
  noPercent: number;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}

export default function OddsBar({
  yesPercent,
  noPercent,
  size = "sm",
  showLabels = true,
}: OddsBarProps) {
  const heightClass = size === "lg" ? "h-8" : size === "md" ? "h-5" : "h-3";
  const noBets = yesPercent === 50 && noPercent === 50;

  return (
    <div className="w-full">
      {/* Labels above the bar */}
      {showLabels && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-accent-mint">
            YES {yesPercent}%
          </span>
          <span className="text-xs font-medium text-accent-red">
            NO {noPercent}%
          </span>
        </div>
      )}

      {/* Bar */}
      <div
        className={`w-full ${heightClass} rounded-full overflow-hidden flex ${
          noBets ? "bg-slate-700" : "bg-surface-hover"
        }`}
      >
        <div
          className={`transition-all duration-300 ease-in-out ${
            noBets ? "bg-slate-600" : "bg-accent-mint"
          } ${size === "lg" ? "rounded-l-full" : ""}`}
          style={{ width: `${yesPercent}%` }}
        />
        <div
          className={`transition-all duration-300 ease-in-out ${
            noBets ? "bg-slate-600" : "bg-accent-red"
          } ${size === "lg" ? "rounded-r-full" : ""}`}
          style={{ width: `${noPercent}%` }}
        />
      </div>
    </div>
  );
}

