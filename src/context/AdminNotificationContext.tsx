"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "../lib/supabase-browser";

export type AdminNotification = {
    id: string;
    type: 'order' | 'member' | 'booking' | 'donation' | 'system';
    title: string;
    message: string;
    link?: string;
    read_at: string | null;
    created_at: string;
};

type NotificationCounts = {
    orders: number;
    members: number;
    bookings: number;
    factpt: number;
    unreadNotifications: number;
};

type AdminNotificationContextType = {
    counts: NotificationCounts;
    notifications: AdminNotification[];
    isLoading: boolean;
    refreshCounts: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
};

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined);

export function AdminNotificationProvider({ children }: { children: React.ReactNode }) {
    const [counts, setCounts] = useState<NotificationCounts>({
        orders: 0,
        members: 0,
        bookings: 0,
        factpt: 0,
        unreadNotifications: 0,
    });
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCounts = useCallback(async () => {
        try {
            if (!supabaseBrowser) return;
            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) return;

            const res = await fetch("/api/admin/notifications/stats", {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });

            if (res.ok) {
                const data = await res.json();
                setCounts(data.counts);
                setNotifications(data.notifications || []);
            }
        } catch (err) {
            console.error("Failed to fetch admin notifications", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const markAsRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
            setCounts(prev => ({ ...prev, unreadNotifications: Math.max(0, prev.unreadNotifications - 1) }));

            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            const token = sessionData.session?.access_token;

            await fetch(`/api/admin/notifications/${id}/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh to ensure sync (e.g. if badge count logic depends on read status)
            fetchCounts();
        } catch (err) {
            console.error("Error marking as read", err);
        }
    };

    const markAllAsRead = async () => {
        try {
            // Optimistic
            setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
            setCounts(prev => ({ ...prev, unreadNotifications: 0 }));

            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            const token = sessionData.session?.access_token;

            await fetch(`/api/admin/notifications/read-all`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            fetchCounts();
        } catch (err) {
            console.error("Error marking all as read", err);
        }
    }

    // Initial load + Polling
    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 60000); // Poll every 60s
        return () => clearInterval(interval);
    }, [fetchCounts]);

    return (
        <AdminNotificationContext.Provider value={{ counts, notifications, isLoading, refreshCounts: fetchCounts, markAsRead, markAllAsRead }}>
            {children}
        </AdminNotificationContext.Provider>
    );
}

export const useAdminNotifications = () => {
    const context = useContext(AdminNotificationContext);
    if (context === undefined) {
        throw new Error("useAdminNotifications must be used within an AdminNotificationProvider");
    }
    return context;
};
