
import React from 'react';
import type { Metadata } from 'next';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { AdminNotificationProvider } from '../../context/AdminNotificationContext';

// Admin-only fonts belong to the admin segment. Defining them in the root
// layout made every public page preload two fonts it never used.
const adminSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    variable: '--font-admin-sans',
    display: 'swap',
});
const geistMono = Geist_Mono({
    subsets: ['latin'],
    variable: '--font-geist-mono',
});

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${adminSans.variable} ${geistMono.variable}`}>
            <AdminNotificationProvider>
                {children}
            </AdminNotificationProvider>
        </div>
    );
}
