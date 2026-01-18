import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, CreditCard, ChevronRight } from 'lucide-react';
import { formatPostalCode, getPostalInputMode, getPostalInvalidMessage, validatePostalCode } from '../../lib/country-utils';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useCurrency } from '../providers/CurrencyProvider';

// ---- Types ----
type PaymentOption = {
    id: string;
    label: string;
    description: string;
    provider: 'stripe' | 'reduniq';
    solution?: number;
    iconSrc?: string;
    iconAlt: string;
};

const paymentOptions: PaymentOption[] = [
    {
        id: 'stripe',
        label: 'Cartão / Apple Pay',
        description: 'Processado via Stripe.',
        provider: 'stripe',
        iconSrc: '/payment-icons/cards.svg',
        iconAlt: 'Stripe',
    },
    {
        id: 'reduniq-mbway',
        label: 'MB WAY',
        description: 'Pagamento imediato.',
        provider: 'reduniq',
        solution: 107,
        iconSrc: '/payment-icons/mbway.svg',
        iconAlt: 'MB WAY',
    },
    {
        id: 'reduniq-mb',
        label: 'Multibanco',
        description: 'Pagamento de Serviços.',
        provider: 'reduniq',
        solution: 108,
        iconSrc: '/payment-icons/multibanco.svg',
        iconAlt: 'Multibanco',
    },
    {
        id: 'reduniq-pix',
        label: 'PIX',
        description: 'Para nossos irmãos do Brasil.',
        provider: 'reduniq',
        solution: 116,
        iconAlt: 'PIX',
    },
];

const quickAmounts = [10, 25, 50, 100, 250];

interface DonationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
    const { formatPrice, currency } = useCurrency();
    const [step, setStep] = useState(1);
    const [selectedPreset, setSelectedPreset] = useState(25);
    const [customAmount, setCustomAmount] = useState('25');
    const [selectedPaymentId, setSelectedPaymentId] = useState(paymentOptions[0].id);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form Data
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        morada: '',
        cidade: '',
        codigoPostal: '',
        pais: 'PT',
        nif: '',
        mensagem: ''
    });

    const amount = useMemo(() => {
        const parsed = Number(customAmount.replace(',', '.'));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : selectedPreset;
    }, [customAmount, selectedPreset]);

    const selectedPayment = paymentOptions.find(p => p.id === selectedPaymentId) || paymentOptions[0];

    const nifLabel = formData.pais === 'BR' ? 'CPF' : 'NIF';

    const isValidNif = (value: string, country: string) => {
        const digits = value.replace(/\D/g, '');
        if (!digits) return true; // Optional by default unless enforced logic changes
        if (country === 'PT') return digits.length === 9;
        if (country === 'BR') return digits.length === 11;
        return digits.length >= 6;
    };

    const handleNextStep = () => {
        setError(null);
        if (step === 1) {
            if (amount < 1) {
                setError("O valor mínimo é 1.");
                return;
            }
            setStep(2);
        } else if (step === 2) {
            // Validation
            if (!formData.nome.trim() || !formData.email.trim()) {
                setError("Nome e email são obrigatórios.");
                return;
            }
            if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                setError("Email inválido.");
                return;
            }
            /* Validation eased for donations, usually just email is critical, but let's keep name */
            /*
            if (!formData.morada || !formData.cidade || !formData.codigoPostal) {
                setError("Endereço completo é necessário para o recibo.");
                return;
            }
            */
            if (formData.codigoPostal && !validatePostalCode(formData.pais, formData.codigoPostal)) {
                setError(getPostalInvalidMessage(formData.pais));
                return;
            }

            const nifClean = formData.nif.replace(/\D/g, '');
            if (nifClean && !isValidNif(nifClean, formData.pais)) {
                setError(`${nifLabel} inválido.`);
                return;
            }

            // Proceed to Payment
            handleCheckout();
        }
    };

    const handleCheckout = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    currency, // Pass current currency context
                    type: 'donation',
                    provider: selectedPayment.provider,
                    reduniqSolution: selectedPayment.solution,
                    donorName: formData.nome,
                    donorEmail: formData.email,
                    donorAddress: formData.morada,
                    donorCity: formData.cidade,
                    donorZip: formData.codigoPostal,
                    donorCountry: formData.pais,
                    donorNif: formData.nif.replace(/\D/g, '') || null,
                    donorMessage: formData.mensagem || null,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.message || "Erro ao iniciar pagamento.");
            }

            const { url, token } = await res.json();
            if (!url) throw new Error("Erro de resposta do servidor.");

            if (selectedPayment.provider === 'reduniq' && token) {
                // Store logic for Reduniq if needed
                localStorage.setItem('reduniq:lastPayment', JSON.stringify({ token, type: 'donation', amount }));
            }

            window.location.href = url;

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row"
                    >
                        {/* Sidebar */}
                        <div className="hidden md:flex w-1/3 bg-garabandal-dark text-white p-8 flex-col justify-between relative overflow-hidden">
                            <div className="absolute inset-0 bg-garabandal-gold/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />

                            <div className="relative z-10">
                                <h3 className="text-2xl font-serif mb-2">A tua doação</h3>
                                <p className="text-gray-400 text-sm">Renova a Casa de Acolhimento</p>
                            </div>

                            <div className="relative z-10 space-y-6">
                                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md">
                                    <span className="text-xs text-garabandal-gold uppercase tracking-wider font-bold">Valor</span>
                                    <div className="text-3xl font-serif mt-1">{formatPrice(amount)}</div>
                                </div>

                                {selectedPayment && (
                                    <div className="flex items-center gap-2 grayscale opacity-70">
                                        <img src="/payment-icons/stripe.svg" alt="Stripe" className="h-5" />
                                        <img src="/payment-icons/mbway.svg" alt="MBWay" className="h-5" />
                                        <img src="/payment-icons/multibanco.svg" alt="Multibanco" className="h-5" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 flex flex-col max-h-[90vh] overflow-y-auto bg-white">
                            <div className="p-6 md:p-8 flex-1">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-2">
                                        {[1, 2].map((s) => (
                                            <div
                                                key={s}
                                                className={`h-1.5 w-8 rounded-full transition-colors ${step >= s ? 'bg-garabandal-gold' : 'bg-gray-100'}`}
                                            />
                                        ))}
                                    </div>
                                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>

                                {step === 1 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-8"
                                    >
                                        <div>
                                            <h2 className="text-2xl font-bold text-garabandal-dark mb-2">Escolhe o valor</h2>
                                            <p className="text-gray-500">Cada contribuição faz a diferença.</p>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            {quickAmounts.map((val) => (
                                                <button
                                                    key={val}
                                                    onClick={() => { setSelectedPreset(val); setCustomAmount(String(val)); }}
                                                    className={`py-3 rounded-xl border-2 font-bold transition-all ${selectedPreset === val ? 'border-garabandal-gold bg-garabandal-gold/10 text-garabandal-dark' : 'border-gray-100 hover:border-garabandal-gold/50 text-gray-600'}`}
                                                >
                                                    {formatPrice(val)}
                                                </button>
                                            ))}
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={customAmount}
                                                    onChange={e => { setCustomAmount(e.target.value); setSelectedPreset(0); }}
                                                    className="w-full h-full px-4 text-center rounded-xl border-2 border-gray-100 focus:border-garabandal-gold outline-none font-bold text-garabandal-dark"
                                                    placeholder="Outro"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-garabandal-dark mb-4">Método de Pagamento</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {paymentOptions.map((opt) => (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => setSelectedPaymentId(opt.id)}
                                                        className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${selectedPaymentId === opt.id ? 'border-garabandal-gold bg-garabandal-gold/5 ring-1 ring-garabandal-gold' : 'border-gray-100 hover:border-gray-300'}`}
                                                    >
                                                        {opt.iconSrc && <img src={opt.iconSrc} alt={opt.iconAlt} className="w-8 h-8 object-contain" />}
                                                        <div>
                                                            <div className="font-bold text-sm text-garabandal-dark">{opt.label}</div>
                                                            <div className="text-xs text-gray-500">{opt.description}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-6"
                                    >
                                        <div>
                                            <h2 className="text-2xl font-bold text-garabandal-dark mb-2">Os teus dados</h2>
                                            <p className="text-gray-500">Necessário para a emissão do recibo.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="col-span-1 md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Nome Completo</label>
                                                <input
                                                    value={formData.nome}
                                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold focus:border-transparent outline-none transition-all"
                                                    placeholder="Como no Cartão de Cidadão"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Email</label>
                                                <input
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold focus:border-transparent outline-none transition-all"
                                                    placeholder="exemplo@email.com"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">País</label>
                                                <select
                                                    value={formData.pais}
                                                    onChange={e => setFormData({ ...formData, pais: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                                                >
                                                    <option value="PT">Portugal</option>
                                                    <option value="BR">Brasil</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Código Postal</label>
                                                <input
                                                    value={formData.codigoPostal}
                                                    onChange={e => setFormData({ ...formData, codigoPostal: formatPostalCode(e.target.value, formData.pais) })}
                                                    inputMode={getPostalInputMode(formData.pais)}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                                                    placeholder="0000-000"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">{nifLabel}</label>
                                                <input
                                                    value={formData.nif}
                                                    onChange={e => setFormData({ ...formData, nif: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                                                    placeholder="Opcional"
                                                />
                                            </div>
                                            <div className="col-span-1 md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Morada</label>
                                                <input
                                                    value={formData.morada}
                                                    onChange={e => setFormData({ ...formData, morada: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                                                    placeholder="Rua, número, andar"
                                                />
                                            </div>
                                            <div className="col-span-1 md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Cidade</label>
                                                <input
                                                    value={formData.cidade}
                                                    onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                                                    placeholder="Sua cidade"
                                                />
                                            </div>
                                            <div className="col-span-1 md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Mensagem (Opcional)</label>
                                                <textarea
                                                    value={formData.mensagem}
                                                    onChange={e => setFormData({ ...formData, mensagem: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none h-24 resize-none"
                                                    placeholder="Deixe uma intenção de oração ou mensagem de apoio."
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                                {error && <div className="absolute bottom-20 left-6 right-6 p-3 bg-red-100 text-red-700 text-sm rounded-lg text-center">{error}</div>}

                                <button
                                    onClick={() => step === 1 ? onClose() : setStep(1)}
                                    className="px-6 py-3 font-medium text-gray-500 hover:text-gray-800 transition-colors"
                                >
                                    {step === 1 ? 'Cancelar' : 'Voltar'}
                                </button>

                                <button
                                    onClick={handleNextStep}
                                    disabled={loading}
                                    className="px-8 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        'A processar...'
                                    ) : (
                                        <>
                                            {step === 1 ? 'Continuar' : 'Confirmar Doação'}
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
