import * as React from "react"
import { cn } from "@/lib/utils"

export type TimezoneOption = {
  value: string
  label: string
}

function buildTimezoneList(): TimezoneOption[] {
  const now = new Date()
  const getOffset = (tz: string): string => {
    try {
      const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }))
      const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }))
      const offsetMs = tzDate.getTime() - utcDate.getTime()
      const offsetHours = offsetMs / (1000 * 60 * 60)
      const sign = offsetHours >= 0 ? "+" : ""
      const hours = Math.floor(Math.abs(offsetHours))
      const minutes = Math.floor((Math.abs(offsetHours) - hours) * 60)
      return minutes === 0
        ? `UTC${sign}${hours}`
        : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`
    } catch {
      return ""
    }
  }

  return [
    { value: "UTC", label: `UTC (Coordinated Universal Time) - UTC+0` },
    { value: "Europe/London", label: `London (GMT/BST) - ${getOffset("Europe/London")}` },
    { value: "Europe/Paris", label: `Paris (CET/CEST) - ${getOffset("Europe/Paris")}` },
    { value: "Europe/Berlin", label: `Berlin (CET/CEST) - ${getOffset("Europe/Berlin")}` },
    { value: "Europe/Rome", label: `Rome (CET/CEST) - ${getOffset("Europe/Rome")}` },
    { value: "Europe/Madrid", label: `Madrid (CET/CEST) - ${getOffset("Europe/Madrid")}` },
    { value: "Europe/Amsterdam", label: `Amsterdam (CET/CEST) - ${getOffset("Europe/Amsterdam")}` },
    { value: "Europe/Stockholm", label: `Stockholm (CET/CEST) - ${getOffset("Europe/Stockholm")}` },
    { value: "Europe/Zurich", label: `Zurich (CET/CEST) - ${getOffset("Europe/Zurich")}` },
    { value: "Europe/Vienna", label: `Vienna (CET/CEST) - ${getOffset("Europe/Vienna")}` },
    { value: "Europe/Brussels", label: `Brussels (CET/CEST) - ${getOffset("Europe/Brussels")}` },
    { value: "America/New_York", label: `New York (EST/EDT) - ${getOffset("America/New_York")}` },
    { value: "America/Chicago", label: `Chicago (CST/CDT) - ${getOffset("America/Chicago")}` },
    { value: "America/Denver", label: `Denver (MST/MDT) - ${getOffset("America/Denver")}` },
    { value: "America/Los_Angeles", label: `Los Angeles (PST/PDT) - ${getOffset("America/Los_Angeles")}` },
    { value: "America/Toronto", label: `Toronto (EST/EDT) - ${getOffset("America/Toronto")}` },
    { value: "America/Vancouver", label: `Vancouver (PST/PDT) - ${getOffset("America/Vancouver")}` },
    { value: "America/Mexico_City", label: `Mexico City (CST/CDT) - ${getOffset("America/Mexico_City")}` },
    { value: "America/Sao_Paulo", label: `São Paulo (BRT/BRST) - ${getOffset("America/Sao_Paulo")}` },
    { value: "America/Buenos_Aires", label: `Buenos Aires (ART) - ${getOffset("America/Buenos_Aires")}` },
    { value: "Asia/Tokyo", label: `Tokyo (JST) - ${getOffset("Asia/Tokyo")}` },
    { value: "Asia/Shanghai", label: `Shanghai (CST) - ${getOffset("Asia/Shanghai")}` },
    { value: "Asia/Hong_Kong", label: `Hong Kong (HKT) - ${getOffset("Asia/Hong_Kong")}` },
    { value: "Asia/Singapore", label: `Singapore (SGT) - ${getOffset("Asia/Singapore")}` },
    { value: "Asia/Dubai", label: `Dubai (GST) - ${getOffset("Asia/Dubai")}` },
    { value: "Asia/Kolkata", label: `Mumbai/Delhi (IST) - ${getOffset("Asia/Kolkata")}` },
    { value: "Asia/Seoul", label: `Seoul (KST) - ${getOffset("Asia/Seoul")}` },
    { value: "Australia/Sydney", label: `Sydney (AEDT/AEST) - ${getOffset("Australia/Sydney")}` },
    { value: "Australia/Melbourne", label: `Melbourne (AEDT/AEST) - ${getOffset("Australia/Melbourne")}` },
    { value: "Australia/Brisbane", label: `Brisbane (AEST) - ${getOffset("Australia/Brisbane")}` },
    { value: "Pacific/Auckland", label: `Auckland (NZDT/NZST) - ${getOffset("Pacific/Auckland")}` },
    { value: "Africa/Cairo", label: `Cairo (EET) - ${getOffset("Africa/Cairo")}` },
    { value: "Africa/Johannesburg", label: `Johannesburg (SAST) - ${getOffset("Africa/Johannesburg")}` },
  ]
}

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({
  value,
  onChange,
  disabled,
  className,
  id,
}) => {
  const timezones = React.useMemo(() => buildTimezoneList(), [])

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-white px-4 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2d2d30] dark:text-white",
        className
      )}
    >
      {timezones.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
    </select>
  )
}
