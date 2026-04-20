"use client";
import React from 'react';

export function GeoFenceMap() {
    return (
        <div className="p-4 border rounded-md bg-zinc-900 border-zinc-800">
            <h3 className="font-bold text-zinc-300 mb-2">Geo-Anomaly Detection</h3>
            <div className="h-32 bg-zinc-950 rounded flex items-center justify-center text-zinc-600 text-xs text-center p-4">
                Mapbox GL rendering placeholder.<br />MaxMind lookup active.
            </div>
        </div>
    );
}
