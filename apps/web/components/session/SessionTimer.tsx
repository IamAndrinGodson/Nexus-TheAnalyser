"use client";
import React from 'react';

export function SessionTimer() {
    return (
        <div className="flex items-center space-x-2 p-2 border rounded">
            <span>Session Time Remaining</span>
            <span className="font-mono font-bold">--:--</span>
        </div>
    );
}
