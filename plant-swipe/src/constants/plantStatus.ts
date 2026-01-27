export const STATUS_COLORS_HEX = {
  inProgress: "#f59e0b", // Amber
  review: "#0ea5e9",     // Sky Blue
  rework: "#ef4444",     // Red
  approved: "#10b981",   // Emerald
  other: "#475569",      // Slate
} as const;

// Mapping for AdminPage (normalized keys)
export const ADMIN_STATUS_COLORS = {
  "in progres": STATUS_COLORS_HEX.inProgress,
  "review": STATUS_COLORS_HEX.review,
  "rework": STATUS_COLORS_HEX.rework,
  "approved": STATUS_COLORS_HEX.approved,
  "other": STATUS_COLORS_HEX.other,
};

// Mapping for PlantProfileForm (Capitalized keys as strings)
export const FORM_STATUS_COLORS: Record<string, string> = {
  "In Progres": STATUS_COLORS_HEX.inProgress,
  "Rework": STATUS_COLORS_HEX.rework,
  "Review": STATUS_COLORS_HEX.review,
  "Approved": STATUS_COLORS_HEX.approved,
};

export const ADMIN_STATUS_BADGE_CLASSES = {
  "in progres": "bg-amber-100 text-amber-800 dark:bg-amber-500/30 dark:text-amber-100",
  "review": "bg-sky-100 text-sky-800 dark:bg-sky-500/30 dark:text-sky-100",
  "rework": "bg-red-100 text-red-800 dark:bg-red-500/30 dark:text-red-100",
  "approved": "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-100",
  "other": "bg-slate-200 text-slate-800 dark:bg-slate-600/40 dark:text-slate-100",
};

// Selected button classes for status filter pills (filled background with matching shadow)
export const ADMIN_STATUS_BUTTON_SELECTED_CLASSES = {
  "in progres": "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20",
  "review": "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20",
  "rework": "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20",
  "approved": "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20",
  "other": "bg-slate-500 text-white border-slate-500 shadow-md shadow-slate-500/20",
};
