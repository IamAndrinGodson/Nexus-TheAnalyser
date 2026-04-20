"use client";

import { useEffect, useState } from "react";

export default function CyberCursor() {
    const [position, setPosition] = useState({ x: -100, y: -100 });
    const [isPointer, setIsPointer] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });

            // Check if hovering over clickable elements
            const target = e.target as HTMLElement;
            setIsPointer(
                window.getComputedStyle(target).getPropertyValue("cursor") === "pointer" ||
                target.tagName.toLowerCase() === "a" ||
                target.tagName.toLowerCase() === "button"
            );
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <>
            <style>{`
        /* Hide default cursor globally to enforce cyber cursor */
        body {
          cursor: none !important;
        }
        a, button, input, select, textarea, [role="button"], [style*="cursor: pointer"] {
          cursor: none !important;
        }

        .cyber-cursor-dot {
          position: fixed;
          top: 0;
          left: 0;
          width: 8px;
          height: 8px;
          background-color: #00e5a0;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 99999;
          transition: transform 0.1s ease-out, background-color 0.2s ease;
          box-shadow: 0 0 10px #00e5a0, 0 0 20px #00e5a0;
        }

        .cyber-cursor-ring {
          position: fixed;
          top: 0;
          left: 0;
          width: 40px;
          height: 40px;
          border: 1px solid rgba(0, 229, 160, 0.4);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 99998;
          transition: transform 0.3s ease-out, width 0.2s ease, height 0.2s ease, border-color 0.2s ease;
          box-shadow: 0 0 15px rgba(0, 229, 160, 0.1);
        }

        /* Hover states */
        .cyber-cursor-dot.hovering {
          transform: translate(-50%, -50%) scale(0.5);
          background-color: #ff4d4d;
          box-shadow: 0 0 10px #ff4d4d, 0 0 20px #ff4d4d;
        }

        .cyber-cursor-ring.hovering {
          width: 50px;
          height: 50px;
          border-color: rgba(255, 77, 77, 0.6);
          background-color: rgba(255, 77, 77, 0.05);
          box-shadow: 0 0 25px rgba(255, 77, 77, 0.2);
          backdrop-filter: blur(1px);
        }
      `}</style>

            {/* Small dot that closely tracks the cursor */}
            <div
                className={`cyber-cursor-dot ${isPointer ? 'hovering' : ''}`}
                style={{ left: position.x, top: position.y }}
            />

            {/* Larger ring that trails slightly via CSS transition */}
            <div
                className={`cyber-cursor-ring ${isPointer ? 'hovering' : ''}`}
                style={{ left: position.x, top: position.y }}
            />
        </>
    );
}
