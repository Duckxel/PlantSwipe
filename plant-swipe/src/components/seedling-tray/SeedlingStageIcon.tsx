import React from "react";
import type { SeedlingStage } from "@/types/garden";

interface SeedlingStageIconProps {
  stage: SeedlingStage;
  size?: number;
  className?: string;
}

export const SeedlingStageIcon: React.FC<SeedlingStageIconProps> = ({ stage, size = 14, className = "" }) => {
  const barW = Math.max(2, Math.round(size / 7));
  const gap = 1;

  if (stage === "empty") {
    return (
      <div
        className={`rounded-full bg-stone-400 dark:bg-stone-600 flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (stage === "sown") {
    return (
      <div
        className={`rounded-full bg-amber-600 dark:bg-amber-500 flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (stage === "germinating") {
    return (
      <div
        className={`flex items-end justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <div
          className="bg-emerald-700 dark:bg-emerald-500 rounded-sm"
          style={{ width: barW, height: size * 0.7 }}
        />
      </div>
    );
  }

  if (stage === "sprouted") {
    return (
      <div
        className={`flex items-end justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size, gap }}
      >
        <div className="bg-emerald-500 dark:bg-emerald-400 rounded-sm self-end" style={{ width: barW, height: size * 0.5 }} />
        <div className="bg-emerald-500 dark:bg-emerald-400 rounded-sm self-end" style={{ width: barW, height: size * 0.85 }} />
        <div className="bg-emerald-500 dark:bg-emerald-400 rounded-sm self-end" style={{ width: barW, height: size * 0.5 }} />
      </div>
    );
  }

  // ready
  return (
    <div
      className={`flex items-end justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size, gap }}
    >
      <div className="bg-emerald-400 dark:bg-emerald-300 rounded-sm self-end" style={{ width: barW, height: size * 0.6 }} />
      <div className="bg-emerald-400 dark:bg-emerald-300 rounded-sm self-end" style={{ width: barW, height: size }} />
      <div className="bg-emerald-400 dark:bg-emerald-300 rounded-sm self-end" style={{ width: barW, height: size * 0.6 }} />
    </div>
  );
};
