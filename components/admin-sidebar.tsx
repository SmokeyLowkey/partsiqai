"use client"

import { signOut, useSession } from "next-auth/react"
import { useState } from "react"
import { ThemeLogo } from "@/components/theme-logo"
import { ProductTourModal } from "@/components/onboarding/product-tour-modal"
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
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Building2,
  Settings,
  BarChart3,
  MessageSquare,
  Shield,
  LogOut,
  Truck,
  User,
  CreditCard,
  PiggyBank,
  Upload,
  Mail,
  Bot,
  FileText,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

type MenuItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  masterAdminOnly?: boolean
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Analytics",
    url: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Cost Savings",
    url: "/admin/cost-savings",
    icon: PiggyBank,
    masterAdminOnly: true, // App-wide cost savings - MASTER_ADMIN only
  },
]

// Daily-use product features. These live under /customer/* in the URL space
// but admins are full product users (admin role is a superset of customer
// capabilities — see middleware.ts), so we surface the same daily workflow
// links here. Without this section an admin lands on the dashboard and has
// no UI path to the AI Chat / RFQ creation / catalog browsing — the product's
// actual point — and bounces. Match the icons used in CustomerSidebar so the
// experience reads consistently when they cross over to /customer/*.
const workspaceItems: MenuItem[] = [
  {
    title: "AI Assistant",
    url: "/customer/ai-chat",
    icon: Bot,
  },
  {
    title: "Quote Requests",
    url: "/customer/quote-requests",
    icon: FileText,
  },
  {
    title: "Parts Catalog",
    url: "/customer/catalog",
    icon: Package,
  },
  {
    title: "Suppliers",
    url: "/customer/suppliers",
    icon: Building2,
  },
]

const managementItems: MenuItem[] = [
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Tenants",
    url: "/admin/tenants",
    icon: Building2,
    masterAdminOnly: true, // Only MASTER_ADMIN can manage tenants
  },
  {
    title: "Vehicle Config",
    url: "/admin/vehicles",
    icon: Truck,
  },
  {
    title: "Products",
    url: "/admin/products",
    icon: Package,
  },
  {
    title: "Orders",
    url: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Data Ingestion",
    url: "/admin/data-ingestion",
    icon: Upload,
  },
  {
    title: "Communications",
    url: "/admin/communications",
    icon: Mail,
    masterAdminOnly: true,
  },
]

const systemItems: MenuItem[] = [
  {
    title: "Billing",
    url: "/admin/billing",
    icon: CreditCard,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [tourReplayOpen, setTourReplayOpen] = useState(false)

  const isMasterAdmin = session?.user?.role === "MASTER_ADMIN"

  const getUserInitials = (name?: string | null) => {
    if (!name) return "A"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Filter menu items based on user role
  const filterByRole = (items: MenuItem[]) =>
    items.filter((item) => !item.masterAdminOnly || isMasterAdmin)

  const visibleMenuItems = filterByRole(menuItems)
  const visibleWorkspaceItems = filterByRole(workspaceItems)
  const visibleManagementItems = filterByRole(managementItems)
  const visibleSystemItems = filterByRole(systemItems)

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center space-x-2 px-2">
          <ThemeLogo className="h-8 w-8" />
          <div className="flex flex-col">
            <span className="font-semibold">Admin Portal</span>
            {!isMasterAdmin && session?.user?.role && (
              <Badge variant="outline" className="text-xs mt-0.5 w-fit">
                Org Admin
              </Badge>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + "/")}>
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
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleWorkspaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + "/")}>
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
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleManagementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + "/")}>
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
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSystemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith(item.url + "/")}>
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
        {session?.user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3 px-2 py-3 group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 border-2 border-blue-500/20">
                  <AvatarImage src={session.user.image || undefined} alt={session.user.name || "Admin"} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                    {getUserInitials(session.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-medium text-foreground truncate">
                    {session.user.name || "Admin User"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setTourReplayOpen(true)}>
              <Sparkles />
              <span>Replay product tour</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      {/* Replay-tour mount: separate instance from the auto-open one in
          admin/layout.tsx so the footer button can force-open it without
          fighting the localStorage gate. */}
      {tourReplayOpen && (
        <ProductTourModal forceOpen onClose={() => setTourReplayOpen(false)} />
      )}
    </Sidebar>
  )
}
