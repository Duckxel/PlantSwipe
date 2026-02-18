import * as React from "react";
import { cn } from "@/lib/utils";

export interface PillTab<K extends string = string> {
  key: K;
  label: React.ReactNode;
}

interface PillTabsProps<K extends string = string> {
  /** The tab definitions (key + label). */
  tabs: PillTab<K>[];
  /** The currently active tab key. */
  activeKey: K;
  /** Called when a tab is clicked. */
  onTabChange: (key: K) => void;
  /** Additional CSS classes on the outer wrapper. */
  className?: string;
}

/**
 * A pill-shaped segmented tab bar.
 * Matches the style used on admin/plants ("Plants | Requests" toggle).
 */
export function PillTabs<K extends string = string>({
  tabs,
  activeKey,
  onTabChange,
  className,
}: PillTabsProps<K>) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-[#3e3e42] bg-white/80 dark:bg-[#1a1a1d]/80 px-1 py-1 backdrop-blur">
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "px-4 py-1.5 text-sm font-semibold rounded-full transition-colors",
                isActive
                  ? "bg-emerald-600 text-white shadow"
                  : "text-stone-600 dark:text-stone-300 hover:text-black dark:hover:text-white",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PillTabs;
