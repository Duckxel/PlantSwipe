import React from "react";
import type { SeedlingStage } from "@/types/garden";
import { PixelSprite } from "@/components/ui/pixel-sprite";

interface SeedlingStageIconProps {
  stage: SeedlingStage;
  size?: number;
  className?: string;
}

/** Map each non-empty stage to a Growing_Plant_00 sprite state */
const STAGE_TO_STATE: Record<Exclude<SeedlingStage, "empty">, number> = {
  sown: 0,
  germinating: 1,
  sprouted: 2,
  ready: 3,
};

export const SeedlingStageIcon: React.FC<SeedlingStageIconProps> = ({ stage, size = 14, className = "" }) => {
  if (stage === "empty") {
    return (
      <div
        className={`rounded-full bg-stone-400 dark:bg-stone-600 flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Scale factor: desired display size / 16px tile size
  const scale = size / 16;

  return (
    <PixelSprite
      name="Growing_Plant_00"
      state={STAGE_TO_STATE[stage]}
      scale={scale}
      className={`flex-shrink-0 ${className}`}
    />
  );
};
