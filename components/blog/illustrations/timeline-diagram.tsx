interface TimelineEvent {
  label: string
  detail?: string
  time?: string
}

export function TimelineDiagram(props: {
  title?: string
  events?: TimelineEvent[] | string
  color?: "emerald" | "blue" | "violet"
}) {
  const title = props.title
  const color = props.color || "emerald"
  const events: TimelineEvent[] = typeof props.events === "string" ? JSON.parse(props.events) : props.events || []
  const colors = {
    emerald: { dot: "bg-emerald-500", line: "bg-emerald-200", text: "text-emerald-700", timeBg: "bg-emerald-50 text-emerald-600" },
    blue: { dot: "bg-blue-500", line: "bg-blue-200", text: "text-blue-700", timeBg: "bg-blue-50 text-blue-600" },
    violet: { dot: "bg-violet-500", line: "bg-violet-200", text: "text-violet-700", timeBg: "bg-violet-50 text-violet-600" },
  }
  const c = colors[color]

  return (
    <div className="not-prose my-10">
      {title && (
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="relative">
          {events.map((event, i) => (
            <div key={i} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={`h-4 w-4 rounded-full ${c.dot} shrink-0 ring-4 ring-white`} />
                {i < events.length - 1 && <div className={`w-0.5 flex-1 ${c.line}`} />}
              </div>
              <div className="pb-2">
                {event.time && (
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${c.timeBg}`}>
                    {event.time}
                  </span>
                )}
                <p className={`text-sm font-semibold ${c.text}`}>{event.label}</p>
                {event.detail && <p className="mt-0.5 text-xs text-slate-500">{event.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
