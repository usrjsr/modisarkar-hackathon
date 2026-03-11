"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, AlertCircle, LogIn, RefreshCw } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (!res?.error) {
      router.push("/dashboard")
    } else {
      setError("Invalid credentials. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(59, 130, 246, 0.1) 35px, rgba(59, 130, 246, 0.1) 70px)",
      }} />

      <div className="relative w-full max-w-md">
        <div className="sentinel-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-raised flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-sm">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h2 className="font-display font-bold text-sm text-foreground">Operation Sentinel</h2>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-5">
            <div className="space-y-1">
              <span className="mono-data text-[10px] uppercase tracking-widest">Access Control</span>
              <h1 className="font-display text-2xl font-bold text-foreground">Control Room Login</h1>
            </div>

            {error && (
              <div className="sentinel-card border-l-4 border-l-danger bg-danger-muted p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <p className="mono-data text-[10px] text-danger">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="mono-data text-[10px] uppercase tracking-widest block">Email Address(Testing Email:admin@sentinel.local)</label>
              <input
                type="email"
                placeholder="admin@sentinel.local"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="mono-data text-[10px] uppercase tracking-widest block">Password(Testing Password:admin123)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={`
                w-full flex items-center justify-center gap-2 py-2.5 rounded-md font-semibold text-sm
                transition-all duration-150
                ${
                  loading || !email || !password
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }
              `}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Authenticate Access
                </>
              )}
            </button>

            <div className="pt-3 border-t border-border">
              <p className="mono-data text-[10px] text-muted-foreground text-center">
                Demo credentials: admin / password
              </p>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="mono-data text-[10px] text-muted-foreground">
            Operation Sentinel Control Room System
          </p>
        </div>
      </div>
    </div>
  )
}
