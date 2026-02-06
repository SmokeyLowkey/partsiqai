"use client"

import { signOut, useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LayoutDashboard, Bot, ShoppingCart, MessageSquare, Package, LogOut, Sparkles, Building2, Truck, FileText, User, CreditCard, PiggyBank } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LucideIcon } from "lucide-react"

interface MenuItem {
  title: string
  url: string
  icon: LucideIcon
  adminOnly?: boolean
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/customer/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "AI Assistant",
    url: "/customer/ai-chat",
    icon: Bot,
  },
]

const orderingItems: MenuItem[] = [
  {
    title: "Quote Requests",
    url: "/customer/quote-requests",
    icon: FileText,
  },
  {
    title: "Orders",
    url: "/customer/orders",
    icon: ShoppingCart,
  },
  {
    title: "Parts Catalog",
    url: "/customer/catalog",
    icon: Package,
  },
]

const managementItems: MenuItem[] = [
  {
    title: "Suppliers",
    url: "/customer/suppliers",
    icon: Building2,
  },
  {
    title: "Vehicles",
    url: "/customer/vehicles",
    icon: Truck,
  },
  {
    title: "Cost Savings",
    url: "/customer/cost-savings",
    icon: PiggyBank,
  },
  {
    title: "Billing",
    url: "/customer/billing",
    icon: CreditCard,
    adminOnly: true,
  },
]

export function CustomerSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)

  const userRole = session?.user?.role
  const canApprove = userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'MASTER_ADMIN'

  const getUserInitials = (name?: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  useEffect(() => {
    if (canApprove) {
      fetch('/api/quote-requests/pending-approvals/count')
        .then(res => res.json())
        .then(data => setPendingApprovalsCount(data.count || 0))
        .catch(console.error)
    }
  }, [canApprove, pathname])

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-4 group-data-[collapsible=icon]:px-0">
          <Sparkles className="h-8 w-8 text-green-600 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6" />
          <span className="font-semibold ml-2 group-data-[collapsible=icon]:hidden">PartsIQ AI</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:overflow-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Ordering</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orderingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                      {item.title === 'Quote Requests' && canApprove && pendingApprovalsCount > 0 && (
                        <Badge className="ml-auto bg-amber-500 text-white hover:bg-amber-600">
                          {pendingApprovalsCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems
                .filter((item) => !item.adminOnly || userRole === 'ADMIN' || userRole === 'MASTER_ADMIN')
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {session?.user && (
            <SidebarMenuItem>
              <div className="flex items-center gap-3 px-2 py-3 group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 border-2 border-green-500/20">
                  <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                  <AvatarFallback className="bg-gradient-to-br from-green-500 to-cyan-600 text-white text-sm font-medium">
                    {getUserInitials(session.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-medium text-foreground truncate">
                    {session.user.name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </span>
                </div>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
