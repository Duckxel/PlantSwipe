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
}

export const GardenSwitcherDropdown: React.FC<GardenSwitcherDropdownProps> = ({
  currentGarden,
  userId,
  onSwitch,
}) => {
  const [gardens, setGardens] = React.useState<Garden[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Fetch user gardens lazily on first open
  React.useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    getUserGardens(userId).then((g) => {
      if (!cancelled) {
        setGardens(g);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [open, loaded, userId]);

  // Reset cache when userId changes
  React.useEffect(() => {
    setLoaded(false);
    setGardens([]);
  }, [userId]);

  const otherGardens = gardens.filter((g) => g.id !== currentGarden.id);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="hidden md:flex items-center gap-1.5 text-xl font-semibold text-left hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none outline-none p-0"
          aria-label="Switch garden"
        >
          <span className="truncate max-w-[160px]">{currentGarden.name}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-60" />
        </button>
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
        {!loaded && open && (
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
              onClick={() => {
                onSwitch(g.id);
                setOpen(false);
              }}
            >
              <Sprout className="h-4 w-4 mr-2 flex-shrink-0 opacity-50" />
              <span className="truncate">{g.name}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
