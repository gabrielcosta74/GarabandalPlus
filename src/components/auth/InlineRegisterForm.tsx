"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

const registerSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "A password deve ter pelo menos 6 caracteres"),
    full_name: z.string().min(3, "Nome completo obrigatório"),
    phone: z.string().min(9, "Telemóvel obrigatório"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface InlineRegisterFormProps {
    onSuccess: (user: any) => void;
}

export default function InlineRegisterForm({ onSuccess }: InlineRegisterFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'login' | 'register'>('register');

    const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema)
    });

    const handleAuth = async (data: RegisterFormValues) => {
        setLoading(true);
        setError('');

        try {
            if (!supabaseBrowser) return;

            if (mode === 'register') {
                const { data: signUpData, error: signUpError } = await supabaseBrowser.auth.signUp({
                    email: data.email,
                    password: data.password,
                    options: {
                        data: {
                            full_name: data.full_name,
                            phone: data.phone,
                            is_membro: false // Not a member yet, just a user
                        }
                    }
                });

                if (signUpError) throw signUpError;
                if (signUpData.user) {
                    onSuccess(signUpData.user);
                }
            } else {
                // Login Mode
                const { data: signInData, error: signInError } = await supabaseBrowser.auth.signInWithPassword({
                    email: data.email,
                    password: data.password,
                });

                if (signInError) throw signInError;
                if (signInData.user) {
                    onSuccess(signInData.user);
                }
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Ocorreu um erro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 max-w-md mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-serif font-bold text-white mb-2">
                    {mode === 'register' ? 'Criar Conta' : 'Bem-vindo de volta'}
                </h2>
                <p className="text-slate-400 text-sm">
                    {mode === 'register'
                        ? 'Precisamos dos teus dados para associar a inscrição.'
                        : 'Entra para continuar a tua inscrição.'}
                </p>
            </div>

            <form onSubmit={handleSubmit(handleAuth)} className="space-y-4">

                {mode === 'register' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <input
                                    {...register('full_name')}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-yellow-600"
                                    placeholder="João Silva"
                                />
                            </div>
                            {errors.full_name && <p className="text-red-500 text-xs">{errors.full_name.message}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Telemóvel</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <input
                                    {...register('phone')}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-yellow-600"
                                    placeholder="+351 ..."
                                />
                            </div>
                            {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
                        </div>
                    </>
                )}

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                        <input
                            {...register('email')}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-yellow-600"
                            placeholder="email@exemplo.com"
                        />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                        <input
                            type="password"
                            {...register('password')}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-yellow-600"
                            placeholder="••••••"
                        />
                    </div>
                    {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                </div>

                {error && <p className="text-red-500 text-sm text-center bg-red-500/10 p-2 rounded-lg">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-600 text-white font-bold py-3 rounded-xl hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-900/20 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                        <>
                            {mode === 'register' ? 'Criar Conta e Continuar' : 'Entrar'} <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center border-t border-white/5 pt-4">
                <button
                    onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                    className="text-slate-400 hover:text-white text-sm hover:underline"
                >
                    {mode === 'register' ? 'Já tens conta? Faz Login' : 'Ainda não tens conta? Regista-te'}
                </button>
            </div>
        </div>
    );
}
