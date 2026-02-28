"use client"

import Link from "next/link"
import { ChevronLeft, Zap, Rocket, Terminal, Code, Cpu, Globe, Award, Sparkles } from "lucide-react"

export default function OjassEasterEggPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-primary/30 relative overflow-hidden">
            {/* Dynamic Backgrounds */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] mix-blend-screen animate-pulse duration-[4000ms]" />
                <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] rounded-full bg-accent/20 blur-[150px] mix-blend-screen animate-pulse duration-[5000ms]" />

                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 min-h-screen flex flex-col">

                {/* Header Link */}
                <div className="flex items-center justify-between mb-8 md:mb-16 animate-fade-in w-full">
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface hover:bg-surface-raised hover:text-primary transition-colors text-sm font-medium z-50">
                        <ChevronLeft className="w-4 h-4" /> Return to Base
                    </Link>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-warning/30 bg-warning/10 animate-bounce">
                        <Zap className="w-3.5 h-3.5 text-warning" />
                        <span className="text-[10px] font-mono text-warning uppercase tracking-widest font-bold">Easter Egg Unlocked</span>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">

                    <div className="animate-slide-in-up space-y-8 flex flex-col items-center">

                        {/* Pulsing Logo Sphere */}
                        <div className="relative w-48 h-48 md:w-64 md:h-64 mb-8">
                            <div className="absolute inset-0 border-2 border-primary/30 rounded-full animate-[spin_10s_linear_infinite]" />
                            <div className="absolute inset-4 border border-accent/40 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                            <div className="absolute inset-8 border border-warning/50 rounded-full animate-ping duration-[3000ms] opacity-20" />

                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 rounded-full backdrop-blur-sm border border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.3)]">
                                <span className="font-display text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-warning">
                                    O'26
                                </span>
                            </div>
                        </div>

                        {/* Titles */}
                        <div className="space-y-4">
                            <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-mono text-sm tracking-widest mb-4 font-bold shadow-[0_0_20px_rgba(var(--primary),0.2)]">
                                <Sparkles className="w-4 h-4" />
                                OFFICIAL SHOUTOUT
                                <Sparkles className="w-4 h-4" />
                            </div>

                            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black text-white tracking-tighter" style={{ textShadow: '0 0 40px rgba(255,255,255,0.1)' }}>
                                OJASS <span className="text-primary">2026</span>
                            </h1>

                            <p className="text-xl md:text-3xl font-medium text-zinc-300 max-w-3xl mx-auto leading-relaxed mt-6">
                                Eastern India's
                                <span className="mx-2 px-3 py-1 rounded-md bg-white/10 italic text-white shadow-xl border border-white/20">Second Largest</span>
                                Techno-Management Fest
                            </p>
                        </div>

                        <p className="text-lg text-muted-foreground font-mono mt-8 mb-12 max-w-2xl">
                            NIT Jamshedpur • Jharkhand • India
                        </p>

                        {/* Feature Cards Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-12">
                            {[
                                { icon: Code, title: "Hackathons", desc: "48 hours of intense coding", color: "text-primary", bg: "bg-primary/5", border: "border-primary/20" },
                                { icon: Cpu, title: "Robotics", desc: "Bots waging absolute war", color: "text-accent", bg: "bg-accent/5", border: "border-accent/20" },
                                { icon: Rocket, title: "Innovation", desc: "Building the future today", color: "text-warning", bg: "bg-warning/5", border: "border-warning/20" },
                                { icon: Globe, title: "Events", desc: "50+ technical events", color: "text-success", bg: "bg-success/5", border: "border-success/20" }
                            ].map((item, idx) => (
                                <div key={idx} className={`p-6 rounded-2xl border ${item.border} ${item.bg} backdrop-blur-md flex flex-col items-center text-center shadow-lg hover:-translate-y-2 transition-transform duration-300`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 border ${item.border} bg-black/50`}>
                                        <item.icon className={`w-6 h-6 ${item.color}`} />
                                    </div>
                                    <h3 className="text-white font-bold font-display mb-1">{item.title}</h3>
                                    <p className="text-xs text-zinc-400">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="mt-20 text-center flex flex-col items-center justify-center gap-4 animate-fade-in opacity-50">
                    <Award className="w-6 h-6 text-zinc-500" />
                    <p className="font-mono text-xs text-zinc-500 max-w-xl">
                        This module was built with high-octane caffeine in preparation for Ojass '26. <br />
                        See you at NIT Jamshedpur.
                    </p>
                </div>
            </div>
        </div>
    )
}
