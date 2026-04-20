"use client";
import React from 'react';

export function WarningModal({ isOpen, onExtend, onLogout }: any) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white p-6 rounded text-black">
                <h2 className="text-xl font-bold mb-4">Session Expiring Soon</h2>
                <p>Your session will end due to inactivity or adaptive risk policy.</p>
                <div className="mt-6 flex space-x-4">
                    <button onClick={onExtend} className="bg-blue-600 text-white px-4 py-2 rounded">Extend Session</button>
                    <button onClick={onLogout} className="bg-red-600 text-white px-4 py-2 rounded">Logout immediately</button>
                </div>
            </div>
        </div>
    );
}
