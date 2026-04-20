"use client";
import React from 'react';

export function ReplayTimeline() {
    return (
        <div className="p-4 border rounded-md font-mono text-xs overflow-y-auto max-h-48">
            <div className="text-zinc-500 mb-2">SESSION REPLAY LOG</div>
            <div className="text-green-400">- SESSION_OPENED</div>
        </div>
    );
}
