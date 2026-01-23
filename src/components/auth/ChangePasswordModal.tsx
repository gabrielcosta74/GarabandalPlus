import React, { useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';

type Props = {
    visible: boolean;
    onClose: () => void;
};

export default function ChangePasswordModal({ visible, onClose }: Props) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError(null);

        if (password.length < 6) {
            setError('A password deve ter pelo menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('As passwords não coincidem.');
            return;
        }

        setLoading(true);

        try {
            if (!supabaseBrowser) throw new Error('Supabase client not initialized');

            const { error: updateError } = await supabaseBrowser.auth.updateUser({
                password: password
            });

            if (updateError) {
                throw updateError;
            }

            setSuccess(true);
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Erro ao atualizar password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {visible && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-garabandal-mist/90 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
                    >
                        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-garabandal-gold/10 flex items-center justify-center mb-4 text-garabandal-dark">
                                <Lock className="w-8 h-8" />
                            </div>

                            <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">Alterar Password</h2>
                            <p className="text-gray-500 text-sm mb-6">Define uma nova palavra-passe segura para a tua conta.</p>

                            {error && (
                                <div className="w-full mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2 justify-center">
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            {success ? (
                                <div className="w-full py-8 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                                    <p className="text-lg font-bold text-gray-900">Password Alterada!</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSave} className="w-full space-y-4">
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-14 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/10 outline-none transition-all text-lg"
                                            placeholder="Nova Password"
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full h-14 px-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/10 outline-none transition-all text-lg"
                                            placeholder="Confirmar Password"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex-1 h-14 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                            disabled={loading}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !password || !confirmPassword}
                                            className="flex-1 h-14 bg-garabandal-dark text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
