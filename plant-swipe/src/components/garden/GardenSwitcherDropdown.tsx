import React from "react";
import { ChevronDown, Sprout } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserGardens } from "@/lib/gardens";
import type { Garden } from "@/types/garden";

interface GardenSwitcherDropdownProps {
  currentGarden: Garden;
  userId: string;
  onSwitch: (gardenId: string) => void;
  /** Custom trigger element. Receives the garden and renders as DropdownMenuTrigger child. */
  children?: React.ReactNode;
}

export const GardenSwitcherDropdown: React.FC<GardenSwitcherDropdownProps> = ({
  currentGarden,
  userId,
  onSwitch,
  children,
}) => {
  const [gardens, setGardens] = React.useState<Garden[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  // Pre-fetch gardens on mount so they're ready when the dropdown opens
  React.useEffect(() => {
    let cancelled = false;
    getUserGardens(userId).then((g) => {
      if (!cancelled) {
        setGardens(g);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const otherGardens = gardens.filter((g) => g.id !== currentGarden.id);

  const defaultTrigger = (
    <button
      className="hidden md:flex items-center gap-1.5 text-xl font-semibold text-left hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none outline-none p-0"
      aria-label="Switch garden"
    >
      <span className="truncate max-w-[160px]">{currentGarden.name}</span>
      <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-60" />
    </button>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {children || defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        {/* Current garden - shown as active */}
        <DropdownMenuItem
          className="cursor-default font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
          disabled
        >
          <Sprout className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">{currentGarden.name}</span>
        </DropdownMenuItem>
        {/* Other gardens */}
        {!loaded && (
          <DropdownMenuItem disabled className="text-xs opacity-60">
            Loading...
          </DropdownMenuItem>
        )}
        {loaded && otherGardens.length === 0 && (
          <DropdownMenuItem disabled className="text-xs opacity-60">
            No other gardens
          </DropdownMenuItem>
        )}
        {loaded &&
          otherGardens.map((g) => (
            <DropdownMenuItem
              key={g.id}
              className="cursor-pointer"
              onSelect={() => onSwitch(g.id)}
            >
              <Sprout className="h-4 w-4 mr-2 flex-shrink-0 opacity-50" />
              <span className="truncate">{g.name}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
