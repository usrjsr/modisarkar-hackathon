"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

import dynamic from "next/dynamic";

const MapLocationPicker = dynamic(() => import("@/components/forms/MapLocationPicker"), {
    ssr: false,
    loading: () => <div className="h-[220px] flex items-center justify-center bg-gray-100 rounded-lg"><p className="text-gray-500">Loading map...</p></div>
});

// 1. Schema: Removed .default(true) to keep input/output types identical (strict boolean)
const zoneSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    code: z.string().length(3, "Code must be exactly 3 characters (e.g., Z01)"),
    sizeScore: z.number().min(1).max(10),
    densityScore: z.number().min(1).max(10),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isActive: z.boolean(),
});

type ZoneFormValues = z.infer<typeof zoneSchema>;

export default function ZoneConfigForm({ defaultValues, onSubmit: onSubmitCallback }: { defaultValues?: Partial<ZoneFormValues>; onSubmit?: (data: ZoneFormValues) => void }) {

    const initialValues: ZoneFormValues = {
        name: defaultValues?.name || "",
        code: defaultValues?.code || "",
        sizeScore: defaultValues?.sizeScore || 5,
        densityScore: defaultValues?.densityScore || 5,
        latitude: defaultValues?.latitude ?? 28.6139,
        longitude: defaultValues?.longitude ?? 77.2090,
        isActive: defaultValues?.isActive ?? true,
    };

    const form = useForm({
        resolver: zodResolver(zoneSchema),
        defaultValues: initialValues,
        mode: "onChange",
    });

    function onSubmit(data: ZoneFormValues) {
        if (onSubmitCallback) {
            onSubmitCallback(data);
        } else {
            console.log("Saving Zone:", data);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Zone Name</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="North Sector..."
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Zone Code</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Z01"
                                        {...field}
                                        className="uppercase"
                                        maxLength={3}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <MapLocationPicker
                    latitude={form.getValues("latitude")}
                    longitude={form.getValues("longitude")}
                    onChange={(lat, lng) => {
                        form.setValue("latitude", lat)
                        form.setValue("longitude", lng)
                    }}
                />

                {/* Size Score Slider */}
                <FormField
                    control={form.control}
                    name="sizeScore"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel>Size Score (S)</FormLabel>
                                <span className="text-sm font-bold text-blue-600">{field.value}</span>
                            </div>
                            <FormControl>
                                <Slider
                                    min={1}
                                    max={10}
                                    step={1}
                                    defaultValue={[field.value]}
                                    // Added ": number[]" to fix the error
                                    onValueChange={(vals: number[]) => field.onChange(vals[0])}
                                />
                            </FormControl>
                            <FormDescription>Geographical area complexity (1-10).</FormDescription>
                        </FormItem>
                    )}
                />
                {/* Density Score Slider */}
                {/* Density Score Slider */}
                <FormField
                    control={form.control}
                    name="densityScore"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel>Density Score (D)</FormLabel>
                                <span className="text-sm font-bold text-red-600">{field.value}</span>
                            </div>
                            <FormControl>
                                <Slider
                                    min={1}
                                    max={10}
                                    step={1}
                                    defaultValue={[field.value]}
                                    // FIX: Add ": number[]" type annotation here
                                    onValueChange={(vals: number[]) => field.onChange(vals[0])}
                                />
                            </FormControl>
                            <FormDescription>Population density and threat level (1-10).</FormDescription>
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full">Save Configuration</Button>
            </form>
        </Form>
    );
}