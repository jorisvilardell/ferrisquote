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
} from "@/components/ui/sidebar"
import { FileText, LayoutDashboard, Settings } from "lucide-react"
import { Link, useLocation } from "react-router"
import logo from "@/assets/logo.png"

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Quotes", url: "/quotes", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
]

export function NavSidebar() {
  const location = useLocation()

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={logo} alt="FerrisQuote" className="h-9 w-9 shrink-0" />
          <span className="text-lg font-bold text-sidebar-primary leading-tight">
            FerrisQuote
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
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

      <SidebarFooter className="p-4">
        <span className="text-xs text-muted-foreground">v0.0.0</span>
      </SidebarFooter>
    </Sidebar>
  )
}
