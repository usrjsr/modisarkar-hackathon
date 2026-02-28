"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Settings, AlertCircle } from "lucide-react"

const settingsSchema = z.object({
  totalForce: z.coerce.number().min(1),
  standbyPercentage: z.coerce.number().min(0).max(100),
  weightSize: z.coerce.number().min(0).max(1),
  weightDensity: z.coerce.number().min(0).max(1),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

export default function SystemSettingsForm() {
  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      totalForce: 5000,
      standbyPercentage: 15,
      weightSize: 0.3,
      weightDensity: 0.7,
    },
    mode: "onChange",
  })

  const onSubmit = (data: SettingsFormValues) => {
    const sum = parseFloat((data.weightSize + data.weightDensity).toFixed(1))
    if (sum !== 1.0) {
      form.setError("weightSize", { message: "Weights must sum to 1.0" })
      form.setError("weightDensity", { message: "Weights must sum to 1.0" })
      return
    }
    console.log("System Config:", data)
  }

  return (
    <div className="sentinel-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <span className="font-display font-semibold text-sm text-foreground">Global System Parameters</span>
      </div>

      <div className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
                Total Available Force (F)
              </label>
              <input
                type="number"
                placeholder="5000"
                {...form.register("totalForce")}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <p className="mono-data text-[10px] text-muted-foreground mt-1">Total personnel count</p>
              {form.formState.errors.totalForce && (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3 h-3 text-danger" />
                  <p className="mono-data text-[9px] text-danger">{form.formState.errors.totalForce.message}</p>
                </div>
              )}
            </div>

            <div>
              <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
                Standby Reserve (%)
              </label>
              <input
                type="number"
                placeholder="15"
                {...form.register("standbyPercentage")}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <p className="mono-data text-[10px] text-muted-foreground mt-1">Percentage in reserve</p>
              {form.formState.errors.standbyPercentage && (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3 h-3 text-danger" />
                  <p className="mono-data text-[9px] text-danger">{form.formState.errors.standbyPercentage.message}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="mono-data text-[10px] uppercase tracking-widest mb-4">Z-Score Weights</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
                  Size Weight (W_s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  max="1"
                  {...form.register("weightSize")}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                {form.formState.errors.weightSize && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3 h-3 text-danger" />
                    <p className="mono-data text-[9px] text-danger">{form.formState.errors.weightSize.message}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
                  Density Weight (W_d)
                </label>
                <input
                  type="number"
                  step="0.1"
                  max="1"
                  {...form.register("weightDensity")}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
                {form.formState.errors.weightDensity && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3 h-3 text-danger" />
                    <p className="mono-data text-[9px] text-danger">{form.formState.errors.weightDensity.message}</p>
                  </div>
                )}
              </div>
            </div>

            <p className="mono-data text-[10px] text-muted-foreground mt-3">Weights must sum to 1.0</p>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center py-2.5 bg-danger text-danger-foreground rounded-md font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Update Algorithm Parameters
          </button>
        </form>
      </div>
    </div>
  )
}