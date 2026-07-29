"use client";

import React from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function AdminHeader({
    title,
    description,
    onMobileMenuOpen,
    onToggleSidebar,
    sidebarCollapsed,
    children
}: {
    title: string,
    description?: string,
    onMobileMenuOpen: () => void,
    onToggleSidebar?: () => void,
    sidebarCollapsed?: boolean,
    children?: React.ReactNode
}) {
    return (
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 py-3 backdrop-blur-md">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                    onClick={onMobileMenuOpen}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
                    aria-label="Abrir menu"
                >
                    <Menu className="h-5 w-5" />
                </button>

                {onToggleSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className="hidden rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:block"
                        aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                        title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                    >
                        {sidebarCollapsed
                            ? <PanelLeftOpen className="h-[18px] w-[18px]" />
                            : <PanelLeftClose className="h-[18px] w-[18px]" />}
                    </button>
                )}

                <div className="min-w-0">
                    <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
                        {title}
                    </h1>
                    {description && (
                        <p className="truncate text-xs text-slate-500">{description}</p>
                    )}
                </div>
            </div>

            {children && <div className="flex items-center gap-2">{children}</div>}
        </header>
    );
}
