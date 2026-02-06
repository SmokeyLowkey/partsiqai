"use client"

import { usePathname } from "next/navigation"

const steps = [
  { path: "/onboarding/welcome", label: "Welcome" },
  { path: "/onboarding/organization", label: "Organization" },
]

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentStepIndex = steps.findIndex(step => pathname.startsWith(step.path))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.path} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      index <= currentStepIndex
                        ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-sm mt-2 font-medium ${
                      index <= currentStepIndex ? "text-purple-600" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-4 rounded transition-colors ${
                      index < currentStepIndex
                        ? "bg-gradient-to-r from-purple-600 to-cyan-600"
                        : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  )
}
