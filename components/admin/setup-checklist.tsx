"use client"

import Link from "next/link"
import { Check, ChevronRight, Truck, Upload, Users, MessageSquare, Package } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface SetupStep {
  id: string
  title: string
  description: string
  href: string
  completed: boolean
  icon: React.ReactNode
}

interface SetupChecklistProps {
  steps: SetupStep[]
  organizationName: string
}

export function SetupChecklist({ steps, organizationName }: SetupChecklistProps) {
  const completedCount = steps.filter((s) => s.completed).length
  const totalCount = steps.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)
  const allDone = completedCount === totalCount

  if (allDone) return null

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/30 dark:to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Get started with PartsIQ</CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to set up {organizationName} and start searching for parts.
            </CardDescription>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {completedCount}/{totalCount} complete
          </span>
        </div>
        <Progress value={progressPercent} className="h-2 mt-3" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 transition-colors",
                step.completed
                  ? "opacity-60"
                  : "hover:bg-accent"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                  step.completed
                    ? "border-green-500 bg-green-500 text-white dark:border-green-400 dark:bg-green-400 dark:text-green-950"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {step.completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.completed && "line-through text-muted-foreground"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function buildSetupSteps(counts: {
  vehicles: number
  ingestionJobs: number
  suppliers: number
  invitations: number
  conversations: number
}): SetupStep[] {
  return [
    {
      id: "vehicle",
      title: "Add your first vehicle",
      description: "Register your equipment to enable parts search",
      href: "/admin/vehicles",
      completed: counts.vehicles > 0,
      icon: <Truck className="h-4 w-4" />,
    },
    {
      id: "ingestion",
      title: "Upload a parts catalog",
      description: "Import parts data so your team can search and order",
      href: "/admin/data-ingestion",
      completed: counts.ingestionJobs > 0,
      icon: <Upload className="h-4 w-4" />,
    },
    {
      id: "supplier",
      title: "Add a supplier",
      description: "Connect suppliers to start requesting quotes",
      href: "/admin/suppliers",
      completed: counts.suppliers > 0,
      icon: <Package className="h-4 w-4" />,
    },
    {
      id: "invite",
      title: "Invite a team member",
      description: "Bring your technicians and managers on board",
      href: "/admin/users",
      completed: counts.invitations > 0,
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "search",
      title: "Try your first search",
      description: "Use AI chat to find parts for your equipment",
      href: "/customer/ai-chat",
      completed: counts.conversations > 0,
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ]
}
