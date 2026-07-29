"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useRouter } from 'next/navigation';

type AdminLayoutProps = {
    children: React.ReactNode;
    title?: string;
    description?: string;
    userEmail?: string | null;
    isLoading?: boolean;
    hideHeader?: boolean;
};

const SIDEBAR_STORAGE_KEY = 'admin:sidebar-collapsed';

export default function AdminLayout({ children, title = "Dashboard", description, isLoading, hideHeader = false }: AdminLayoutProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const router = useRouter();

    // Lido depois da montagem para não divergir do HTML do servidor.
    useEffect(() => {
        try {
            setIsCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1');
        } catch {
            // localStorage indisponível (modo privado): fica expandida.
        }
    }, []);

    const toggleSidebar = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            try {
                window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
            } catch {
                // Sem persistência, mas a sessão atual continua a funcionar.
            }
            return next;
        });
    };

    const handleLogout = async () => {
        if (supabaseBrowser) {
            await supabaseBrowser.auth.signOut();
            router.replace('/');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-garabandal-dark flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-garabandal-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 animate-pulse">A carregar painel admin...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex font-admin">
            {/* Sidebar Desktop */}
            <AdminSidebar onLogout={handleLogout} className="hidden lg:flex" collapsed={isCollapsed} />

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 w-72 z-50 lg:hidden"
                        >
                            <AdminSidebar onLogout={handleLogout} className="h-full" />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {!hideHeader && (
                    <AdminHeader
                        title={title}
                        description={description}
                        onMobileMenuOpen={() => setIsMobileOpen(true)}
                        onToggleSidebar={toggleSidebar}
                        sidebarCollapsed={isCollapsed}
                    />
                )}

                <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto pb-12">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
