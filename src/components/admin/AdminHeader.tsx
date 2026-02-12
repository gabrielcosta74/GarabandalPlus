
"use client";

import React from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminNotifications } from '../../context/AdminNotificationContext';
import NotificationDropdown from './NotificationDropdown';

export default function AdminHeader({
    title,
    description,
    onMobileMenuOpen,
    userEmail,
    children
}: {
    title: string,
    description?: string,
    onMobileMenuOpen: () => void,
    userEmail?: string | null,
    children?: React.ReactNode
}) {
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { counts } = useAdminNotifications();
    return (
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={onMobileMenuOpen}
                    className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="font-serif text-2xl font-bold text-garabandal-dark hidden sm:block">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-xs text-slate-500 hidden sm:block -mt-1">{description}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                {children}

                {/* Search Bar - Hidden on mobile for simplicity */}
                {!children && (
                    <div className="hidden md:flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-64 focus-within:ring-2 focus-within:ring-garabandal-gold/20 focus-within:border-garabandal-gold transition-all">
                        <Search className="w-4 h-4 text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400 text-gray-700"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setIsNotifOpen(!isNotifOpen)}
                            className={`p-2 rounded-full transition-all relative ${isNotifOpen ? 'bg-garabandal-gold/10 text-garabandal-dark' : 'text-gray-400 hover:text-garabandal-dark hover:bg-gray-100'}`}
                        >
                            <Bell className="w-5 h-5" />
                            {counts.unreadNotifications > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                            )}
                        </button>
                        {isNotifOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                                <NotificationDropdown onClose={() => setIsNotifOpen(false)} />
                            </>
                        )}
                    </div>

                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-3 pl-2 py-1.5 pr-1.5 rounded-full hover:bg-gray-50 transition-all cursor-pointer group border border-transparent hover:border-gray-200"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-gray-900 group-hover:text-garabandal-dark transition-colors">Admin</p>
                                <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{userEmail}</p>
                            </div>
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-garabandal-dark to-slate-900 text-garabandal-gold flex items-center justify-center font-serif font-bold text-xl border-[3px] border-white shadow-lg group-hover:shadow-xl transition-all scale-100 group-hover:scale-105 ring-2 ring-garabandal-gold/20">
                                A
                            </div>
                            <div className={`hidden sm:block transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15, ease: "easeOut" }}
                                        className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 origin-top-right"
                                    >
                                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                                            <p className="text-sm font-bold text-gray-900">Conta de Administrador</p>
                                            <p className="text-xs text-gray-500 mt-0.5 break-all">{userEmail}</p>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            <button className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-garabandal-dark rounded-xl transition-colors flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                </div>
                                                Meu Perfil
                                            </button>
                                            <button className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-garabandal-dark rounded-xl transition-colors flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </div>
                                                Definições
                                            </button>
                                        </div>
                                        <div className="p-2 border-t border-gray-100">
                                            <button
                                                onClick={async () => {
                                                    const { supabaseBrowser } = await import('../../lib/supabase-browser');
                                                    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
                                                    window.location.href = '/auth';
                                                }}
                                                className="w-full text-left px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-3"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                                </div>
                                                Terminar Sessão
                                            </button>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
