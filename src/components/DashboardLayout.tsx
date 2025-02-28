"use client"

import { Button } from "@/components/ui/button"
import { FileText, LayoutDashboard, LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter, usePathname } from "next/navigation"

interface NavItemProps {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}

function NavItem({ href, icon, children }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
    <Button 
      variant={isActive ? "secondary" : "ghost"} 
      className="w-full justify-start"
      asChild
    >
      <Link href={href} className="flex items-center gap-2">
        {icon}
        <span>{children}</span>
      </Link>
    </Button>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="grid lg:grid-cols-[240px_1fr]">
        {/* Side Navigation */}
        <aside className="border-r bg-card/50">
          <div className="flex h-16 items-center border-b px-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <FileText className="h-5 w-5" />
              <span>TrendAware</span>
            </Link>
          </div>
          
          <div className="flex flex-col gap-1 p-4">
            <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
              Dashboard
            </NavItem>
            <NavItem href="/research" icon={<FileText className="h-4 w-4" />}>
              Research
            </NavItem>
            <NavItem href="/profile" icon={<User className="h-4 w-4" />}>
              Profile
            </NavItem>
            <NavItem href="/settings" icon={<Settings className="h-4 w-4" />}>
              Settings
            </NavItem>
          </div>
          
          <div className="mt-auto p-4">
            <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
} 