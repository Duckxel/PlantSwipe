import * as React from "react"

import { cn } from "@/lib/utils"

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 rounded-xl border border-input bg-white px-4 py-2 text-base text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2d2d30] dark:text-white md:h-9 md:rounded-md md:px-3 md:py-1.5 md:text-sm",
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }
