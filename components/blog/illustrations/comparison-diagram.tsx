interface ComparisonItem {
  label: string
  detail?: string
}

export function ComparisonDiagram(props: {
  title?: string
  beforeTitle?: string
  afterTitle?: string
  before?: ComparisonItem[] | string
  after?: ComparisonItem[] | string
}) {
  const title = props.title
  const beforeTitle = props.beforeTitle || "Before"
  const afterTitle = props.afterTitle || "After"
  const before: ComparisonItem[] = typeof props.before === "string" ? JSON.parse(props.before) : props.before || []
  const after: ComparisonItem[] = typeof props.after === "string" ? JSON.parse(props.after) : props.after || []
  return (
    <div className="not-prose my-10">
      {title && (
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm font-bold text-red-700 uppercase tracking-wider">{beforeTitle}</p>
          </div>
          <ul className="space-y-3">
            {before.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg className="h-4 w-4 mt-0.5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-bold text-emerald-700 uppercase tracking-wider">{afterTitle}</p>
          </div>
          <ul className="space-y-3">
            {after.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
