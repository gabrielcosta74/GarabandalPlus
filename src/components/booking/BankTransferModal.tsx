"use client";

import { X, Copy, CheckCircle2, Upload, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BankTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: string | number; // Formatted amount or number
    iban: string;
    onUploadClick: () => void;
}

export default function BankTransferModal({ isOpen, onClose, totalAmount, iban, onUploadClick }: BankTransferModalProps) {
    const [mounted, setMounted] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(iban);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto relative flex flex-col max-h-[90vh]">
                            
                            {/* Header */}
                            <div className="bg-slate-900 p-6 flex justify-between items-center relative z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Dados para Transferência</h2>
                                    <p className="text-slate-400 text-sm">Realize a transferência segura pelo seu banco</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                                
                                {/* Amount Display */}
                                <div className="text-center space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor a Transferir</p>
                                    <div className="text-4xl font-bold text-slate-900 bg-slate-50 border border-slate-100 rounded-2xl py-4">
                                        {totalAmount}€
                                    </div>
                                </div>

                                {/* IBAN Box */}
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-slate-700">IBAN para Pagamento</p>
                                    <button 
                                        onClick={handleCopy}
                                        className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl p-4 flex items-center justify-between group transition-colors text-left"
                                    >
                                        <div className="space-y-1">
                                            <p className="font-mono text-lg md:text-xl font-bold text-blue-900 break-all">{iban}</p>
                                            <p className="text-xs text-blue-600 font-medium">Conta: Associação Garabandal</p>
                                        </div>
                                        <div className="p-2 bg-blue-200 rounded-lg text-blue-700 group-hover:scale-105 transition-transform">
                                            {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        </div>
                                    </button>
                                    <p className="text-center text-xs text-slate-400">Clique acima para copiar o IBAN</p>
                                </div>

                                {/* Instructions */}
                                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-amber-900 text-sm">Passos Importantes</h4>
                                            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                                                <li>Realize a transferência do valor exato.</li>
                                                <li>Guarde o comprovativo (PDF ou Foto).</li>
                                                <li>Envie o comprovativo no botão abaixo.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3 pt-2">
                                    <button
                                        onClick={() => {
                                            onClose();
                                            onUploadClick();
                                        }}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Upload className="w-5 h-5" />
                                        Já fiz a transferência, Enviar Comprovativo
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors"
                                    >
                                        Vou fazer depois
                                    </button>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
