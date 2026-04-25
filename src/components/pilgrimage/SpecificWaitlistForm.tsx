"use client";

import { useState } from 'react';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

interface SpecificWaitlistFormProps {
    pilgrimageId: string;
    pilgrimageTitle: string;
}

export function SpecificWaitlistForm({ pilgrimageId, pilgrimageTitle }: SpecificWaitlistFormProps) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        notes: ''
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const res = await fetch('/api/pilgrimages/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    pilgrimage_id: pilgrimageId
                })
            });

            if (!res.ok) throw new Error('Failed to join waitlist');

            setStatus('success');
        } catch (error) {
            console.error(error);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-amber-50 rounded-2xl p-8 text-center border-2 border-amber-100 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-amber-900 mb-2">{isEn ? "You're on the Waiting List!" : 'Está na Lista de Espera!'}</h3>
                <p className="text-amber-800/80 mb-6">
                    {isEn ? <>If a spot opens for <strong>{pilgrimageTitle}</strong>, we will contact you immediately.</> : <>Se surgir uma vaga para <strong>{pilgrimageTitle}</strong>, entraremos em contacto consigo imediatamente.</>}
                </p>
                <div className="text-sm text-amber-600 font-medium bg-amber-100/50 py-2 px-4 rounded-lg inline-block">
                    {isEn ? 'We will keep your data safe.' : 'Manteremos os seus dados seguros.'}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100">
            <div className="text-center mb-8">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                    {isEn ? 'Sold Out: Join the Waiting List' : 'Esgotado: Entre na Lista de Espera'}
                </h3>
                <p className="text-slate-500">
                    {isEn ? 'Leave your details. If there is a cancellation, you will be the first to know.' : 'Deixe os seus dados. Se houver alguma desistência, será o primeiro a saber.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{isEn ? 'Full Name' : 'Nome Completo'}</label>
                    <input
                        type="text"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-400 focus:ring-0 outline-none transition-all font-medium text-slate-900"
                        placeholder={isEn ? 'e.g. Mary Smith' : 'Ex: Maria Santos'}
                        value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-400 focus:ring-0 outline-none transition-all font-medium text-slate-900"
                            placeholder={isEn ? 'email@example.com' : 'email@exemplo.com'}
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{isEn ? 'Phone (with country code)' : 'Telemóvel (com indicativo)'}</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-400 focus:ring-0 outline-none transition-all font-medium text-slate-900"
                            placeholder={isEn ? 'e.g. +351 912 345 678 or +55 11 91234-5678' : 'Ex: +351 912 345 678 ou +55 11 91234-5678'}
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{isEn ? 'Notes (Optional)' : 'Notas (Opcional)'}</label>
                    <textarea
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-400 focus:ring-0 outline-none transition-all font-medium text-slate-900 min-h-[80px]"
                        placeholder={isEn ? 'e.g. I prefer a double room...' : 'Ex: Tenho preferência por quarto duplo...'}
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                >
                    {status === 'loading' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <span>{isEn ? 'Join the Waiting List' : 'Entrar na Lista de Espera'}</span>
                            <Send className="w-5 h-5" />
                        </>
                    )}
                </button>

                {status === 'error' && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg text-sm font-medium justify-center">
                        <AlertCircle className="w-4 h-4" />
                        {isEn ? 'An error occurred. Please try again.' : 'Ocorreu um erro. Tente novamente.'}
                    </div>
                )}
            </form>
        </div>
    );
}
