"use client";
import React from 'react';

export function RiskAdaptivePanel() {
    return (
        <div className="p-4 border border-zinc-800 rounded-md">
            <h3 className="font-bold mb-2">Risk Drivers</h3>
            <ul className="text-sm space-y-1">
                <li>Trusted Device (-45s)</li>
            </ul>
        </div>
    );
}
