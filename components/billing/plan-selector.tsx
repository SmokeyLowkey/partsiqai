"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Plan {
  id: string
  name: string
  price: number
  description: string
  features: string[]
  maxUsers: number
  maxVehicles: number
  popular?: boolean
}

const plans: Plan[] = [
  {
    id: "BASIC",
    name: "Basic",
    price: 99,
    description: "Perfect for small fleets",
    maxUsers: 10,
    maxVehicles: 50,
    features: [
      "Up to 10 users",
      "Up to 50 vehicles",
      "AI-powered parts search",
      "Basic reporting",
      "Email support",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    price: 299,
    description: "For growing operations",
    maxUsers: 50,
    maxVehicles: 200,
    popular: true,
    features: [
      "Up to 50 users",
      "Up to 200 vehicles",
      "AI-powered parts search",
      "Advanced analytics",
      "Supplier integrations",
      "Priority support",
      "Custom workflows",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 799,
    description: "For large organizations",
    maxUsers: 9999,
    maxVehicles: 9999,
    features: [
      "Unlimited users",
      "Unlimited vehicles",
      "AI-powered parts search",
      "Advanced analytics",
      "Supplier integrations",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "On-premise option",
    ],
  },
]

interface PlanSelectorProps {
  currentPlan: string
  onSelectPlan: (planId: string) => void
  isLoading?: boolean
}

export function PlanSelector({ currentPlan, onSelectPlan, isLoading }: PlanSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Choose Your Plan</h2>
        <p className="text-muted-foreground mt-1">
          All plans include a 14-day free trial
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative",
                plan.popular && "border-primary shadow-lg",
                isCurrentPlan && "ring-2 ring-primary"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1 bg-primary">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="text-center">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "outline"}
                  disabled={isCurrentPlan || isLoading}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  {isCurrentPlan ? "Current Plan" : `Select ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
