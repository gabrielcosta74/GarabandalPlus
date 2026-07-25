import { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, CreditCard, ChevronRight, Landmark, Upload, Loader2, AlertCircle, BrickWall, Square, Home, Hammer, Wind, ThermometerSun } from 'lucide-react';
import {
    formatPostalCode,
    getPostalInputMode,
    getPostalInvalidMessage,
    listCountryOptions,
    resolveCountryMeta,
    validatePostalCode,
} from '../../lib/country-utils';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useCurrency } from '../providers/CurrencyProvider';
import { UNIFIED_DONATION_PAYMENT_OPTIONS } from '../../lib/payment-options';
import {
    BANK_TRANSFER_SITE_CONTENT_KEY,
    DEFAULT_BANK_TRANSFER_DETAILS,
    normalizeBankTransferDetails,
} from '../../lib/bank-transfer-details';
import { useLocale } from '../../contexts/LocaleContext';
import { captureAnalyticsEvent } from '../../lib/analytics';

const impactOptions = [
    { value: 25, label: "Argamassas", impact: "Sacos de cimento para sanear paredes", icon: BrickWall },
    { value: 50, label: "Pavimento", impact: "1m² de cerâmica nova e durável", icon: Square },
    { value: 100, label: "Telhado", impact: "1m² de telhas e isolamento", icon: Home, popular: true },
    { value: 250, label: "Vigas", impact: "Tratamento das madeiras originais", icon: Hammer },
    { value: 500, label: "Janela", impact: "Vidro duplo eficiente", icon: Wind },
    { value: 1000, label: "Aquecimento", impact: "Radiadores para o inverno", icon: ThermometerSun },
];

const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error && error.message ? error.message : fallback
);

interface DonationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
    const { formatPrice, formatEUR, currency } = useCurrency();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [step, setStep] = useState(1);
    const [selectedPreset, setSelectedPreset] = useState(25);
    const [customAmount, setCustomAmount] = useState('');
    const [selectedPaymentId, setSelectedPaymentId] = useState(UNIFIED_DONATION_PAYMENT_OPTIONS[0].id);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [receiptRequired, setReceiptRequired] = useState(false);
    const [copiedIban, setCopiedIban] = useState(false);
    const [bankTransferDetails, setBankTransferDetails] = useState(DEFAULT_BANK_TRANSFER_DETAILS);

    // Proof state
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form Data
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        morada: '',
        cidade: '',
        codigoPostal: '',
        pais: locale === 'en' ? 'US' : 'PT',
        nif: '',
        mensagem: ''
    });

    useEffect(() => {
        const localizedDefaultCountry = isEn ? 'US' : 'PT';
        const previousDefaultCountry = isEn ? 'PT' : 'US';
        setFormData((prev) => (
            prev.pais === previousDefaultCountry
                ? { ...prev, pais: localizedDefaultCountry }
                : prev
        ));
    }, [isEn]);

    const amount = useMemo(() => {
        if (customAmount) {
            const parsed = Number(customAmount.replace(',', '.'));
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        }
        return selectedPreset;
    }, [customAmount, selectedPreset]);

    const selectedPayment = UNIFIED_DONATION_PAYMENT_OPTIONS.find(p => p.id === selectedPaymentId) || UNIFIED_DONATION_PAYMENT_OPTIONS[0];
    const countryOptions = useMemo(() => listCountryOptions(isEn ? 'en' : 'pt-PT'), [isEn]);
    const selectedCountryMeta = useMemo(() => resolveCountryMeta(formData.pais), [formData.pais]);
    const localizedImpactOptions = useMemo(() => impactOptions.map((option) => ({
        ...option,
        label: isEn
            ? ({
                Argamassas: 'Mortar',
                Pavimento: 'Flooring',
                Telhado: 'Roof',
                Vigas: 'Beams',
                Janela: 'Window',
                Aquecimento: 'Heating',
            } as Record<string, string>)[option.label] || option.label
            : option.label,
        impact: isEn
            ? ({
                'Sacos de cimento para sanear paredes': 'Bags of cement to stabilize walls',
                '1m² de cerâmica nova e durável': '1m² of durable new ceramic flooring',
                '1m² de telhas e isolamento': '1m² of roof tiles and insulation',
                'Tratamento das madeiras originais': 'Treatment of original timber beams',
                'Vidro duplo eficiente': 'Efficient double glazing',
                'Radiadores para o inverno': 'Radiators for winter',
            } as Record<string, string>)[option.impact] || option.impact
            : option.impact,
    })), [isEn]);
    const localizedPaymentOptions = useMemo(() => UNIFIED_DONATION_PAYMENT_OPTIONS.map((option) => ({
        ...option,
        label: isEn
            ? ({
                'Cartão de Crédito': 'Credit Card',
                'Transferência Bancária': 'Bank Transfer',
            } as Record<string, string>)[option.label] || option.label
            : option.label,
        description: isEn
            ? ({
                'Pagamento instantâneo': 'Instant payment',
                'Pagamento de serviços': 'Service payment',
                'Transferência manual': 'Manual transfer',
            } as Record<string, string>)[option.description] || option.description
            : option.description,
        badge: option.badge && isEn ? 'New' : option.badge,
        iconAlt: option.iconAlt && isEn ? ({ 'Cartão de Crédito': 'Credit Card' } as Record<string, string>)[option.iconAlt] || option.iconAlt : option.iconAlt,
    })), [isEn]);

    const nifLabel = formData.pais === 'BR' ? 'CPF' : formData.pais === 'PT' ? 'NIF' : isEn ? 'Tax ID' : 'NIF';
    const postalPlaceholder = selectedCountryMeta?.postalPlaceholder || (isEn ? 'Postal code / ZIP' : 'Código postal');

    useEffect(() => {
        if (!isOpen) return;
        captureAnalyticsEvent('donation_modal_opened', { locale });
    }, [isOpen, locale]);

    useEffect(() => {
        if (!isOpen) return;
        captureAnalyticsEvent('donation_step_viewed', {
            step,
            locale,
        });
    }, [isOpen, locale, step]);

    useEffect(() => {
        const fetchBankTransferDetails = async () => {
            if (!supabaseBrowser) return;

            const { data } = await supabaseBrowser
                .from('site_content')
                .select('content')
                .eq('key', BANK_TRANSFER_SITE_CONTENT_KEY)
                .maybeSingle();

            if (data?.content) {
                setBankTransferDetails(normalizeBankTransferDetails(data.content));
            }
        };

        fetchBankTransferDetails();
    }, []);

    const isValidNif = (value: string, country: string) => {
        const digits = value.replace(/\D/g, '');
        if (!digits) return true;
        if (country === 'PT') return digits.length === 9;
        if (country === 'BR') return digits.length === 11;
        return digits.length >= 6;
    };

    const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!supabaseBrowser) {
            setError(isEn ? 'Error: Supabase client not initialized.' : "Erro: Cliente Supabase não inicializado.");
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError(isEn ? 'Invalid file type. Use JPG, PNG, WEBP, HEIC or PDF.' : "Tipo de ficheiro inválido. Use JPG, PNG, WEBP, HEIC ou PDF.");
            return;
        }

        // Limit to 10MB just in case
        if (file.size > 10 * 1024 * 1024) {
            setError(isEn ? 'The file is too large (maximum 10MB).' : "O ficheiro é demasiado grande (máximo 10MB).");
            return;
        }

        setUploadingProof(true);
        setError(null);

        try {
            console.log('Iniciando upload de:', file.name, file.type, file.size);
            const ext = file.name.split('.').pop() || 'file';
            // Simplify filename: remove folder and keep it short
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            // Create a timeout to prevent infinite loading
            const uploadWithTimeout = async () => {
                const uploadPromise = supabaseBrowser.storage
                    .from('payment-proofs')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: true,
                        contentType: file.type // Explicitly set content type
                    });

                const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(isEn ? 'The upload took too long (timeout). Please check your connection.' : "O envio demorou demasiado tempo (timeout). Verifique a sua ligação.")), 45000)
                );

                return await Promise.race([uploadPromise, timeout]);
            };

            const { error: uploadError } = await uploadWithTimeout();

            if (uploadError) {
                console.error('Erro no upload Storage:', uploadError);
                throw new Error(uploadError.message || (isEn ? 'Error while saving the file on the server.' : "Erro ao guardar o ficheiro no servidor."));
            }

            console.log('Upload bem sucedido, obtendo URL pública...');
            const { data } = supabaseBrowser.storage
                .from('payment-proofs')
                .getPublicUrl(fileName);

            if (!data?.publicUrl) throw new Error(isEn ? 'Could not generate a file link.' : "Não foi possível gerar link para o ficheiro.");

            setProofUrl(data.publicUrl);
            console.log('URL de prova definida:', data.publicUrl);
        } catch (err: unknown) {
            console.error('Erro fatal no upload:', err);
            setError(getErrorMessage(err, isEn ? 'Failed to upload proof of payment. Please try again or use another format.' : "Falha ao carregar comprovativo. Tente novamente ou use outro formato."));
        } finally {
            setUploadingProof(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleManualDonation = async () => {
        if (uploadingProof) {
            setError(isEn ? 'Please wait: proof of payment is still uploading.' : "Aguarde: o comprovativo ainda está a ser carregado.");
            return;
        }

        if (!proofUrl) {
            setError(isEn ? 'To complete by bank transfer, proof of payment is required.' : "Para concluir por transferência bancária, é obrigatório enviar o comprovativo.");
            return;
        }

        setLoading(true);
        setError(null);
        captureAnalyticsEvent('donation_payment_submitted', {
            amount,
            payment_provider: 'bank_transfer',
            receipt_requested: receiptRequired,
            locale,
        });
        try {
            const res = await fetch('/api/donations/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    donorName: formData.nome,
                    donorEmail: formData.email,
                    donorAddress: formData.morada,
                    donorCity: formData.cidade,
                    donorZip: formData.codigoPostal,
                    donorCountry: formData.pais || undefined,
                    donorNif: formData.nif,
                    donorMessage: formData.mensagem,
                    proofUrl,
                    receiptRequired
                })
            });

            if (!res.ok) {
                const body = await res.json() as { message?: string };
                throw new Error(body.message || (isEn ? 'Error while registering donation.' : "Erro ao registar doação."));
            }

            setStep(4); // Success step
            captureAnalyticsEvent('donation_manual_registered', {
                amount,
                payment_provider: 'bank_transfer',
                receipt_requested: receiptRequired,
                locale,
            });
        } catch (err: unknown) {
            setError(getErrorMessage(err, isEn ? 'Could not register the donation. Please check the details and try again.' : "Não foi possível registar a doação. Verifique os dados e tente novamente."));
            captureAnalyticsEvent('donation_payment_failed', {
                amount,
                payment_provider: 'bank_transfer',
                locale,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNextStep = () => {
        setError(null);
        if (step === 1) {
            if (amount < 1) {
                setError(isEn ? 'The minimum amount is 1.' : "O valor mínimo é 1.");
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (!formData.nome.trim() || !formData.email.trim()) {
                setError(isEn ? 'Name and email are required.' : "Nome e email são obrigatórios.");
                return;
            }
            if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                setError(isEn ? 'Invalid email.' : "Email inválido.");
                return;
            }

            if (receiptRequired) {
                if (!formData.morada || !formData.cidade || !formData.codigoPostal || !formData.pais) {
                    setError(isEn ? 'Full address is required for the receipt.' : "Endereço completo é necessário para o recibo fiscal.");
                    return;
                }
                if (formData.codigoPostal && !validatePostalCode(formData.pais, formData.codigoPostal)) {
                    setError(getPostalInvalidMessage(formData.pais, isEn ? 'en' : 'pt-PT'));
                    return;
                }
                const nifClean = formData.nif.replace(/\D/g, '');
                if (nifClean && !isValidNif(nifClean, formData.pais)) {
                    setError(isEn ? `Invalid ${nifLabel}.` : `${nifLabel} inválido.`);
                    return;
                }
            }

            if (selectedPaymentId === 'bank_transfer') {
                setStep(3);
            } else {
                handleCheckout();
            }
        }
    };

    const handleCheckout = async () => {
        setLoading(true);
        setError(null);

        const chosenProvider = selectedPayment.provider === 'reduniq' ? 'reduniq' : 'stripe';
        captureAnalyticsEvent('donation_payment_submitted', {
            amount,
            payment_provider: chosenProvider,
            payment_method: selectedPaymentId,
            receipt_requested: receiptRequired,
            locale,
        });
        try {
            // Checkout for donations (Stripe or Reduniq)
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    type: 'donation',
                    locale,
                    provider: chosenProvider,
                    paymentOptionId: selectedPaymentId,
                    donorName: formData.nome,
                    donorEmail: formData.email,
                    donorAddress: receiptRequired ? formData.morada : null,
                    donorCity: receiptRequired ? formData.cidade : null,
                    donorZip: receiptRequired ? formData.codigoPostal : null,
                    donorCountry: formData.pais || undefined,
                    donorNif: receiptRequired ? formData.nif.replace(/\D/g, '') : null,
                    donorMessage: formData.mensagem || null,
                    receiptRequired,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { message?: string };
                throw new Error(body?.message || (isEn ? 'Error starting donation.' : "Erro ao iniciar doação."));
            }

            const { url } = await res.json();
            if (!url) throw new Error(isEn ? 'Server response error.' : "Erro de resposta do servidor.");

            captureAnalyticsEvent('donation_payment_started', {
                amount,
                payment_provider: chosenProvider,
                payment_method: selectedPaymentId,
                receipt_requested: receiptRequired,
                locale,
            });

            window.location.href = url;
        } catch (err: unknown) {
            setError(getErrorMessage(err, isEn ? 'Could not start the donation.' : 'Não foi possível iniciar a doação.'));
            captureAnalyticsEvent('donation_payment_failed', {
                amount,
                payment_provider: chosenProvider,
                payment_method: selectedPaymentId,
                locale,
            });
            setLoading(false);
        }
    };

    const canSubmitManualDonation = !!proofUrl && !uploadingProof && !loading;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                                <h3 className="text-2xl font-serif mb-2">{isEn ? 'Your donation' : 'A tua doação'}</h3>
                                <p className="text-gray-400 text-sm">{isEn ? 'Renew the House of Welcome' : 'Renova a Casa de Acolhimento'}</p>
                            </div>
                            <div className="relative z-10 space-y-6">
                                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md">
                                    <span className="text-xs text-garabandal-gold uppercase tracking-wider font-bold">{isEn ? 'Amount' : 'Valor'}</span>
                                    <div className="text-3xl font-serif mt-1">{formatEUR(amount)}</div>
                                    {currency !== 'EUR' && (
                                        <div className="text-base text-white/60 font-semibold mt-0.5">≈ {formatPrice(amount)}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 flex flex-col max-h-[90vh] overflow-y-auto bg-white">
                            <div className="p-6 md:p-8 flex-1">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map((s) => (
                                            <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${step >= s ? 'bg-garabandal-gold' : 'bg-gray-100'}`} />
                                        ))}
                                    </div>
                                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>

                                {step === 1 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                        <div>
                                            <h2 className="text-2xl font-bold text-garabandal-dark mb-2">{isEn ? 'Choose an amount' : 'Escolhe o valor'}</h2>
                                            <p className="text-gray-500">{isEn ? 'Every contribution makes a difference.' : 'Cada contribuição faz a diferença.'}</p>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {localizedImpactOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => { setSelectedPreset(option.value); setCustomAmount(''); }}
                                                    className={`relative p-4 rounded-xl border-2 text-left transition-all group overflow-hidden ${selectedPreset === option.value && !customAmount
                                                        ? 'border-garabandal-gold bg-garabandal-gold/10 ring-1 ring-garabandal-gold'
                                                        : 'border-gray-100 hover:border-garabandal-gold/50 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {option.popular && (
                                                        <div className="absolute top-0 right-0 bg-garabandal-gold text-garabandal-dark text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                                                            {isEn ? 'Popular' : 'Popular'}
                                                        </div>
                                                    )}

                                                    <div className={`mb-3 p-2 rounded-lg w-fit transition-colors ${selectedPreset === option.value && !customAmount
                                                        ? 'bg-garabandal-gold text-white'
                                                        : 'bg-gray-100 text-gray-500 group-hover:text-garabandal-dark'
                                                        }`}>
                                                        <option.icon className="w-5 h-5" />
                                                    </div>

                                                    <div>
                                                        <div className="text-xl font-serif font-bold text-garabandal-dark mb-0.5">
                                                            {formatEUR(option.value)}
                                                        </div>
                                                        {currency !== 'EUR' && (
                                                            <div className="text-sm text-gray-500 font-semibold mb-0.5">≈ {formatPrice(option.value)}</div>
                                                        )}
                                                        <div className="font-bold text-xs text-gray-900 mb-1">{option.label}</div>
                                                        <div className="text-[10px] leading-tight text-gray-500 line-clamp-2">
                                                            {option.impact}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}

                                            {/* Custom Amount Field - Full Width or grid item */}
                                            <div className="col-span-2 md:col-span-3 mt-2">
                                                <div className="relative">
                                                    <input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setSelectedPreset(0); }}
                                                        className={`w-full p-4 text-center rounded-xl border-2 transition-all outline-none font-bold placeholder:font-normal ${customAmount ? 'border-garabandal-gold text-garabandal-dark ring-1 ring-garabandal-gold' : 'border-gray-100 text-gray-600 focus:border-garabandal-gold/50'}`}
                                                        placeholder={isEn ? 'Other amount (€) - Define your own impact' : 'Outro valor (€) - Define o teu próprio impacto'} />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-garabandal-dark mb-4">{isEn ? 'Payment Method' : 'Método de Pagamento'}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {localizedPaymentOptions.map((opt) => (
                                                    <button key={opt.id} onClick={() => setSelectedPaymentId(opt.id)}
                                                        className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all relative overflow-hidden ${selectedPaymentId === opt.id ? 'border-garabandal-gold bg-garabandal-gold/5 ring-1 ring-garabandal-gold' : 'border-gray-100 hover:border-gray-300'} ${opt.highlight ? 'ring-1 ring-green-500/30 bg-green-50/50' : ''}`}>
                                                        {opt.highlight && (
                                                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg">
                                                                {isEn ? 'New' : 'Novo'}
                                                            </div>
                                                        )}
                                                        {opt.iconSrc ? (
                                                            <Image src={opt.iconSrc} alt={opt.iconAlt || opt.label} width={32} height={32} className="w-8 h-8 object-contain" />
                                                        ) : (
                                                            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg"><Landmark className="w-5 h-5 text-gray-400" /></div>
                                                        )}
                                                        <div><div className="font-bold text-sm text-garabandal-dark">{opt.label}</div><div className="text-xs text-gray-500">{opt.description}</div></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-garabandal-dark mb-1">{isEn ? 'Your details' : 'Os teus dados'}</h2>
                                            <p className="text-sm text-gray-500">{isEn ? 'Tell us who is supporting this mission.' : 'Mantém-nos informados sobre quem apoia esta missão.'}</p>
                                        </div>

                                        <div className="bg-garabandal-gold/5 border border-garabandal-gold/20 rounded-2xl p-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-garabandal-dark">{isEn ? 'Do you want a receipt?' : 'Desejas um recibo fiscal?'}</p>
                                                <p className="text-xs text-gray-500">{isEn ? 'Useful for tax purposes in Portugal.' : 'Para benefícios fiscais em Portugal.'}</p>
                                            </div>
                                            <button
                                                onClick={() => setReceiptRequired(!receiptRequired)}
                                                className={`w-14 h-7 rounded-full transition-all relative ${receiptRequired ? 'bg-garabandal-gold' : 'bg-gray-200'}`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${receiptRequired ? 'left-8' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="col-span-1 md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">{isEn ? 'Full Name' : 'Nome Completo'}</label>
                                                <input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold outline-none transition-all" placeholder={isEn ? 'Your name' : 'Teu nome'} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Email</label>
                                                <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold outline-none transition-all" placeholder="exemplo@email.com" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">{isEn ? 'Country' : 'País'}</label>
                                                <select value={formData.pais} onChange={e => setFormData({ ...formData, pais: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                                                    {countryOptions.map((country) => (
                                                        <option key={country.code} value={country.code}>
                                                            {country.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {receiptRequired && (
                                                <>
                                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-sm font-medium text-gray-700">{isEn ? 'Postal Code / ZIP' : 'Código Postal / CEP'}</label>
                                                        <input value={formData.codigoPostal} onChange={e => setFormData({ ...formData, codigoPostal: formatPostalCode(e.target.value, formData.pais) })}
                                                            inputMode={getPostalInputMode(formData.pais)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder={postalPlaceholder} />
                                                    </div>
                                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-sm font-medium text-gray-700">{nifLabel}</label>
                                                        <input value={formData.nif} onChange={e => setFormData({ ...formData, nif: e.target.value })}
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder={isEn ? `Your ${nifLabel}` : 'Teu NIF/CPF'} />
                                                    </div>
                                                    <div className="col-span-1 md:col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-sm font-medium text-gray-700">{isEn ? 'Address' : 'Morada'}</label>
                                                        <input value={formData.morada} onChange={e => setFormData({ ...formData, morada: e.target.value })}
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder={isEn ? 'Street, number, floor' : 'Rua, número, andar'} />
                                                    </div>
                                                    <div className="col-span-1 md:col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                                                        <label className="text-sm font-medium text-gray-700">{isEn ? 'City' : 'Cidade'}</label>
                                                        <input value={formData.cidade} onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder={isEn ? 'Your city' : 'Sua cidade'} />
                                                    </div>
                                                </>
                                            )}

                                            <div className="col-span-1 md:col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">{isEn ? 'Message (Optional)' : 'Mensagem (Opcional)'}</label>
                                                <textarea value={formData.mensagem} onChange={e => setFormData({ ...formData, mensagem: e.target.value })}
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none h-24 resize-none" placeholder={isEn ? 'Leave a message of support.' : 'Deixe uma mensagem de apoio.'} />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 3 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                        <div className="text-center">
                                            <h2 className="text-2xl font-bold text-garabandal-dark mb-2">{isEn ? 'Bank Transfer Details' : 'Dados da Transferência'}</h2>
                                            <p className="text-gray-500 text-sm">
                                                {isEn
                                                ? <>To complete the donation of <strong>{formatEUR(amount)}</strong>{currency !== 'EUR' && <> (≈ {formatPrice(amount)})</>}.</>
                                                : <>Para concluir a doação de <strong>{formatEUR(amount)}</strong>{currency !== 'EUR' && <> (≈ {formatPrice(amount)})</>}.</>
                                            }
                                            </p>
                                        </div>

                                        <div className="bg-garabandal-dark text-white rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard className="w-20 h-20" /></div>
                                            <div className="space-y-1 relative z-10">
                                                <p className="text-[10px] uppercase font-bold text-garabandal-gold/80">IBAN</p>
                                                <div className="text-lg md:text-xl font-mono font-bold cursor-pointer hover:text-garabandal-gold break-all"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(bankTransferDetails.iban);
                                                        setCopiedIban(true);
                                                        setTimeout(() => setCopiedIban(false), 1800);
                                                    }}>
                                                    {bankTransferDetails.iban}
                                                </div>
                                                {copiedIban && <p className="text-xs text-green-300 font-bold mt-1">{isEn ? 'IBAN copied' : 'IBAN copiado'}</p>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                                <div><p className="text-[10px] uppercase text-garabandal-gold/80 mb-1">{isEn ? 'Beneficiary' : 'Titular'}</p><p className="text-xs font-bold">{bankTransferDetails.beneficiary_name}</p></div>
                                                <div><p className="text-[10px] uppercase text-garabandal-gold/80 mb-1">{isEn ? 'Bank' : 'Banco'}</p><p className="text-xs font-bold">{bankTransferDetails.bank_name}</p></div>
                                            </div>
                                            {(bankTransferDetails.bic_swift || bankTransferDetails.reference_note) && (
                                                <div className="grid grid-cols-1 gap-2 border-t border-white/10 pt-4">
                                                    {bankTransferDetails.bic_swift && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-garabandal-gold/80 mb-1">BIC/SWIFT</p>
                                                            <p className="text-xs font-bold">{bankTransferDetails.bic_swift}</p>
                                                        </div>
                                                    )}
                                                    {bankTransferDetails.reference_note && (
                                                        <div>
                                                            <p className="text-[10px] uppercase text-garabandal-gold/80 mb-1">{isEn ? 'Reference' : 'Referência'}</p>
                                                            <p className="text-xs">{bankTransferDetails.reference_note}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {(bankTransferDetails.address_street || bankTransferDetails.address_postal_code || bankTransferDetails.address_city || bankTransferDetails.address_country) && (
                                                <div className="border-t border-white/10 pt-4">
                                                    <p className="text-[10px] uppercase text-garabandal-gold/80 mb-1">{isEn ? 'Address' : 'Morada'}</p>
                                                    <p className="text-xs">
                                                        {[
                                                            bankTransferDetails.address_street,
                                                            [bankTransferDetails.address_postal_code, bankTransferDetails.address_city].filter(Boolean).join(' '),
                                                            bankTransferDetails.address_country
                                                        ]
                                                            .filter((part) => part && part.trim().length > 0)
                                                            .join(', ')}
                                                    </p>
                                                </div>
                                            )}
                                            {bankTransferDetails.support_email && (
                                                <p className="text-[11px] text-gray-200 border-t border-white/10 pt-3">
                                                    {isEn ? 'Questions' : 'Dúvidas'}: {bankTransferDetails.support_email}
                                                </p>
                                            )}
                                        </div>

                                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3">
                                                    {uploadingProof ? <Loader2 className="w-6 h-6 animate-spin text-garabandal-gold" /> : <Upload className="w-6 h-6 text-gray-400" />}
                                                </div>
                                                <h4 className="font-bold text-garabandal-dark text-sm">{isEn ? 'Upload Proof of Payment' : 'Carregar Comprovativo'}</h4>
                                                <p className="text-xs text-gray-500 max-w-[200px] mx-auto mt-1">
                                                    {isEn ? 'Speed up verification by sending a photo or PDF of the proof.' : 'Acelera a verificação enviando uma foto ou PDF do comprovativo.'}
                                                </p>
                                            </div>

                                            {proofUrl ? (
                                                <div className="bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                                    <CheckCircle className="w-4 h-4" /> {isEn ? 'Proof Uploaded!' : 'Comprovativo Carregado!'}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={uploadingProof}
                                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-2 mx-auto"
                                                >
                                                    {uploadingProof ? (isEn ? 'Processing...' : 'A processar...') : (isEn ? 'Select File' : 'Selecionar Ficheiro')}
                                                </button>
                                            )}

                                            <input type="file" ref={fileInputRef} onChange={handleUploadProof} className="hidden" accept="image/*,application/pdf" />

                                            {!proofUrl && (
                                                <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs font-semibold border border-amber-100">
                                                    {isEn ? 'Proof of payment is required to complete the donation by bank transfer.' : 'O comprovativo é obrigatório para concluir a doação por transferência bancária.'}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleManualDonation}
                                            disabled={!canSubmitManualDonation}
                                            className="w-full py-4 bg-garabandal-dark text-white font-bold rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                            {uploadingProof
                                                ? (isEn ? 'Uploading proof...' : 'A carregar comprovativo...')
                                                : !proofUrl
                                                    ? (isEn ? 'Attach proof to continue' : 'Anexa o comprovativo para continuar')
                                                    : (isEn ? 'Finish and Submit' : 'Concluir e Enviar')}
                                        </button>
                                    </motion.div>
                                )}

                                {step === 4 && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center text-center py-12 space-y-6">
                                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                            <CheckCircle className="w-12 h-12" />
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className="text-3xl font-serif font-bold text-garabandal-dark">{isEn ? 'Thank You Very Much!' : 'Muitíssimo Obrigado!'}</h2>
                                            <p className="text-gray-500 max-w-sm mx-auto">
                                                {isEn ? 'We received your submission. We will validate the transfer and you will soon receive a confirmation email.' : 'Recebemos o teu registo. Vamos validar a transferência e em breve receberás um email de confirmação.'}
                                            </p>
                                        </div>
                                        <button onClick={onClose} className="px-10 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-all">
                                            {isEn ? 'Close' : 'Fechar'}
                                        </button>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            {step < 4 && (
                                <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                                    {error && <div className="absolute bottom-24 left-6 right-6 p-3 bg-red-100 text-red-700 text-xs rounded-lg text-center font-bold flex items-center gap-2 justify-center animate-in fade-in slide-in-from-bottom-2"><AlertCircle className="w-4 h-4" />{error}</div>}
                                    <button onClick={() => { if (step === 1) onClose(); else setStep(step - 1); }}
                                        className="px-6 py-3 font-medium text-gray-500 hover:text-gray-800 transition-colors">
                                        {step === 1 ? (isEn ? 'Cancel' : 'Cancelar') : (isEn ? 'Back' : 'Voltar')}
                                    </button>
                                    {step < 3 && (
                                        <button onClick={handleNextStep} disabled={loading}
                                            className="px-8 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50">
                                            {loading ? (isEn ? 'Processing...' : 'A processar...') : <>{step === 1 ? (isEn ? 'Continue' : 'Continuar') : (isEn ? 'Confirm Donation' : 'Confirmar Doação')} <ChevronRight className="w-4 h-4" /></>}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
