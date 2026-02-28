"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { AlertCircle, MapPin } from "lucide-react"
import dynamic from "next/dynamic"

const MapLocationPicker = dynamic(() => import("@/components/forms/MapLocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] flex items-center justify-center bg-surface border border-border rounded-md">
      <div className="flex items-center gap-2">
        <span className="status-dot-pulse bg-primary" />
        <span className="mono-data">LOADING MAP...</span>
      </div>
    </div>
  ),
})

const zoneSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().length(3, "Code must be exactly 3 characters (e.g., Z01)"),
  sizeScore: z.number().min(1).max(10),
  densityScore: z.number().min(1).max(10),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isActive: z.boolean(),
})

type ZoneFormValues = z.infer<typeof zoneSchema>

export default function ZoneConfigForm({
  defaultValues,
  onSubmit: onSubmitCallback,
}: {
  defaultValues?: Partial<ZoneFormValues>
  onSubmit?: (data: ZoneFormValues) => void
}) {
  const initialValues: ZoneFormValues = {
    name: defaultValues?.name || "",
    code: defaultValues?.code || "",
    sizeScore: defaultValues?.sizeScore || 5,
    densityScore: defaultValues?.densityScore || 5,
    latitude: defaultValues?.latitude ?? 28.6139,
    longitude: defaultValues?.longitude ?? 77.209,
    isActive: defaultValues?.isActive ?? true,
  }

  const form = useForm({
    resolver: zodResolver(zoneSchema),
    defaultValues: initialValues,
    mode: "onChange",
  })

  function onSubmit(data: ZoneFormValues) {
    if (onSubmitCallback) {
      onSubmitCallback(data)
    } else {
      console.log("Saving Zone:", data)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Zone Name</label>
          <input
            placeholder="North Sector..."
            {...form.register("name")}
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          {form.formState.errors.name && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertCircle className="w-3 h-3 text-danger" />
              <p className="mono-data text-[9px] text-danger">{form.formState.errors.name.message}</p>
            </div>
          )}
        </div>

        <div>
          <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">Zone Code</label>
          <input
            placeholder="Z01"
            {...form.register("code")}
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors uppercase"
            maxLength={3}
          />
          {form.formState.errors.code && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertCircle className="w-3 h-3 text-danger" />
              <p className="mono-data text-[9px] text-danger">{form.formState.errors.code.message}</p>
            </div>
          )}
        </div>
      </div>

      <MapLocationPicker
        latitude={form.getValues("latitude")}
        longitude={form.getValues("longitude")}
        onChange={(lat, lng) => {
          form.setValue("latitude", lat)
          form.setValue("longitude", lng)
        }}
      />

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="mono-data text-[10px] uppercase tracking-widest">Size Score (S)</label>
            <span className="font-display font-bold text-lg text-primary">{form.watch("sizeScore")}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            {...form.register("sizeScore", { valueAsNumber: true })}
            className="w-full h-2 bg-surface-overlay rounded-full appearance-none cursor-pointer accent-primary"
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${((form.watch("sizeScore") - 1) / 9) * 100}%, var(--surface-overlay) ${((form.watch("sizeScore") - 1) / 9) * 100}%, var(--surface-overlay) 100%)`,
            }}
          />
          <p className="mono-data text-[10px] text-muted-foreground mt-2">Geographical area complexity (1-10)</p>
          {form.formState.errors.sizeScore && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertCircle className="w-3 h-3 text-danger" />
              <p className="mono-data text-[9px] text-danger">{form.formState.errors.sizeScore.message}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="mono-data text-[10px] uppercase tracking-widest">Density Score (D)</label>
            <span className="font-display font-bold text-lg text-danger">{form.watch("densityScore")}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            {...form.register("densityScore", { valueAsNumber: true })}
            className="w-full h-2 bg-surface-overlay rounded-full appearance-none cursor-pointer accent-danger"
            style={{
              background: `linear-gradient(to right, var(--danger) 0%, var(--danger) ${((form.watch("densityScore") - 1) / 9) * 100}%, var(--surface-overlay) ${((form.watch("densityScore") - 1) / 9) * 100}%, var(--surface-overlay) 100%)`,
            }}
          />
          <p className="mono-data text-[10px] text-muted-foreground mt-2">Population density and threat level (1-10)</p>
          {form.formState.errors.densityScore && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertCircle className="w-3 h-3 text-danger" />
              <p className="mono-data text-[9px] text-danger">{form.formState.errors.densityScore.message}</p>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="w-full flex items-center justify-center py-2.5 bg-success text-success-foreground rounded-md font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        Save Configuration
      </button>
    </form>
  )
}