import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NavSidebar } from "./nav-sidebar"
import { RightSidebar } from "./right-sidebar"

interface LayoutProps {
  children: React.ReactNode
  rightSidebar?: React.ReactNode
}

export function Layout({ children, rightSidebar }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <NavSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
            {rightSidebar && <RightSidebar>{rightSidebar}</RightSidebar>}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
