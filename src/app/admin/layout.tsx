
import React from 'react';
import { AdminNotificationProvider } from '../../context/AdminNotificationContext';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminNotificationProvider>
            {children}
        </AdminNotificationProvider>
    );
}
