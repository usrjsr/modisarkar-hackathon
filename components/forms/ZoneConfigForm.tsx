"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 1. Schema: Removed .default(true) to keep input/output types identical (strict boolean)
const zoneSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    code: z.string().length(3, "Code must be exactly 3 characters (e.g., Z01)"),
    sizeScore: z.number().min(1).max(10),
    densityScore: z.number().min(1).max(10),
    isActive: z.boolean(), // Strictly boolean
});

type ZoneFormValues = z.infer<typeof zoneSchema>;

export default function ZoneConfigForm({ defaultValues }: { defaultValues?: Partial<ZoneFormValues> }) {

    // 2. Handle defaults here explicitly to ensure no field is undefined
    const initialValues: ZoneFormValues = {
        name: defaultValues?.name || "",
        code: defaultValues?.code || "",
        sizeScore: defaultValues?.sizeScore || 5,
        densityScore: defaultValues?.densityScore || 5,
        isActive: defaultValues?.isActive ?? true, // Default logic moved here
    };

    // 3. Removed generic <ZoneFormValues> to let types infer correctly
    const form = useForm({
        resolver: zodResolver(zoneSchema),
        defaultValues: initialValues,
        mode: "onChange",
    });

    function onSubmit(data: ZoneFormValues) {
        console.log("Saving Zone:", data);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Zone Configuration</CardTitle>
            </CardHeader>
            <CardContent>
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
                                            // FIX: Add ": number[]" type annotation here
                                            onValueChange={(vals: number[]) => field.onChange(vals[0])}
                                        />
                                    </FormControl>
                                    <FormDescription>Geographical area complexity (1-10).</FormDescription>
                                </FormItem>
                            )}
                        />

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
            </CardContent>
        </Card>
    );
}