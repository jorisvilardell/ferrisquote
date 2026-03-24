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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import { ChevronRight, GitBranch, LayoutDashboard, FileText, Settings } from "lucide-react"
import { Link, useLocation } from "react-router"
import logo from "@/assets/logo.png"
import { useFlowStore } from "@/store/flow.store"
import { mockFlowResponse } from "@/pages/flows/feature/flow.mock"
import { FLOW_URL, FLOWS_URL } from "@/routes/sub-router/flow.router"
import { QUOTES_URL } from "@/routes/router"

const DEFAULT_FLOW_ID = mockFlowResponse.data.id

export function NavSidebar() {
  const location = useLocation()
  const quotesOpen = location.pathname.startsWith(QUOTES_URL())
  const lastFlowId = useFlowStore((s) => s.lastFlowId)
  const flowsUrl = FLOW_URL(lastFlowId ?? DEFAULT_FLOW_ID)

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

              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/"}>
                  <Link to="/">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Quotes (collapsible) */}
              <Collapsible defaultOpen={quotesOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={location.pathname === "/quotes"}>
                      <FileText />
                      <span>Quotes</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname.startsWith(FLOWS_URL())}
                        >
                          <Link to={flowsUrl}>
                            <GitBranch />
                            <span>Flows</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Settings */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/settings"}>
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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
