import React from "react"
import { Badge } from "@/components/ui/badge"

interface SearchLayoutProps {
  title: string
  subtitle: string
  badge: string
  leftActions?: React.ReactNode
  rightActions?: React.ReactNode
  children: React.ReactNode
}

export const SearchLayout: React.FC<SearchLayoutProps> = ({
  title,
  subtitle,
  badge,
  leftActions,
  rightActions,
  children,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 pb-16 space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-emerald-50 via-white to-stone-100 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717]">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-16 bottom-[-25%] h-72 w-72 rounded-full bg-emerald-100/40 dark:bg-emerald-500/10 blur-3xl" />
        <div className="relative space-y-6 p-8 md:p-12">
          <Badge className="rounded-2xl px-4 py-1 bg-white/70 dark:bg-[#2d2d30]/70 backdrop-blur">
            {badge}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="text-base md:text-lg max-w-3xl text-stone-600 dark:text-stone-300">
            {subtitle}
          </p>
          {(leftActions || rightActions) && (
            <div className="flex flex-wrap items-center gap-3 pt-1.5">
              {leftActions}
              <div className="ml-auto flex gap-2">{rightActions}</div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/75 dark:bg-[#1f1f1f]/75 backdrop-blur p-6 md:p-8 shadow-sm">
        {children}
      </section>
    </div>
  )
}
