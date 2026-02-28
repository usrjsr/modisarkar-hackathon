"use client"

import Link from "next/link"
import { ShieldCheck, Activity, Users, Map, ArrowRight, Radio } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="w-full border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="font-display text-xl md:text-2xl font-bold flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-sm">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span>SENTINEL</span>
          </h1>

          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Radio className="w-3.5 h-3.5" />
            Access Control System
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center w-full">
          <div className="space-y-7 text-center lg:text-left">
            <div>
              <p className="mono-data text-[10px] uppercase tracking-widest mb-2 text-primary">
                Control & Command Platform
              </p>
              <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-foreground">
                Police Force
                <span className="text-primary block">Deployment Control</span>
              </h2>
            </div>

            <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Operation Sentinel enables centralized monitoring, dynamic personnel deployment, fatigue-aware scheduling, and
              real-time incident response across large-scale events and city-wide operations.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Enter Control Room
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#features"
                className="flex items-center justify-center px-6 py-3 rounded-md border border-border bg-surface hover:bg-surface-raised transition-colors font-semibold text-sm"
              >
                Learn Capabilities
              </a>
            </div>
          </div>

          <div className="hidden lg:flex justify-center items-center">
            <div className="relative w-80 h-80 rounded-lg border border-border bg-surface-raised flex items-center justify-center shadow-lg">
              <div className="absolute inset-0 rounded-lg border border-primary/20 animate-pulse" />
              <ShieldCheck size={140} className="text-primary opacity-60" />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6 bg-surface-overlay border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="tag-primary">CAPABILITIES</span>
            <h3 className="font-display text-4xl font-bold mt-3 text-foreground">Control System Features</h3>
            <p className="mono-data text-[11px] mt-2 text-muted-foreground">Unified command and operational intelligence</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FeatureCard
              icon={Map}
              title="Zone Intelligence"
              desc="Real-time threat heatmaps and geospatial deployment visualization."
              accent="primary"
            />

            <FeatureCard
              icon={Users}
              title="Personnel Management"
              desc="Fatigue-aware officer allocation and hierarchy enforcement."
              accent="success"
            />

            <FeatureCard
              icon={Activity}
              title="Incident Response"
              desc="Dynamic redistribution using adjacency & reserve pooling."
              accent="warning"
            />

            <FeatureCard
              icon={ShieldCheck}
              title="Central Command"
              desc="Unified control dashboard for macro & micro scale operations."
              accent="accent"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center">
        <p className="mono-data text-[10px]">
          © {new Date().getFullYear()} OPERATION SENTINEL • CONTROL ROOM SYSTEM
        </p>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: React.ElementType
  title: string
  desc: string
  accent: "primary" | "success" | "warning" | "accent"
}) {
  const accentMap = {
    primary: { bg: "bg-primary-muted", text: "text-primary", border: "border-primary" },
    success: { bg: "bg-success-muted", text: "text-success", border: "border-success" },
    warning: { bg: "bg-warning-muted", text: "text-warning", border: "border-warning" },
    accent: { bg: "bg-accent/10", text: "text-accent", border: "border-accent" },
  }

  const colors = accentMap[accent]

  return (
    <div className={`sentinel-card border-l-4 ${colors.border} p-5 space-y-3 group hover:border-border-strong transition-colors duration-150`}>
      <div className={`w-10 h-10 flex items-center justify-center rounded-md ${colors.bg} ${colors.text}`}>
        <Icon className="w-5 h-5" />
      </div>

      <h4 className="font-display font-semibold text-sm text-foreground">{title}</h4>

      <p className="mono-data text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}