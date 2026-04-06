interface CostItem {
  label: string
  percentage: number
  color?: string
}

export function CostBreakdown(props: {
  title?: string
  items?: CostItem[] | string
  totalLabel?: string
}) {
  const title = props.title
  const totalLabel = props.totalLabel
  const items: CostItem[] = typeof props.items === "string" ? JSON.parse(props.items) : props.items || []
  const defaultColors = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
  ]

  return (
    <div className="not-prose my-10">
      {title && (
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* Bar chart */}
        <div className="flex h-10 rounded-lg overflow-hidden mb-6">
          {items.map((item, i) => (
            <div
              key={i}
              className={`${item.color || defaultColors[i % defaultColors.length]} flex items-center justify-center transition-all`}
              style={{ width: `${item.percentage}%` }}
            >
              {item.percentage >= 10 && (
                <span className="text-xs font-bold text-white">{item.percentage}%</span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-sm shrink-0 ${item.color || defaultColors[i % defaultColors.length]}`} />
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.percentage}%</p>
              </div>
            </div>
          ))}
        </div>

        {totalLabel && (
          <p className="mt-4 text-center text-xs text-slate-500 border-t border-slate-100 pt-3">{totalLabel}</p>
        )}
      </div>
    </div>
  )
}
