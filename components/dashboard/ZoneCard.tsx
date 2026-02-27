import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ShieldAlert } from "lucide-react";
import FatigueIndicator from "./FatigueIndicator";
import { Zone } from "@/lib/types/dashboard";

interface ZoneCardProps {
    zone: Zone;
    onClick?: () => void;
}

export default function ZoneCard({ zone, onClick }: ZoneCardProps) {
    const colorMap = {
        red: "border-l-red-500 bg-red-50/50",
        orange: "border-l-orange-500 bg-orange-50/50",
        yellow: "border-l-yellow-500 bg-yellow-50/50",
        green: "border-l-green-500 bg-green-50/50",
    };

    return (
        <Card
            className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${colorMap[zone.heatmapColor]}`}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {zone.name}
                </CardTitle>
                <Badge variant={zone.currentDeployment < zone.safeThreshold ? "destructive" : "outline"}>
                    Z-Score: {zone.zScore.toFixed(2)}
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> Strength
                        </p>
                        <p className="text-lg font-bold">
                            {zone.currentDeployment} <span className="text-xs font-normal text-muted-foreground">/ {zone.safeThreshold}</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> Density (D)
                        </p>
                        <p className="text-lg font-bold">{zone.densityScore}</p>
                    </div>
                </div>
                <FatigueIndicator score={5.5} />
            </CardContent>
        </Card>
    );
}