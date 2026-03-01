"use client";

import { useState, useEffect, useRef } from 'react';
import { Trophy, CheckCircle2, Upload, Loader2, MapPin, CreditCard, AlertCircle, Landmark } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { UNIFIED_DONATION_PAYMENT_OPTIONS } from '../../lib/payment-options';
import {
    BANK_TRANSFER_SITE_CONTENT_KEY,
    DEFAULT_BANK_TRANSFER_DETAILS,
    normalizeBankTransferDetails,
} from '../../lib/bank-transfer-details';
import type { BankTransferDetails } from '../../lib/bank-transfer-details';

interface WinnerPaymentPanelProps {
    itemId: string;
    itemTitle: string;
    winningBid: number;
    paymentDeadline: string | null;
    itemStatus: string;
}

export function WinnerPaymentPanel({ itemId, itemTitle, winningBid, paymentDeadline, itemStatus }: WinnerPaymentPanelProps) {
    const [selectedPaymentId, setSelectedPaymentId] = useState(UNIFIED_DONATION_PAYMENT_OPTIONS[0].id);
    const [copiedIban, setCopiedIban] = useState(false);
    const [bankTransferDetails, setBankTransferDetails] = useState<BankTransferDetails>(DEFAULT_BANK_TRANSFER_DETAILS);

    // Shipping
    const [shippingName, setShippingName] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [shippingCity, setShippingCity] = useState('');
    const [shippingPostal, setShippingPostal] = useState('');
    const [shippingPhone, setShippingPhone] = useState('');
    const [shippingSaved, setShippingSaved] = useState(false);
    const [savingShipping, setSavingShipping] = useState(false);

    // Receipt upload
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // General
    const [error, setError] = useState<string | null>(null);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [localPaid, setLocalPaid] = useState(false);
    const [confirmStatus, setConfirmStatus] = useState<'idle' | 'confirming' | 'failed'>('idle');

    const selectedPayment = UNIFIED_DONATION_PAYMENT_OPTIONS.find(p => p.id === selectedPaymentId) || UNIFIED_DONATION_PAYMENT_OPTIONS[0];
    const isBankTransfer = selectedPaymentId === 'bank_transfer';

    const deadlineDate = paymentDeadline ? new Date(paymentDeadline) : null;
    const hoursLeft = deadlineDate ? Math.max(0, Math.floor((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60))) : null;
    const isPaid = itemStatus === 'paid' || itemStatus === 'shipped';

    // Fetch bank transfer details from site_content
    useEffect(() => {
        const fetch = async () => {
            if (!supabaseBrowser) return;
            const { data } = await supabaseBrowser
                .from('site_content')
                .select('content')
                .eq('key', BANK_TRANSFER_SITE_CONTENT_KEY)
                .maybeSingle();
            if (data?.content) setBankTransferDetails(normalizeBankTransferDetails(data.content));
        };
        fetch();
    }, []);

    const getToken = async () => {
        const session = await supabaseBrowser?.auth.getSession();
        return session?.data?.session?.access_token || null;
    };

    // ── Payment Verification (Return from Reduniq) ──
    useEffect(() => {
        if (isPaid || localPaid) return;

        const search = new URLSearchParams(window.location.search);
        const orderRefParam = search.get('orderRef');
        const tokenParam = search.get('token');
        const paymentParam = search.get('payment');

        // Only try to confirm if we have indicators of a return from Reduniq
        if ((paymentParam === 'success' || tokenParam || orderRefParam) && confirmStatus === 'idle') {
            const confirmReduniq = async () => {
                setConfirmStatus('confirming');
                try {
                    const res = await fetch('/api/reduniq/confirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...(orderRefParam ? { orderRef: orderRefParam } : {}),
                            ...(tokenParam ? { token: tokenParam } : {}),
                        }),
                    });

                    const data = await res.json();
                    if (res.ok && data?.success) {
                        setLocalPaid(true);
                    } else {
                        setConfirmStatus('failed');
                        setError('Aguardando confirmação do banco. Se pagou, verifique mais tarde.');
                    }
                } catch (err) {
                    console.warn('[Auction] Failed to verify payment:', err);
                    setConfirmStatus('failed');
                }
            };

            confirmReduniq();
        }
    }, [isPaid, localPaid, confirmStatus]);

    // ── Shipping ──
    const handleSaveShipping = async () => {
        if (!shippingName || !shippingAddress || !shippingCity || !shippingPostal) {
            setError('Preencha todos os campos de morada obrigatórios.');
            return;
        }
        setSavingShipping(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) { setError('Sessão expirada.'); return; }
            const res = await fetch('/api/auction/winner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    item_id: itemId,
                    shipping_name: shippingName,
                    shipping_address: shippingAddress,
                    shipping_city: shippingCity,
                    shipping_postal: shippingPostal,
                    shipping_phone: shippingPhone,
                })
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Erro ao guardar morada.');
                return;
            }
            setShippingSaved(true);
        } catch {
            setError('Erro de rede.');
        } finally {
            setSavingShipping(false);
        }
    };

    // ── Online payment (Reduniq) ──
    const handleOnlinePayment = async () => {
        setProcessingPayment(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) { setError('Sessão expirada.'); return; }
            const res = await fetch('/api/auction/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ item_id: itemId, paymentOptionId: selectedPaymentId })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Erro ao iniciar pagamento.');
                return;
            }
            if (data.url) window.location.href = data.url;
        } catch {
            setError('Erro de rede.');
        } finally {
            setProcessingPayment(false);
        }
    };

    // ── Receipt upload (same pattern as DonationModal) ──
    const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!supabaseBrowser) { setError('Erro: Cliente não inicializado.'); return; }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) { setError('Tipo de ficheiro inválido. Use JPG, PNG, WEBP, HEIC ou PDF.'); return; }
        if (file.size > 10 * 1024 * 1024) { setError('Ficheiro demasiado grande (máx 10MB).'); return; }

        setUploadingProof(true);
        setError(null);
        try {
            const ext = file.name.split('.').pop() || 'file';
            const fileName = `auction_${itemId}_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabaseBrowser.storage
                .from('payment-proofs')
                .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type });
            if (uploadError) throw new Error(uploadError.message);

            const { data } = supabaseBrowser.storage.from('payment-proofs').getPublicUrl(fileName);
            if (!data?.publicUrl) throw new Error('Não foi possível gerar link.');

            setProofUrl(data.publicUrl);

            // Save to backend
            const token = await getToken();
            if (token) {
                await fetch('/api/auction/winner', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ item_id: itemId, receipt_url: data.publicUrl })
                });
            }
        } catch (err: any) {
            setError(err.message || 'Falha ao carregar comprovativo.');
        } finally {
            setUploadingProof(false);
            if (e.target) e.target.value = '';
        }
    };

    // ── Paid / Shipped ──
    if (isPaid || localPaid) {
        return (
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    <div>
                        <p className="text-emerald-800 font-bold text-lg">
                            {itemStatus === 'shipped' ? 'Peça enviada!' : 'Pagamento confirmado!'}
                        </p>
                        <p className="text-emerald-600 text-sm">
                            {itemStatus === 'shipped'
                                ? 'A sua peça foi despachada. Receberá em breve.'
                                : 'O seu pagamento foi verificado e registado com sucesso.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (confirmStatus === 'confirming') {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 animate-spin text-yellow-500 mb-4" />
                <h3 className="font-bold text-slate-900 text-lg mb-2">A verificar o seu pagamento...</h3>
                <p className="text-slate-500 text-sm">Por favor aguarde um momento enquanto comunicamos com a entidade bancária.</p>
            </div>
        );
    }

    // ── Main flow ──
    return (
        <div className="space-y-5">
            {/* Congratulations */}
            <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
                <div className="flex items-start gap-4">
                    <Trophy className="w-10 h-10 text-yellow-600 shrink-0 mt-1" />
                    <div>
                        <p className="text-yellow-900 font-bold text-xl">Parabéns, ganhou o leilão!</p>
                        <p className="text-yellow-700 text-sm mt-1">
                            O seu lance de <strong>{(winningBid / 100).toFixed(0)}€</strong> foi o vencedor para{' '}
                            <em>{itemTitle}</em>.
                        </p>
                        {hoursLeft !== null && hoursLeft > 0 && (
                            <p className="text-yellow-600 text-xs mt-2 bg-yellow-100 inline-block px-3 py-1 rounded-full font-bold">
                                ⏰ Tem {hoursLeft}h para completar o pagamento
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 1: Shipping */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    1. Morada de Envio
                </h3>
                {shippingSaved ? (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium text-sm">Morada guardada com sucesso!</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <input value={shippingName} onChange={e => setShippingName(e.target.value)} placeholder="Nome completo *" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-yellow-500 outline-none" />
                        <input value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Morada completa *" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-yellow-500 outline-none" />
                        <div className="grid grid-cols-2 gap-3">
                            <input value={shippingPostal} onChange={e => setShippingPostal(e.target.value)} placeholder="Código Postal *" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-yellow-500 outline-none" />
                            <input value={shippingCity} onChange={e => setShippingCity(e.target.value)} placeholder="Cidade *" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-yellow-500 outline-none" />
                        </div>
                        <input value={shippingPhone} onChange={e => setShippingPhone(e.target.value)} placeholder="Telefone (opcional)" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-yellow-500 outline-none" />
                        <button onClick={handleSaveShipping} disabled={savingShipping} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {savingShipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                            Guardar Morada
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Payment Method Selection — Same as DonationModal */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-slate-400" />
                    2. Método de Pagamento — {(winningBid / 100).toFixed(0)}€
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    {UNIFIED_DONATION_PAYMENT_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => setSelectedPaymentId(opt.id)}
                            className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all relative overflow-hidden ${selectedPaymentId === opt.id
                                ? 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500'
                                : 'border-slate-100 hover:border-slate-300'
                                } ${opt.highlight ? 'ring-1 ring-green-500/30 bg-green-50/50' : ''}`}
                        >
                            {opt.highlight && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg">
                                    Novo
                                </div>
                            )}
                            {opt.iconSrc ? (
                                <img src={opt.iconSrc} alt={opt.iconAlt || opt.label} className="w-8 h-8 object-contain" />
                            ) : (
                                <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg">
                                    <Landmark className="w-5 h-5 text-slate-400" />
                                </div>
                            )}
                            <div>
                                <div className="font-bold text-sm text-slate-900">{opt.label}</div>
                                <div className="text-xs text-slate-500">{opt.description}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Online Payment CTA */}
                {!isBankTransfer && (
                    <div className="space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Montante a pagar</p>
                            <p className="text-3xl font-bold text-slate-900">{(winningBid / 100).toFixed(2)}€</p>
                        </div>
                        <button
                            onClick={handleOnlinePayment}
                            disabled={processingPayment}
                            className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-yellow-500/25 disabled:opacity-50"
                        >
                            {processingPayment ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5" />
                                    Pagar com {selectedPayment.label}
                                </>
                            )}
                        </button>
                        <p className="text-xs text-slate-400 text-center">
                            Será redirecionado para a plataforma segura Reduniq.
                        </p>
                    </div>
                )}

                {/* Bank Transfer Details */}
                {isBankTransfer && (
                    <div className="space-y-4">
                        <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard className="w-20 h-20" /></div>
                            <div className="relative z-10">
                                <p className="text-[10px] uppercase font-bold text-yellow-400/80">IBAN</p>
                                <div
                                    className="text-lg font-mono font-bold cursor-pointer hover:text-yellow-400 break-all mt-1"
                                    onClick={() => {
                                        navigator.clipboard.writeText(bankTransferDetails.iban.replace(/\s/g, ''));
                                        setCopiedIban(true);
                                        setTimeout(() => setCopiedIban(false), 1800);
                                    }}
                                >
                                    {bankTransferDetails.iban}
                                </div>
                                {copiedIban && <p className="text-xs text-green-300 font-bold mt-1">IBAN copiado!</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                <div>
                                    <p className="text-[10px] uppercase text-yellow-400/80 mb-1">Titular</p>
                                    <p className="text-xs font-bold">{bankTransferDetails.beneficiary_name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-yellow-400/80 mb-1">Banco</p>
                                    <p className="text-xs font-bold">{bankTransferDetails.bank_name}</p>
                                </div>
                            </div>
                            {bankTransferDetails.bic_swift && (
                                <div className="border-t border-white/10 pt-4">
                                    <p className="text-[10px] uppercase text-yellow-400/80 mb-1">BIC/SWIFT</p>
                                    <p className="text-xs font-bold font-mono">{bankTransferDetails.bic_swift}</p>
                                </div>
                            )}
                            <div className="border-t border-white/10 pt-4">
                                <p className="text-[10px] uppercase text-yellow-400/80 mb-1">Montante exato</p>
                                <p className="text-yellow-400 font-bold text-2xl">{(winningBid / 100).toFixed(2)}€</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Step 3: Receipt Upload (bank transfer only) */}
            {isBankTransfer && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <Upload className="w-5 h-5 text-slate-400" />
                        3. Enviar Comprovativo
                    </h3>

                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-4">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3">
                                {uploadingProof ? <Loader2 className="w-6 h-6 animate-spin text-yellow-500" /> : <Upload className="w-6 h-6 text-slate-400" />}
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm">Carregar Comprovativo</h4>
                            <p className="text-xs text-slate-500 max-w-[220px] mx-auto mt-1">
                                Acelera a verificação enviando uma foto ou PDF do comprovativo.
                            </p>
                        </div>

                        {proofUrl ? (
                            <div className="bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Comprovativo enviado!
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingProof}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 mx-auto"
                            >
                                {uploadingProof ? 'A processar...' : 'Selecionar Ficheiro'}
                            </button>
                        )}

                        <input type="file" ref={fileInputRef} onChange={handleUploadProof} className="hidden" accept="image/*,application/pdf" />

                        {!proofUrl && (
                            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100 font-semibold">
                                O comprovativo é obrigatório para confirmar o pagamento por transferência.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
