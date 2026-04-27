import * as React from "react"

import { AppSelect, type AppSelectOption } from "@/components/ui/app-select"

/**
 * Back-compat wrapper around the native <select> API.
 *
 * Accepts the same props and <option> / <optgroup> children as before but
 * renders a styled `AppSelect` under the hood so the app's dropdowns no
 * longer fall back to the native device picker (which breaks the look on
 * mobile and in Capacitor).
 *
 * Synthesises a minimal ChangeEvent so existing onChange handlers keep
 * working:
 *   <Select value={foo} onChange={(e) => setFoo(e.target.value)}>
 *     <option value="a">A</option>
 *   </Select>
 */

function extractOptions(children: React.ReactNode): AppSelectOption<string>[] {
  const options: AppSelectOption<string>[] = []

  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      const type = child.type
      if (type === "option") {
        const props = child.props as {
          value?: string | number | readonly string[]
          children?: React.ReactNode
          disabled?: boolean
        }
        if (props.value !== undefined) {
          options.push({
            value: String(props.value),
            label: (props.children ?? String(props.value)) as React.ReactNode,
            disabled: props.disabled,
          })
        }
      } else if (type === "optgroup") {
        // Flatten optgroup children — AppSelect doesn't group visually.
        const props = child.props as { children?: React.ReactNode }
        if (props.children) walk(props.children)
      } else {
        // Unwrap fragments / conditional wrappers
        const props = child.props as { children?: React.ReactNode }
        if (props.children) walk(props.children)
      }
    })
  }
  walk(children)
  return options
}

export interface SelectProps
  extends Omit<React.ComponentProps<"select">, "onChange" | "size"> {
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      disabled,
      id,
      name,
      "aria-label": ariaLabel,
    },
    _ref,
  ) => {
    const options = React.useMemo(() => extractOptions(children), [children])
    const isControlled = value !== undefined
    const [uncontrolled, setUncontrolled] = React.useState<string | null>(() =>
      defaultValue !== undefined ? String(defaultValue) : null,
    )
    const current = isControlled
      ? value === null || value === undefined
        ? null
        : String(value)
      : uncontrolled

    const handleChange = React.useCallback(
      (newValue: string) => {
        if (!isControlled) setUncontrolled(newValue)
        if (!onChange) return
        const fakeTarget = {
          value: newValue,
          name: name ?? "",
          id: id ?? "",
        } as unknown as HTMLSelectElement
        const ev = {
          target: fakeTarget,
          currentTarget: fakeTarget,
          bubbles: false,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 0,
          isTrusted: false,
          nativeEvent: undefined as unknown as Event,
          preventDefault: () => {},
          isDefaultPrevented: () => false,
          stopPropagation: () => {},
          isPropagationStopped: () => false,
          persist: () => {},
          timeStamp: Date.now(),
          type: "change",
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(ev)
      },
      [onChange, name, id, isControlled],
    )

    return (
      <AppSelect
        value={current}
        onChange={handleChange}
        options={options}
        disabled={disabled}
        ariaLabel={ariaLabel}
        id={id}
        triggerClassName={className}
      />
    )
  },
)
Select.displayName = "Select"

export { Select }
