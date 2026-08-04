"use client";

import type { LucideIcon } from 'lucide-react';
import { useRef } from 'react';

export type BookingTabId = 'payments' | 'trip';

type BookingTab = {
    id: BookingTabId;
    label: string;
    icon: LucideIcon;
};

/**
 * Segmented control for the private booking page. Full-width on mobile so both
 * targets stay thumb-sized, centred and narrow on desktop.
 */
export default function BookingTabs({
    tabs,
    active,
    onChange,
}: {
    tabs: BookingTab[];
    active: BookingTabId;
    onChange: (id: BookingTabId) => void;
}) {
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const currentIndex = tabs.findIndex((tab) => tab.id === active);
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(currentIndex + offset + tabs.length) % tabs.length];
        onChange(next.id);
        buttonRefs.current[next.id]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label="Secções da inscrição"
            onKeyDown={handleKeyDown}
            className="mx-auto grid w-full max-w-md grid-cols-2 gap-1 rounded-full bg-slate-900/90 p-1 shadow-lg shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl"
        >
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        ref={(node) => { buttonRefs.current[tab.id] = node; }}
                        type="button"
                        role="tab"
                        id={`booking-tab-${tab.id}`}
                        aria-selected={isActive}
                        aria-controls={`booking-panel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${isActive
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                            }`}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
