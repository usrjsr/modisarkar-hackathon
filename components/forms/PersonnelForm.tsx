"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Users, AlertCircle } from "lucide-react"

const RANKS = ["DGP", "ADGP", "IG", "DIG", "SP", "DSP", "Inspector", "SI", "Constable"] as const

const personnelSchema = z.object({
  name: z.string().min(2, "Name is required"),
  badgeNumber: z.string().min(3, "Badge number is required"),
  rank: z.enum(RANKS),
  homeZone: z.string().optional(),
})

type PersonnelFormValues = z.infer<typeof personnelSchema>

export default function PersonnelForm() {
  const form = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: { name: "", badgeNumber: "", rank: "Constable" },
  })

  const onSubmit = (data: PersonnelFormValues) => {
    console.log("Personnel Data:", data)
  }

  return (
    <div className="sentinel-card max-w-xl mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="font-display font-semibold text-sm text-foreground">Officer Profile</span>
      </div>

      <div className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
              Full Name
            </label>
            <input
              placeholder="Officer Name"
              {...form.register("name")}
              className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
            {form.formState.errors.name && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-danger" />
                <p className="mono-data text-[10px] text-danger">{form.formState.errors.name.message}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
                Badge #
              </label>
              <input
                placeholder="KA-2041"
                {...form.register("badgeNumber")}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              {form.formState.errors.badgeNumber && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AlertCircle className="w-3 h-3 text-danger" />
                  <p className="mono-data text-[9px] text-danger">{form.formState.errors.badgeNumber.message}</p>
                </div>
              )}
            </div>

            <div>
              <label className="mono-data text-[10px] uppercase tracking-widest block mb-2">
                Rank
              </label>
              <select
                {...form.register("rank")}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              >
                {RANKS.map(rank => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
              {form.formState.errors.rank && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AlertCircle className="w-3 h-3 text-danger" />
                  <p className="mono-data text-[9px] text-danger">{form.formState.errors.rank.message}</p>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center py-2.5 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Create Profile
          </button>
        </form>
      </div>
    </div>
  )
}