import { ReactNode } from "react"
import { FlowChart } from "./illustrations/flow-chart"
import { ComparisonDiagram } from "./illustrations/comparison-diagram"
import { MetricsDashboard } from "./illustrations/metrics-dashboard"
import { ArchitectureDiagram } from "./illustrations/architecture-diagram"
import { CostBreakdown } from "./illustrations/cost-breakdown"
import { TimelineDiagram } from "./illustrations/timeline-diagram"

/* ─── Callout ─── */
const calloutStyles = {
  info: {
    container: "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-400",
    icon: "text-blue-600 dark:text-blue-400",
    iconSvg: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    container: "border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    iconSvg: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    ),
  },
  tip: {
    container: "border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    iconSvg: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.75.75h2.5a.75.75 0 00.75-.75v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.563 7.563 0 01-2.274 0z" />
      </svg>
    ),
  },
  stat: {
    container: "border-l-4 border-violet-500 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-400",
    icon: "text-violet-600 dark:text-violet-400",
    iconSvg: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
      </svg>
    ),
  },
}

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "tip" | "stat"
  title?: string
  children: ReactNode
}) {
  const style = calloutStyles[type]
  return (
    <div className={`not-prose my-8 rounded-r-lg px-5 py-4 ${style.container}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${style.icon}`}>{style.iconSvg}</span>
        <div className="min-w-0">
          {title && (
            <p className="mb-1 text-[0.9375rem] font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </p>
          )}
          <div className="text-[0.9375rem] leading-relaxed text-slate-700 dark:text-slate-300 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mt-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul>li]:mb-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── KeyTakeaway ─── */
export function KeyTakeaway({
  title = "Key Takeaway",
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div className="not-prose my-10 relative overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/50 dark:via-slate-900 dark:to-emerald-950/30 px-6 py-5 shadow-sm">
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
      <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        {title}
      </p>
      <div className="text-[0.9375rem] leading-relaxed text-slate-700 dark:text-slate-300 [&>p]:mb-2 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
}

/* ─── StatGrid ─── */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}

export function Stat({
  value,
  label,
  detail,
}: {
  value: string
  label: string
  detail?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 px-4 py-4 text-center shadow-sm">
      <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
      {detail && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      )}
    </div>
  )
}

/* ─── ComparisonTable wrapper ─── */
export function ComparisonTable({ children }: { children: ReactNode }) {
  return (
    <div className="my-10 -mx-2 overflow-x-auto sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── StepList ─── */
export function StepList({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-10 space-y-4">
      {children}
    </div>
  )
}

export function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-sm font-bold text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-800/60">
        {number}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <div className="text-[0.9375rem] leading-relaxed text-slate-600 dark:text-slate-400 [&>p]:mb-2 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── Component map for MDXRemote ─── */
export const mdxComponents = {
  Callout,
  KeyTakeaway,
  StatGrid,
  Stat,
  ComparisonTable,
  StepList,
  Step,
  FlowChart,
  ComparisonDiagram,
  MetricsDashboard,
  ArchitectureDiagram,
  CostBreakdown,
  TimelineDiagram,
}
