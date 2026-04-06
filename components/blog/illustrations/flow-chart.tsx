interface FlowChartStep {
  label: string
  detail?: string
}

export function FlowChart(props: {
  title?: string
  steps?: FlowChartStep[] | string
  color?: "emerald" | "blue" | "violet" | "amber"
}) {
  const title = props.title
  const color = props.color || "emerald"
  const steps: FlowChartStep[] = typeof props.steps === "string"
    ? JSON.parse(props.steps)
    : props.steps || []
  const colors = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", accent: "bg-emerald-500", text: "text-emerald-700", light: "text-emerald-600", arrow: "text-emerald-400" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", accent: "bg-blue-500", text: "text-blue-700", light: "text-blue-600", arrow: "text-blue-400" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", accent: "bg-violet-500", text: "text-violet-700", light: "text-violet-600", arrow: "text-violet-400" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", accent: "bg-amber-500", text: "text-amber-700", light: "text-amber-600", arrow: "text-amber-400" },
  }
  const c = colors[color]

  return (
    <div className="not-prose my-10">
      {title && (
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="flex flex-col md:flex-row items-stretch gap-3 md:gap-0">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col md:flex-row items-center flex-1">
            <div className={`w-full rounded-xl border ${c.border} ${c.bg} p-4 text-center`}>
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${c.accent} text-white text-sm font-bold mb-2`}>
                {i + 1}
              </div>
              <p className={`text-sm font-semibold ${c.text}`}>{step.label}</p>
              {step.detail && (
                <p className="mt-1 text-xs text-slate-500">{step.detail}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`hidden md:flex items-center px-1 ${c.arrow}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
