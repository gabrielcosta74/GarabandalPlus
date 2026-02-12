
import React from 'react';
import type { Metadata } from 'next';
import { AdminNotificationProvider } from '../../context/AdminNotificationContext';

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminNotificationProvider>
            {children}
        </AdminNotificationProvider>
    );
}
