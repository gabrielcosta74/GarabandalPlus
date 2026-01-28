
"use client";

import React, { useState } from 'react';
import { useAdminNotifications } from '../../context/AdminNotificationContext';
import {
    Bell,
    Check,
    ChevronRight,
    CreditCard,
    FileText,
    Info,
    Plane,
    ShoppingBag,
    Trash,
    User,
    X
} from 'lucide-react';
import Link from 'next/link';

const getIcon = (type: string) => {
    switch (type) {
        case 'order': return <ShoppingBag className="w-4 h-4 text-blue-500" />;
        case 'member': return <User className="w-4 h-4 text-green-500" />;
        case 'booking': return <Plane className="w-4 h-4 text-amber-500" />;
        case 'donation': return <CreditCard className="w-4 h-4 text-purple-500" />;
        default: return <Info className="w-4 h-4 text-gray-500" />;
    }
}

export default function NotificationDropdown({ onClose }: { onClose: () => void }) {
    const { notifications, markAsRead, markAllAsRead, isLoading } = useAdminNotifications();
    const unreadCount = notifications.filter(n => !n.read_at).length;

    return (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                    <h3 className="font-bold text-gray-900">Notificações</h3>
                    <p className="text-xs text-gray-500">{unreadCount} novas mensagens</p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={() => markAllAsRead()}
                        className="text-xs font-medium text-garabandal-gold hover:text-garabandal-dark transition-colors"
                    >
                        Ler todas
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        Loading...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">Tudo limpo!</p>
                        <p className="text-xs text-gray-500">Não há novas notificações.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`group p-4 hover:bg-gray-50 transition-colors relative border-b border-gray-50 ${!notification.read_at ? 'bg-blue-50/60 border-l-4 border-l-blue-500' : 'pl-[1.25rem]'}`}
                            >
                                <div className="flex gap-3 items-start">
                                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${!notification.read_at ? 'bg-white border-blue-200 shadow-sm' : 'bg-gray-100 border-transparent'}`}>
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className={`text-sm ${!notification.read_at ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                                                {notification.title}
                                            </p>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                {new Date(notification.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                            {notification.message}
                                        </p>

                                        <div className="flex items-center gap-3 mt-3">
                                            {notification.link && (
                                                <Link
                                                    href={notification.link}
                                                    onClick={() => {
                                                        if (!notification.read_at) markAsRead(notification.id);
                                                        onClose();
                                                    }}
                                                    className="text-xs font-bold text-garabandal-dark hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"
                                                >
                                                    Ver detalhes <ChevronRight className="w-3 h-3" />
                                                </Link>
                                            )}
                                            {!notification.read_at && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1 ml-auto"
                                                >
                                                    <Check className="w-3 h-3" /> Marcar lida
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                <button
                    onClick={onClose}
                    className="text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                    Fechar
                </button>
            </div>
        </div>
    );
}
