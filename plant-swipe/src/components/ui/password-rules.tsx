import * as React from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PasswordRule } from "@/lib/passwordValidation"

export interface PasswordRulesProps {
  /** The list of rules from validatePassword() */
  rules: PasswordRule[]
  /** Whether the password field has content (hides rules when empty) */
  visible?: boolean
  /** Optional className for the wrapper */
  className?: string
}

/**
 * Displays the password strength rules as a compact checklist.
 *
 * Each rule shows a green check or red cross depending on whether it is
 * met. Designed to sit directly below a password `ValidatedInput`.
 *
 * @example
 * ```tsx
 * const { rules } = validatePassword(password)
 * <PasswordRules rules={rules} visible={password.length > 0} />
 * ```
 */
export const PasswordRules: React.FC<PasswordRulesProps> = ({
  rules,
  visible = true,
  className,
}) => {
  if (!visible) return null

  return (
    <ul className={cn("mt-1.5 space-y-0.5", className)}>
      {rules.map((rule) => (
        <li
          key={rule.key}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors duration-200",
            rule.met
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-stone-400 dark:text-stone-500",
          )}
        >
          {rule.met ? (
            <Check className="h-3 w-3 flex-shrink-0" />
          ) : (
            <X className="h-3 w-3 flex-shrink-0" />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  )
}
