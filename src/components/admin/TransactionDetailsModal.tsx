"use client";
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import {
    X,
    Copy,
    CheckCircle,
    FileText,
    CreditCard,
    User,
    MapPin,
    Calendar,
    Package,
    Heart,
    Plane,
    Users,
    AlertCircle,
    ExternalLink,
    Clock
} from 'lucide-react';

export type TransactionDetail = {
    id: string;
    category: 'shop' | 'donation' | 'quota' | 'pilgrimage';
    reference: string;
    amount: number;
    currency: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_nif?: string | null;
    customer_address?: string | null;
    customer_city?: string | null;
    customer_zip?: string | null;
    customer_country?: string | null;
    status: string;
    method: string | null;
    provider: string | null;
    created_at: string;
    invoice_sent_at?: string | null;
    items?: Array<{ name: string; qty: number; price: number; total: number }>;
    notes?: string;
    proof_url?: string;
};

type TransactionDetailsModalProps = {
    transaction: TransactionDetail;
    onClose: () => void;
    onToggleInvoice: (t: TransactionDetail) => void;
};

export default function TransactionDetailsModal({ transaction, onClose, onToggleInvoice }: TransactionDetailsModalProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const formatCurrency = (val: number, cur: string) =>
        new Intl.NumberFormat('pt-PT', { style: 'currency', currency: cur }).format(val);

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('pt-PT', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

    const isPaid = ['paid', 'pago', 'succeeded', 'verified'].includes(transaction.status?.toLowerCase());

    const getCategoryIcon = () => {
        switch (transaction.category) {
            case 'shop': return <Package className="w-5 h-5" />;
            case 'donation': return <Heart className="w-5 h-5" />;
            case 'pilgrimage': return <Plane className="w-5 h-5" />;
            case 'quota': return <Users className="w-5 h-5" />;
            default: return <CreditCard className="w-5 h-5" />;
        }
    };

    const getCategoryLabel = () => {
        switch (transaction.category) {
            case 'shop': return 'Loja Online';
            case 'donation': return 'Doação';
            case 'pilgrimage': return 'Peregrinação';
            case 'quota': return 'Quota de Membro';
            default: return 'Transação';
        }
    };

    const copyBillingInfo = () => {
        const lines = [
            `Nome: ${transaction.customer_name || ''}`,
            `NIF: ${transaction.customer_nif || 'N/A'}`,
            `Email: ${transaction.customer_email || ''}`,
            `Morada: ${transaction.customer_address || ''}`,
            `${transaction.customer_zip || ''} ${transaction.customer_city || ''}`,
            `${transaction.customer_country || ''}`
        ].filter(l => l.trim() !== '');

        handleCopy(lines.join('\n'), 'billing-full');
    };

    return (
        <Transition appear show={true} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">

                                {/* Header */}
                                <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${transaction.category === 'donation' ? 'bg-rose-100 text-rose-600' :
                                            transaction.category === 'shop' ? 'bg-indigo-100 text-indigo-600' :
                                                'bg-emerald-100 text-emerald-600'
                                            }`}>
                                            {getCategoryIcon()}
                                        </div>
                                        <div>
                                            <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 leading-none">
                                                {getCategoryLabel()} <span className="text-gray-400 font-normal text-sm">#{transaction.reference}</span>
                                            </Dialog.Title>
                                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(transaction.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-8">

                                    {/* Action Banner */}
                                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs uppercase font-bold text-gray-400">Estado Pagamento</span>
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {isPaid ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                    {transaction.status}
                                                </div>
                                            </div>

                                            <div className="h-8 w-px bg-gray-300 mx-2 hidden sm:block"></div>

                                            <div className="flex flex-col">
                                                <span className="text-xs uppercase font-bold text-gray-400">Estado Fatura</span>
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase transition-all cursor-pointer hover:ring-2 hover:ring-offset-1 ${transaction.invoice_sent_at
                                                    ? 'bg-blue-100 text-blue-700 hover:ring-blue-200'
                                                    : 'bg-gray-100 text-gray-500 hover:ring-gray-200'
                                                    }`} onClick={() => onToggleInvoice(transaction)}>
                                                    <FileText className="w-3 h-3" />
                                                    {transaction.invoice_sent_at ? 'Enviada' : 'Não Enviada'}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => onToggleInvoice(transaction)}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${transaction.invoice_sent_at
                                                ? 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 border'
                                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                                                }`}
                                        >
                                            <FileText className="w-4 h-4" />
                                            {transaction.invoice_sent_at ? 'Marcar Não Enviada' : 'Marcar Fatura Enviada'}
                                        </button>
                                    </div>

                                    {/* Content Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                        {/* Left Col: Customer Info */}
                                        <div className="space-y-6">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        Entidade
                                                    </h4>
                                                    <button onClick={copyBillingInfo} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                                                        {copied === 'billing-full' ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                        Copiar Dados Faturação
                                                    </button>
                                                </div>
                                                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                                                    <div className="group flex justify-between items-start">
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Nome</p>
                                                            <p className="font-medium text-gray-900">{transaction.customer_name || 'Anónimo'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="group flex justify-between items-start relative">
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Email</p>
                                                            <p className="font-medium text-gray-900 break-all">{transaction.customer_email || '—'}</p>
                                                        </div>
                                                        {transaction.customer_email && (
                                                            <button onClick={() => handleCopy(transaction.customer_email!, 'email')} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all absolute right-0 top-0">
                                                                {copied === 'email' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="group flex justify-between items-start relative">
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase font-bold">NIF</p>
                                                            <p className="font-mono text-gray-700 bg-gray-50 px-1.5 rounded">{transaction.customer_nif || '—'}</p>
                                                        </div>
                                                        {transaction.customer_nif && (
                                                            <button onClick={() => handleCopy(transaction.customer_nif!, 'nif')} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all absolute right-0 top-0">
                                                                {copied === 'nif' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {transaction.customer_address && (
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                                                        <MapPin className="w-4 h-4 text-gray-400" />
                                                        Morada
                                                    </h4>
                                                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm relative group">
                                                        <p className="text-gray-700 text-sm leading-relaxed">
                                                            {transaction.customer_address}<br />
                                                            {transaction.customer_zip} {transaction.customer_city}<br />
                                                            {transaction.customer_country}
                                                        </p>
                                                        <button
                                                            onClick={() => handleCopy(`${transaction.customer_address}\n${transaction.customer_zip} ${transaction.customer_city}\n${transaction.customer_country}`, 'addr')}
                                                            className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-all"
                                                        >
                                                            {copied === 'addr' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Col: Transaction Details */}
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                                    Detalhes Financeiros
                                                </h4>
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                                                        <span className="text-sm text-gray-500 font-medium">Total Pago</span>
                                                        <span className="text-xl font-black text-gray-900">{formatCurrency(transaction.amount, transaction.currency)}</span>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">Método</span>
                                                            <span className="font-medium text-gray-900 capitalize">{transaction.method?.replace('_', ' ') || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">Provider</span>
                                                            <span className="font-medium text-gray-900">{transaction.provider || 'N/A'}</span>
                                                        </div>
                                                        {transaction.proof_url && (
                                                            <div className="pt-2 border-t border-slate-200 mt-2">
                                                                <a
                                                                    href={transaction.proof_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                                                                >
                                                                    <FileText className="w-3 h-3" />
                                                                    Ver Comprovativo
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Items or Notes */}
                                            {transaction.items && transaction.items.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                                                        Itens
                                                    </h4>
                                                    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                                                                <tr>
                                                                    <th className="px-4 py-2">Qtd</th>
                                                                    <th className="px-4 py-2">Item</th>
                                                                    <th className="px-4 py-2 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {transaction.items.map((item, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-4 py-2 text-gray-500">{item.qty}x</td>
                                                                        <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                                                                        <td className="px-4 py-2 text-right font-bold text-gray-900">
                                                                            {formatCurrency(item.total, transaction.currency)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {transaction.notes && (
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Notas</h4>
                                                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm border border-yellow-100 italic">
                                                        "{transaction.notes}"
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
