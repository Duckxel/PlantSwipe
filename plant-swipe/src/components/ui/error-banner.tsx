import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
  /** The main title shown above the error detail. */
  title?: string;
  /** The error message / detail text. Rendered in a selectable monospace block. */
  message: string;
  /** Additional CSS classes on the root element. */
  className?: string;
}

/**
 * A styled error banner that displays a title and a selectable, monospace
 * error message. Designed to surface API / server errors so users (and
 * developers) can read and copy the exact error text.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title,
  message,
  className,
}) => (
  <div
    role="alert"
    className={cn(
      "rounded-[28px] border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6",
      className,
    )}
  >
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        {title && (
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-1">
            {title}
          </h4>
        )}
        <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap break-all font-mono bg-red-100 dark:bg-red-900/40 rounded-xl p-3 mt-2 select-text cursor-text">
          {message}
        </pre>
      </div>
    </div>
  </div>
);

export default ErrorBanner;
