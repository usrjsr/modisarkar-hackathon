// Based on your provided Schema
export interface Zone {
    _id: string;
    name: string;
    code: string;
    sizeScore: number;
    densityScore: number; // D
    currentDeployment: number;
    safeThreshold: number;
    zScore: number;
    heatmapColor: 'red' | 'orange' | 'yellow' | 'green';
    centroid: { coordinates: [number, number] }; // [lng, lat]
}

export interface ShiftStatus {
    status: 'Scheduled' | 'Empty' | 'Leave' | 'Fatigue_Warning';
    officerName?: string;
    rank?: string;
}

export interface DailyRoster {
    date: Date;
    shifts: {
        morning: ShiftStatus[];
        evening: ShiftStatus[];
        night: ShiftStatus[];
    };
}