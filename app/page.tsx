"use client"

import Link from "next/link"
import { ShieldCheck, Activity, Users, Map, ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ================= NAVBAR ================= */}
      <header className="w-full border-b bg-background/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Operation Sentinel
          </h1>

          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Enter Control System
          </Link>

        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="flex-1 flex items-center justify-center px-6">

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">

          {/* LEFT */}
          <div className="space-y-6 text-center lg:text-left">

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Intelligent Police
              <span className="text-primary block">
                Deployment Control Room
              </span>
            </h2>

            <p className="text-muted-foreground text-lg max-w-xl mx-auto lg:mx-0">
              Operation Sentinel enables centralized monitoring,
              dynamic personnel deployment, fatigue-aware scheduling,
              and real-time incident response across large-scale events
              and city-wide operations.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
              >
                Enter Control Room
                <ArrowRight size={18} />
              </Link>

              <a
                href="#features"
                className="px-6 py-3 rounded-xl border hover:bg-muted transition"
              >
                Learn More
              </a>

            </div>
          </div>

          {/* RIGHT VISUAL */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-[420px] h-[420px] rounded-2xl border bg-card shadow-xl flex items-center justify-center">
              <ShieldCheck size={120} className="text-primary opacity-80" />
            </div>
          </div>

        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section
        id="features"
        className="py-20 px-6 bg-muted/30"
      >
        <div className="max-w-7xl mx-auto">

          <h3 className="text-3xl font-bold text-center mb-14">
            Control System Capabilities
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">

            <FeatureCard
              icon={<Map />}
              title="Zone Intelligence"
              desc="Real-time threat heatmaps and geospatial deployment visualization."
            />

            <FeatureCard
              icon={<Users />}
              title="Personnel Management"
              desc="Fatigue-aware officer allocation and hierarchy enforcement."
            />

            <FeatureCard
              icon={<Activity />}
              title="Incident Response"
              desc="Dynamic redistribution using adjacency & reserve pooling."
            />

            <FeatureCard
              icon={<ShieldCheck />}
              title="Central Command"
              desc="Unified control dashboard for macro & micro scale operations."
            />

          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Operation Sentinel • Control Room System
      </footer>

    </main>
  )
}


/* ================= FEATURE CARD ================= */

function FeatureCard({
  icon,
  title,
  desc
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="p-6 rounded-xl border bg-card hover:shadow-lg transition space-y-4">

      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>

      <h4 className="font-semibold text-lg">{title}</h4>

      <p className="text-sm text-muted-foreground">
        {desc}
      </p>

    </div>
  )
}