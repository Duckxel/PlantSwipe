/**
 * Comprehensive Plant Form primitives for structured plant fields.
 */

import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ArrayInputProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export const ArrayInput: React.FC<ArrayInputProps> = ({ label, values, onChange, placeholder }) => {
  const [inputValue, setInputValue] = React.useState("")

  const addItem = () => {
    if (inputValue.trim()) {
      onChange([...values, inputValue.trim()])
      setInputValue("")
    }
  }

  const removeItem = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
          placeholder={placeholder || "Enter item and press Enter"}
        />
        <Button type="button" onClick={addItem}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((item, index) => (
            <span key={index} className="px-2 py-1 bg-stone-100 dark:bg-[#2d2d30] rounded-lg text-sm flex items-center gap-1">
              {item}
              <button type="button" onClick={() => removeItem(index)} className="text-red-600 hover:text-red-800">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface MultiSelectProps {
  label: string
  values: string[]
  options: readonly string[]
  onChange: (values: string[]) => void
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, values, options, onChange }) => {
  const toggle = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter(v => v !== option))
    } else {
      onChange([...values, option])
    }
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${
              values.includes(option)
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

interface MonthSelectorProps {
  label: string
  values: number[]
  onChange: (values: number[]) => void
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ label, values, onChange }) => {
  const months = [
    { num: 1, name: "Jan" }, { num: 2, name: "Feb" }, { num: 3, name: "Mar" },
    { num: 4, name: "Apr" }, { num: 5, name: "May" }, { num: 6, name: "Jun" },
    { num: 7, name: "Jul" }, { num: 8, name: "Aug" }, { num: 9, name: "Sep" },
    { num: 10, name: "Oct" }, { num: 11, name: "Nov" }, { num: 12, name: "Dec" }
  ]

  const toggle = (month: number) => {
    if (values.includes(month)) {
      onChange(values.filter(m => m !== month))
    } else {
      onChange([...values, month].sort((a, b) => a - b))
    }
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {months.map((m) => (
          <button
            key={m.num}
            type="button"
            onClick={() => toggle(m.num)}
            className={`px-3 py-1 rounded-2xl text-sm shadow-sm border transition ${
              values.includes(m.num)
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42]"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ColorInputProps {
  label: string
  colors: Array<{ name: string; hex?: string }>
  onChange: (colors: Array<{ name: string; hex?: string }>) => void
}

export const ColorInput: React.FC<ColorInputProps> = ({ label, colors, onChange }) => {
  const [name, setName] = React.useState("")
  const [hex, setHex] = React.useState("")

  const addColor = () => {
    if (name.trim()) {
      onChange([...colors, { name: name.trim(), hex: hex.trim() || undefined }])
      setName("")
      setHex("")
    }
  }

  const removeColor = (index: number) => {
    onChange(colors.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Color name"
          className="flex-1"
        />
        <Input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          placeholder="#FFFFFF"
          className="w-24"
        />
        <Button type="button" onClick={addColor}>Add</Button>
      </div>
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {colors.map((color, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-stone-100 dark:bg-[#2d2d30] rounded-lg text-sm flex items-center gap-1"
              style={color.hex ? { backgroundColor: color.hex, color: '#000' } : {}}
            >
              {color.name}
              {color.hex && <span className="text-xs">({color.hex})</span>}
              <button type="button" onClick={() => removeColor(index)} className="text-red-600 hover:text-red-800">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
