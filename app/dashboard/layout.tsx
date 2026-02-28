"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Map,
  Users,
  Calendar,
  AlertTriangle,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  Radio,
  Activity,
  LogOut,
  Menu,
  X,
} from "lucide-react"

const NAV_ITEMS = [
  {
    label: "Control Room",
    href: "/dashboard",
    icon: LayoutDashboard,
    tag: null,
  },
  {
    label: "Zone Management",
    href: "/dashboard/zones",
    icon: Map,
    tag: null,
  },
  {
    label: "Roster",
    href: "/dashboard/roster",
    icon: Calendar,
    tag: null,
  },
  {
    label: "Personnel",
    href: "/dashboard/personnel",
    icon: Users,
    tag: null,
  },
  {
    label: "Incidents",
    href: "/dashboard/incidents",
    icon: AlertTriangle,
    tag: "LIVE",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    tag: null,
  },
]

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    const stored = localStorage.getItem("sentinel-theme") as "dark" | "light" | null
    if (stored) setTheme(stored)
  }, [])

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("sentinel-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-surface hover:bg-surface-raised hover:border-border-strong transition-colors duration-150"
      title="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-warning" />
      ) : (
        <Moon className="w-4 h-4 text-primary" />
      )}
    </button>
  )
}

function SystemStatus() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className="status-dot-pulse bg-success" />
      <span className="mono-data text-success">{time}</span>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await signOut({ redirect: true, callbackUrl: "/login" })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:relative z-50 lg:z-auto
          flex flex-col h-full
          bg-sidebar border-r border-border
          transition-all duration-200 ease-in-out
          ${collapsed ? "w-[60px]" : "w-[220px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div
          className={`
            flex items-center h-14 border-b border-border px-3 shrink-0
            ${collapsed ? "justify-center" : "justify-between"}
          `}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center w-7 h-7 bg-primary rounded-sm shrink-0">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-foreground leading-none tracking-tight truncate">
                  SENTINEL
                </p>
                <p className="mono-data text-[10px] leading-none mt-0.5">OPS CONTROL</p>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="flex items-center justify-center w-7 h-7 bg-primary rounded-sm">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`
              hidden lg:flex items-center justify-center w-6 h-6
              rounded-sm border border-border bg-surface
              hover:bg-surface-raised hover:border-border-strong
              transition-colors duration-150 shrink-0
              ${collapsed ? "mt-3" : ""}
            `}
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <p className="mono-data text-[10px] uppercase tracking-widest px-2">Navigation</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, tag }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={`
                  flex items-center gap-3 px-2 py-2 rounded-md
                  transition-colors duration-150 group relative
                  ${collapsed ? "justify-center" : ""}
                  ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  }
                `}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "text-primary-foreground" : ""}`}
                />

                {!collapsed && <span className="text-sm font-medium truncate flex-1">{label}</span>}

                {!collapsed && tag && (
                  <span
                    className={`
                      font-mono text-[9px] font-bold tracking-widest px-1.5 py-0.5
                      rounded-sm border
                      ${
                        active
                          ? "border-primary-foreground/40 text-primary-foreground bg-primary-foreground/10"
                          : "border-danger text-danger bg-danger-muted"
                      }
                    `}
                  >
                    {tag}
                  </span>
                )}

                {collapsed && tag && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger" />}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-2">
          {!collapsed ? (
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary-muted border border-primary/30 shrink-0">
                <span className="font-mono font-bold text-[10px] text-primary">DGP</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground leading-none truncate">Admin User</p>
                <p className="mono-data text-[10px] mt-0.5 truncate">DGP · HQ</p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center w-6 h-6 rounded-sm hover:bg-danger-muted hover:text-danger transition-colors duration-150 text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center w-7 h-7 rounded-sm bg-primary-muted border border-primary/30 hover:bg-danger-muted hover:border-danger transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5 text-primary hover:text-danger" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between h-14 px-4 bg-surface border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex lg:hidden items-center justify-center w-8 h-8 rounded-md border border-border bg-background hover:bg-surface-raised transition-colors"
            >
              <Menu className="w-4 h-4 text-foreground" />
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-success" />
              <SystemStatus />
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded-sm">
              <span className="mono-data text-[10px]">SYSTEM</span>
              <span className="status-dot bg-success w-1.5 h-1.5" />
              <span className="mono-data text-[10px] text-success">ONLINE</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative flex items-center justify-center w-8 h-8 rounded-md border border-border bg-surface hover:bg-surface-raised transition-colors duration-150">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger" />
            </button>

            <ThemeToggle />

            <div className="hidden sm:flex items-center gap-2 px-2 py-1 border border-border rounded-sm bg-background">
              <span className="mono-data text-[10px]">OP-SENTINEL</span>
              <span className="mono-data text-[10px] text-primary">v1.0</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  )
}