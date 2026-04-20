"use client";
import React from 'react';

export function LogoutScreen() {
    return (
        <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-red-500 mb-4">Session Terminated</h1>
            <p>Your session was securely closed.</p>
        </div>
    );
}
