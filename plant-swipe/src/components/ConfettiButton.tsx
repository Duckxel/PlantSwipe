import React from 'react'
import confetti from 'canvas-confetti'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Number of confetti particles (default 100) */
  particleCount?: number
  /** Spread angle in degrees (default 70) */
  spread?: number
  /** Extra canvas-confetti overrides */
  confettiOptions?: confetti.Options
}

/**
 * A button that fires a burst of multi-color confetti from its center on click.
 * Accepts all standard <button> props plus optional confetti tuning.
 */
export const ConfettiButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ particleCount = 100, spread = 70, confettiOptions, onClick, children, ...rest }, ref) => {
    const innerRef = React.useRef<HTMLButtonElement | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
      },
      [ref],
    )

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Fire confetti from the button's position
      const btn = innerRef.current
      if (btn) {
        const rect = btn.getBoundingClientRect()
        const x = (rect.left + rect.width / 2) / window.innerWidth
        const y = (rect.top + rect.height / 2) / window.innerHeight

        confetti({
          particleCount,
          spread,
          origin: { x, y },
          colors: ['#4ade80', '#22c55e', '#16a34a', '#facc15', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6'],
          ...confettiOptions,
        })
      }

      onClick?.(e)
    }

    return (
      <button ref={setRefs} onClick={handleClick} {...rest}>
        {children}
      </button>
    )
  },
)

ConfettiButton.displayName = 'ConfettiButton'
