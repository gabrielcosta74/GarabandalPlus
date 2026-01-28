"use client";

import React, { useState } from 'react';
import { OrderRow } from '../page'; // We'll refer to the type, or move types to a shared file later. 
// Ideally types should be in types.ts but for speed we'll assume import or re-declare.
// Let's re-declare locally to avoid circular deps if types are in page.tsx still.

// --- Types (Matched from page.tsx) ---
type OrderItem = {
    order_ref: string;
    product_id: string;
    name: string;
    qty: number;
    unit_price: number;
    total_price: number;
};

export type OrderDetailRow = {
    order_ref: string;
    created_at: string;
    buyer_name: string | null;
    buyer_email: string | null;
    buyer_phone?: string | null;
    buyer_nif?: string | null;
    shipping_country: string | null;
    shipping_address1?: string | null;
    shipping_address2?: string | null;
    shipping_city?: string | null;
    shipping_postal_code?: string | null;
    shipping_cost?: number | null;
    shipping_status?: string | null;
    invoice_sent_at?: string | null;
    has_physical: boolean;
    payment_method?: string | null;
    total_amount: number;
    currency: string;
    items: OrderItem[];
    billing_address?: string | null;
    billing_city?: string | null;
    billing_postal_code?: string | null;
    billing_country?: string | null;
    status: string;
};

import {
    X, CheckCircle, Truck, FileText, User, CreditCard, Package, Copy, AlertCircle
} from 'lucide-react';

const formatCurrency = (value: number, currency = 'EUR') =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');

const isPaid = (status: string) => {
    const normalized = status?.toLowerCase?.() || '';
    return normalized === 'paid' || normalized === 'pago';
};

type OrderDetailsModalProps = {
    order: OrderDetailRow;
    onClose: () => void;
    onToggleInvoice: (order: OrderDetailRow) => void;
    onMarkShipped: (order: OrderDetailRow) => void;
};

export default function OrderDetailsModal({ order, onClose, onToggleInvoice, onMarkShipped }: OrderDetailsModalProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    const getBillingText = () => {
        const lines = [
            order.buyer_name,
            `NIF: ${order.buyer_nif || 'N/A'}`,
            order.billing_address || order.shipping_address1,
            `${order.billing_postal_code || order.shipping_postal_code} ${order.billing_city || order.shipping_city}`,
            (order.billing_country || order.shipping_country || 'PT').toUpperCase()
        ];
        return lines.filter(Boolean).join('\n');
    };

    const getShippingText = () => {
        const lines = [
            order.buyer_name,
            order.shipping_address1,
            order.shipping_address2,
            `${order.shipping_postal_code} ${order.shipping_city}`,
            (order.shipping_country || '').toUpperCase()
        ];
        return lines.filter(Boolean).join('\n');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">

                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold font-serif text-gray-900">#{order.order_ref}</h2>
                            <span className={`px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide rounded-full border ${isPaid(order.status) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {order.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                            {formatDate(order.created_at)}
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            {order.payment_method}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto">

                    {/* Left Column: Customer & Billing */}
                    <div className="space-y-6">

                        {/* Customer Card */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative group">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                                <User className="w-4 h-4" /> Cliente
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Nome</p>
                                    <p className="font-medium text-gray-900">{order.buyer_name || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Email</p>
                                    <p className="font-medium text-gray-900 break-all">{order.buyer_email || '—'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Telefone</p>
                                        <p className="font-medium text-gray-900">{order.buyer_phone || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">NIF</p>
                                        <p className="font-mono font-medium text-gray-900">{order.buyer_nif || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Billing / Invoice Card */}
                        <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-200 hover:border-garabandal-gold/50 transition-colors relative group">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> Dados de Faturação
                                </h3>
                                <button
                                    onClick={() => handleCopy(getBillingText(), 'billing')}
                                    className="p-1.5 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Copiar para Fatura"
                                >
                                    {copied === 'billing' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="text-sm space-y-1 text-gray-700 font-mono bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="font-bold">{order.buyer_name}</p>
                                <p>NIF: {order.buyer_nif || 'N/A'}</p>
                                <div className="my-1 border-b border-gray-200 border-dashed" />
                                <p>{order.billing_address || order.shipping_address1 || '—'}</p>
                                <p> {order.billing_postal_code || order.shipping_postal_code || ''} {order.billing_city || order.shipping_city || ''}</p>
                                <p>{(order.billing_country || order.shipping_country || 'PT').toUpperCase()}</p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                <div className="text-xs text-gray-500">
                                    Estado Fatura:
                                </div>
                                <button
                                    onClick={() => onToggleInvoice(order)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${order.invoice_sent_at
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 shadow-sm'
                                        }`}
                                >
                                    {order.invoice_sent_at ? (
                                        <> <CheckCircle className="w-4 h-4" /> Fatura Enviada </>
                                    ) : (
                                        <> <AlertCircle className="w-4 h-4" /> Marcar Enviada </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Logistics & Items */}
                    <div className="space-y-6">

                        {/* Logistics Card (Only Physical) */}
                        {order.has_physical && (
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 relative group">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                                        <Truck className="w-4 h-4" /> Logística
                                    </h3>
                                    <button
                                        onClick={() => handleCopy(getShippingText(), 'shipping')}
                                        className="p-1.5 text-blue-400 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                                        title="Copiar Morada Envio"
                                    >
                                        {copied === 'shipping' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm space-y-1 text-gray-800 bg-white p-3 rounded-lg border border-blue-50 shadow-sm">
                                        <p>{order.shipping_address1}</p>
                                        {order.shipping_address2 && <p>{order.shipping_address2}</p>}
                                        <p>{order.shipping_postal_code} {order.shipping_city}</p>
                                        <p className="font-bold">{(order.shipping_country || '').toUpperCase()}</p>
                                    </div>

                                    <div className="pt-3 flex justify-end">
                                        {order.shipping_status?.toLowerCase() === 'enviado' ? (
                                            <span className="flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                                <CheckCircle className="w-4 h-4" /> Enviado
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => onMarkShipped(order)}
                                                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95"
                                            >
                                                <Package className="w-4 h-4" />
                                                Marcar como Enviado
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Items Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                                    <Package className="w-4 h-4" /> Itens ({order.items.length})
                                </h3>
                                <span className="font-bold text-gray-900">{formatCurrency(order.total_amount, order.currency)}</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-xs font-bold text-gray-500">
                                                {item.qty}x
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                                <p className="text-xs text-gray-400">{formatCurrency(item.unit_price, order.currency)}/un</p>
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">{formatCurrency(item.total_price, order.currency)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Action Closure */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex justify-end gap-3 z-10 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
