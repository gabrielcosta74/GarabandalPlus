
"use client";

import React from 'react';
import { Search, Bell, Menu } from 'lucide-react';

export default function AdminHeader({ title, onMobileMenuOpen, userEmail }: { title: string, onMobileMenuOpen: () => void, userEmail?: string | null }) {
    return (
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMobileMenuOpen}
                    className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="font-serif text-2xl font-bold text-garabandal-dark hidden sm:block">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {/* Search Bar - Hidden on mobile for simplicity */}
                <div className="hidden md:flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-64 focus-within:ring-2 focus-within:ring-garabandal-gold/20 focus-within:border-garabandal-gold transition-all">
                    <Search className="w-4 h-4 text-gray-400 mr-2" />
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400 text-gray-700"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-full transition-all relative">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    <div className="flex items-center gap-3 pl-1">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-gray-900">Admin</p>
                            <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{userEmail}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-garabandal-dark text-garabandal-gold flex items-center justify-center font-bold text-sm border-2 border-garabandal-gold/20">
                            A
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
