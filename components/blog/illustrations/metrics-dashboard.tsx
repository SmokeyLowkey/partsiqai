interface Metric {
  value: string
  label: string
  change?: string
}

export function MetricsDashboard(props: {
  title?: string
  metrics?: Metric[] | string
}) {
  const title = props.title
  const metrics: Metric[] = typeof props.metrics === "string" ? JSON.parse(props.metrics) : props.metrics || []
  return (
    <div className="not-prose my-10">
      {title && (
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className={`grid gap-4 ${metrics.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
          {metrics.map((metric, i) => (
            <div key={i} className="text-center p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">{metric.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-300">{metric.label}</p>
              {metric.change && (
                <p className="mt-1 text-xs text-emerald-400/80">{metric.change}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
