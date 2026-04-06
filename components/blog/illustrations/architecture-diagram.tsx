interface ArchNode {
  label: string
  detail?: string
}

export function ArchitectureDiagram(props: {
  title?: string
  center?: { label: string; detail?: string } | string
  nodes?: ArchNode[] | string
}) {
  const title = props.title
  const center = typeof props.center === "string" ? JSON.parse(props.center) : props.center || { label: "" }
  const nodes: ArchNode[] = typeof props.nodes === "string" ? JSON.parse(props.nodes) : props.nodes || []
  return (
    <div className="not-prose my-10">
      {title && (
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
        {/* Center node */}
        <div className="flex justify-center mb-6">
          <div className="rounded-xl bg-slate-900 text-white px-6 py-4 text-center shadow-lg max-w-xs">
            <p className="text-base font-bold">{center.label}</p>
            {center.detail && <p className="mt-1 text-xs text-slate-400">{center.detail}</p>}
          </div>
        </div>

        {/* Connection lines */}
        <div className="flex justify-center mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-3xl">
            {nodes.map((node, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-300" />
                <svg className="h-3 w-3 text-slate-400 -mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
                <div className="w-full rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">{node.label}</p>
                  {node.detail && <p className="mt-1 text-xs text-slate-500">{node.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
