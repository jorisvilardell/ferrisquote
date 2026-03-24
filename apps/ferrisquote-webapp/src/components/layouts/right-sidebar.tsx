interface RightSidebarProps {
  children: React.ReactNode
}

export function RightSidebar({ children }: RightSidebarProps) {
  return (
    <aside className="w-72 shrink-0 border-l bg-sidebar overflow-y-auto">
      <div className="p-4">{children}</div>
    </aside>
  )
}
