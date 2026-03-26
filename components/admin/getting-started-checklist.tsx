"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Circle,
  Users,
  Truck,
  Building2,
  Package,
  Settings,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from "lucide-react"

export interface ChecklistState {
  onboardingComplete: boolean
  hasSuppliers: boolean
  hasVehicles: boolean
  hasTeamMembers: boolean
  hasPartsData: boolean
  integrationsConfigured: boolean
}

interface ChecklistItem {
  id: string
  label: string
  description: string
  href: string
  icon: React.ReactNode
  completed: boolean
  priority: "required" | "recommended"
}

export function GettingStartedChecklist({ state }: { state: ChecklistState }) {
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const items: ChecklistItem[] = [
    {
      id: "onboarding",
      label: "Complete account setup",
      description: "Set your timezone, language, and organization branding",
      href: "/admin/settings",
      icon: <Settings className="h-4 w-4" />,
      completed: state.onboardingComplete,
      priority: "required",
    },
    {
      id: "suppliers",
      label: "Add your first supplier",
      description: "Add suppliers so your team can request quotes and place orders",
      href: "/admin/settings",
      icon: <Building2 className="h-4 w-4" />,
      completed: state.hasSuppliers,
      priority: "required",
    },
    {
      id: "vehicles",
      label: "Add vehicles or equipment",
      description: "Register your fleet to track parts, maintenance, and service history",
      href: "/admin/vehicles",
      icon: <Truck className="h-4 w-4" />,
      completed: state.hasVehicles,
      priority: "required",
    },
    {
      id: "team",
      label: "Invite team members",
      description: "Only Managers and Technicians can use AI chat, search parts, and create quote requests",
      href: "/admin/users",
      icon: <Users className="h-4 w-4" />,
      completed: state.hasTeamMembers,
      priority: "required",
    },
    {
      id: "parts",
      label: "Upload parts catalog data",
      description: "Import your parts data (CSV/JSON) to enable AI-powered search across your catalog",
      href: "/admin/data-ingestion",
      icon: <Package className="h-4 w-4" />,
      completed: state.hasPartsData,
      priority: "recommended",
    },
    {
      id: "integrations",
      label: "Configure integrations",
      description: "Set up AI search, vector database, and email integrations for full functionality",
      href: "/admin/settings",
      icon: <Sparkles className="h-4 w-4" />,
      completed: state.integrationsConfigured,
      priority: "recommended",
    },
  ]

  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)
  const allComplete = completedCount === totalCount

  if (dismissed || allComplete) return null

  return (
    <Card className="border-purple-200 dark:border-purple-800 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Get started with PartsIQ</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {completedCount} of {totalCount} steps complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2 mt-3" />
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0 space-y-4">
          {/* Role explainer */}
          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Your role as Admin:</strong> You manage users, vehicles, suppliers, and settings.
              Invite <strong>Managers</strong> or <strong>Technicians</strong> to handle quote requests, parts search, and orders.
            </p>
          </div>

          {/* Checklist items */}
          <div className="space-y-1">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  item.completed
                    ? "opacity-60"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                {!item.completed && item.priority === "required" && (
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 shrink-0">
                    Required
                  </span>
                )}
              </Link>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
