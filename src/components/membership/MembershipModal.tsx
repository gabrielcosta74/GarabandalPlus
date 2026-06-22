"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Lock, ChevronLeft, CreditCard, Eye, EyeOff, QrCode, Gift } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { captureAnalyticsEvent } from "../../lib/analytics";
import { useAuth } from "../../contexts/AuthContext";
import {
    formatPostalCode,
    getPhoneInvalidMessage,
    getPostalInputMode,
    getPostalInvalidMessage,
    listCountryLabels,
    normalizePhone,
    resolveCountryMeta,
    validatePhone,
    validatePostalCode,
    withCountryPrefix,
} from "../../lib/country-utils";
import { useCurrency } from "../providers/CurrencyProvider";
import { GoogleButton } from "../auth/AuthLayout";
import { UNIFIED_ONLINE_PAYMENT_OPTIONS } from "../../lib/payment-options";
import { getMembershipAmountClient } from "../../lib/membership-pricing";
import { normalizeQuotaStatus } from "../../lib/membership-status";
import { useLocale } from "../../contexts/LocaleContext";

interface MembershipModalProps {
    isOpen: boolean;
    onClose: () => void;
    impact: { members: number; raised: number; goal: number };
    referralCode?: string;
}

const slideImages = [
    "/images/espalharpalavra.webp",
    "/images/descontoslivros.webp",
    "/images/associacao.webp",
];

const countryOptions = listCountryLabels();

// Helper Components (Defined outside to prevent re-renders)
const InputField = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div className="group">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1 group-focus-within:text-garabandal-gold transition-colors">
            {label}
        </label>
        <input
            {...props}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none transition-all duration-300
            text-gray-900 placeholder:text-gray-400
            focus:bg-white focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/10"
        />
    </div>
);

const PasswordInput = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="group">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1 group-focus-within:text-garabandal-gold transition-colors">
                {label}
            </label>
            <div className="relative">
                <input
                    {...props}
                    type={show ? "text" : "password"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none transition-all duration-300
                    text-gray-900 placeholder:text-gray-400 pr-12
                    focus:bg-white focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/10"
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-2"
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </div>
    );
};

const SelectField = ({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => (
    <div className="group relative">
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1 group-focus-within:text-garabandal-gold transition-colors">
            {label}
        </label>
        <div className="relative">
            <select
                {...props}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none transition-all duration-300 appearance-none
                text-gray-900 cursor-pointer
                focus:bg-white focus:border-garabandal-gold focus:ring-4 focus:ring-garabandal-gold/10"
            >
                {children}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronLeft className="rotate-[-90deg] w-4 h-4" />
            </div>
        </div>
    </div>
);

export default function MembershipModal({ isOpen, onClose, impact, referralCode }: MembershipModalProps) {
    const { formatPrice } = useCurrency();
    const { locale, t } = useLocale();
    const m = t.membership.modal;
    const slides = m.slides;
    const termsUrl = t.urls.terms;
    const privacyUrl = t.urls.privacy;
    const membershipAmount = getMembershipAmountClient();
    const modalOpenTrackedRef = useRef(false);
    const [step, setStep] = useState(1);
    const [slideIndex, setSlideIndex] = useState(0);

    // Auth State
    const [sessionUserId, setSessionUserId] = useState<string | null>(null);
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<"login" | "signup">("login");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isNewAccount, setIsNewAccount] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [manualReferralCode, setManualReferralCode] = useState(referralCode || "");
    const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState<string | null>(null);

    useEffect(() => {
        if (referralCode) setManualReferralCode(referralCode);
    }, [referralCode]);

    // Form Data
    const [formData, setFormData] = useState({
        nome: "",
        email: "",
        telefone: "",
        morada: "",
        codigoPostal: "",
        pais: "",
        nif: "",
    });

    // Payment
    const [selectedPaymentId, setSelectedPaymentId] = useState(UNIFIED_ONLINE_PAYMENT_OPTIONS[0].id);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [modalMemberData, setModalMemberData] = useState<Record<string, unknown> | null | undefined>(undefined);

    const countryMeta = useMemo(() => resolveCountryMeta(formData.pais), [formData.pais]);

    const selectedPayment = UNIFIED_ONLINE_PAYMENT_OPTIONS.find((o) => o.id === selectedPaymentId) || UNIFIED_ONLINE_PAYMENT_OPTIONS[0];
    const { user: authUser, memberData: authMemberData, refreshMemberData } = useAuth();
    const hasReferralCode = Boolean(manualReferralCode.trim() || referralCode);
    const getModalReturnPath = (refCode = manualReferralCode.trim()) => {
        const params = new URLSearchParams({ join: "1" });
        if (refCode) params.set("ref", refCode);
        return `${locale === 'en' ? '/en/become-member' : '/tornar-membro'}?${params.toString()}`;
    };
    const getAuthCallbackUrl = (refCode = manualReferralCode.trim()) => {
        const cbUrl = new URL('/auth-callback', window.location.origin);
        if (refCode) cbUrl.searchParams.set('ref', refCode);
        cbUrl.searchParams.set('locale', locale);
        cbUrl.searchParams.set('next', getModalReturnPath(refCode));
        return cbUrl.toString();
    };

    const trackMembershipEvent = (
        event: string,
        properties: Record<string, string | number | boolean | null | undefined> = {},
    ) => {
        captureAnalyticsEvent(event, {
            area: 'membership',
            locale,
            step,
            auth_mode: authMode,
            has_referral_code: hasReferralCode,
            has_session: Boolean(sessionUserId),
            ...properties,
        });
    };

    useEffect(() => {
        if (!isOpen) {
            modalOpenTrackedRef.current = false;
            return;
        }
        if (modalOpenTrackedRef.current) return;
        modalOpenTrackedRef.current = true;
        captureAnalyticsEvent('membership_modal_opened', {
            area: 'membership',
            locale,
            has_referral_code: hasReferralCode,
        });
    }, [isOpen, locale, hasReferralCode]);

    useEffect(() => {
        if (!isOpen) return;
        captureAnalyticsEvent('membership_modal_step_viewed', {
            area: 'membership',
            locale,
            step,
            auth_mode: authMode,
            has_referral_code: hasReferralCode,
            has_session: Boolean(sessionUserId),
        });
    }, [isOpen, step, locale, authMode, hasReferralCode, sessionUserId]);

    const loadLiveMemberData = async (userId: string) => {
        if (!supabaseBrowser) return null;
        const { data } = await supabaseBrowser
            .from('membros')
            .select('id, nome, email, telefone, nif, address, postal_code, country, numero_socio, is_membro, estado_quota, proxima_quota')
            .eq('id', userId)
            .maybeSingle();
        setModalMemberData(data || null);
        return data || null;
    };

    // Logic: Session
    useEffect(() => {
        if (!isOpen) return;
        const loadSession = async () => {
            setModalMemberData(undefined);
            if (authUser?.id) {
                setSessionUserId(authUser.id);
                setSessionEmail(authUser.email ?? null);
                setFormData((prev) => (prev.email ? prev : { ...prev, email: authUser.email || "" }));

                // Force fresh read from DB to avoid stale context after admin changes.
                await refreshMemberData();
                const liveData = await loadLiveMemberData(authUser.id);
                setIsNewAccount(!liveData);

                // Check if profile is complete
                const isComplete = liveData?.nome && liveData?.email && liveData?.telefone && liveData?.address && liveData?.postal_code && liveData?.country;
                if (isComplete) {
                    setStep(3);
                } else {
                    setStep(2);
                }
                return;
            }
            if (!supabaseBrowser) return;
            const { data } = await supabaseBrowser.auth.getSession();
            if (data.session?.user?.id) {
                setSessionUserId(data.session.user.id);
                setSessionEmail(data.session.user.email ?? null);
                setFormData((prev) => (prev.email ? prev : { ...prev, email: data.session?.user?.email || "" }));
                const liveData = await loadLiveMemberData(data.session.user.id);
                setIsNewAccount(!liveData);

                if (liveData?.nome && liveData?.email && liveData?.telefone && liveData?.address && liveData?.postal_code && liveData?.country) {
                    setStep(3);
                } else {
                    setStep(2);
                }
            } else {
                setModalMemberData(null);
                setStep(1);
            }
        };
        loadSession();

        // Carousel timer
        const timer = setInterval(() => {
            setSlideIndex((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isOpen, authUser]);

    // Logic: Load Member Profile from Context and Skip Step if Complete
    useEffect(() => {
        if (!isOpen) return;
        const profile = modalMemberData !== undefined ? modalMemberData : authMemberData;
        if (!profile) return;

        setFormData((prev) => ({
            nome: String(prev.nome || profile.nome || ""),
            email: String(prev.email || profile.email || authUser?.email || ""),
            telefone: String(prev.telefone || profile.telefone || ""),
            morada: String(prev.morada || profile.address || ""),
            codigoPostal: String(prev.codigoPostal || profile.postal_code || ""),
            pais: String(prev.pais || (profile.country ? (resolveCountryMeta(String(profile.country))?.name || profile.country) : "")),
            nif: String(prev.nif || profile.nif || ""),
        }));

        // Skip to payment if data is already robust (check mandatory fields)
        if (step === 2 &&
            profile.nome &&
            profile.email &&
            profile.telefone &&
            profile.address &&
            profile.postal_code &&
            profile.country) {
            setStep(3);
        }

    }, [isOpen, modalMemberData, authMemberData, authUser, step]);

    // Logic: Auto-redirect for payment
    useEffect(() => {
        if (step !== 4 || !paymentUrl) return;
        const timer = setTimeout(() => {
            window.location.href = paymentUrl;
        }, 1500);
        return () => clearTimeout(timer);
    }, [step, paymentUrl]);


    const validateStepTwo = () => {
        if (!formData.nome || formData.nome.trim().length < 3) return m.step2.errorName;
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return m.step2.errorEmail;
        if (!formData.morada || formData.morada.trim().length < 3) return m.step2.errorAddress;
        if (!formData.pais) return m.step2.errorCountry;
        if (!formData.codigoPostal || formData.codigoPostal.trim().length < 3) return m.step2.errorPostal;

        if (!validatePostalCode(formData.pais, formData.codigoPostal)) return getPostalInvalidMessage(formData.pais);
        if (!validatePhone(formData.telefone, formData.pais)) return getPhoneInvalidMessage(formData.pais);
        return null;
    };

    const handleAuth = async () => {
        if (sessionUserId) {
            setStep(2);
            return;
        }

        const email = formData.email.trim().toLowerCase();
        if (!email || !password) {
            setError(m.step1.errorFillEmailPass);
            return;
        }

        setAuthLoading(true);
        setError(null);
        setResendMessage(null);
        trackMembershipEvent('membership_auth_submitted', { selected_auth_mode: authMode });

        try {
            if (!supabaseBrowser) throw new Error(m.step1.errorUnavailable);

            if (authMode === 'signup') {
                if (password.length < 6) throw new Error(m.step1.errorMinPass);
                if (password !== confirmPassword) throw new Error(m.step1.errorMismatch);
                if (!acceptedTerms) throw new Error(m.step1.errorAcceptTerms);

                const finalRefCode = manualReferralCode.trim();
                const redirectTo = getAuthCallbackUrl(finalRefCode);
                const { data, error: upErr } = await supabaseBrowser.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: redirectTo,
                        data: { language: locale, locale },
                    }
                });
                if (upErr) throw upErr;
                if (!data.user?.id) throw new Error(m.step1.errorCreateAccount);
                if (data.user?.identities?.length === 0) {
                    setPendingConfirmationEmail(email);
                    setAuthMode('login');
                    throw new Error(m.step1.emailAlreadyRegistered);
                }

                // If Supabase expects email confirmation, session will be null
                if (!data.session) {
                    setPendingConfirmationEmail(email);
                    setResendMessage(m.step1.accountCreatedCheck);
                    trackMembershipEvent('membership_auth_email_confirmation_required', { selected_auth_mode: 'signup' });
                    setAuthLoading(false);
                    return;
                }
                setSessionUserId(data.user.id);
                setSessionEmail(data.user.email ?? email);
                setIsNewAccount(true);
                setPendingConfirmationEmail(null);
                trackMembershipEvent('membership_auth_completed', { selected_auth_mode: 'signup' });
                setStep(2);
            } else {
                if (!supabaseBrowser) throw new Error(m.step1.errorUnavailable);
                const { data, error: inErr } = await supabaseBrowser.auth.signInWithPassword({ email, password });
                if (inErr) throw inErr;
                if (!data.user?.id) throw new Error(m.step1.errorSignIn);

                setSessionUserId(data.user.id);
                setSessionEmail(data.user.email ?? email);

                const liveData = await loadLiveMemberData(data.user.id);
                setIsNewAccount(!liveData);
                setFormData((prev) => ({ ...prev, email: data.user?.email || email }));

                const isComplete = !!(
                    liveData?.nome &&
                    liveData?.email &&
                    liveData?.telefone &&
                    liveData?.address &&
                    liveData?.postal_code &&
                    liveData?.country
                );
                trackMembershipEvent('membership_auth_completed', { selected_auth_mode: 'login' });
                setStep(isComplete ? 3 : 2);
            }
        } catch (err) {
            trackMembershipEvent('membership_auth_failed', { selected_auth_mode: authMode });
            setError(err instanceof Error ? err.message : m.step1.errorGeneric);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleResendConfirmation = async () => {
        const emailToResend = (pendingConfirmationEmail || formData.email).trim().toLowerCase();
        if (!emailToResend || resendLoading) return;

        setResendLoading(true);
        setError(null);
        setResendMessage(null);

        try {
            if (!supabaseBrowser) throw new Error(m.step1.errorUnavailable);
            const { error: resendError } = await supabaseBrowser.auth.resend({
                type: 'signup',
                email: emailToResend,
                options: { emailRedirectTo: getAuthCallbackUrl() },
            });
            if (resendError) throw resendError;
            setPendingConfirmationEmail(emailToResend);
            setResendMessage(m.step1.confirmationResent);
        } catch (err: any) {
            const message = String(err?.message || '');
            if (err?.status === 429 || message.toLowerCase().includes('only request')) {
                setError(m.step1.resendRateLimited);
            } else {
                setError(message || m.step1.errorGeneric);
            }
        } finally {
            setResendLoading(false);
        }
    };

    const saveProfile = async (userId: string) => {
        const payload: Record<string, unknown> = {
            id: userId,
            nome: formData.nome.trim(),
            email: formData.email.trim().toLowerCase(),
            telefone: normalizePhone(withCountryPrefix(formData.telefone, formData.pais)),
            address: formData.morada.trim(),
            postal_code: formData.codigoPostal.trim(),
            country: formData.pais.trim(),
            nif: formData.nif.trim() || null,
            updated_at: new Date().toISOString(),
        };
        if (isNewAccount) {
            payload.is_membro = false;
            payload.tipo_subscricao = "regulares";
            payload.data_adesao = new Date().toISOString();
            payload.estado_quota = "pendente";
        }

        if (!supabaseBrowser) throw new Error(m.step1.errorUnavailable);

        // Enforce referral code assignment for existing non-member profiles
        const finalRefCode = manualReferralCode.trim();
        if (finalRefCode) {
            const { data: existingProfile } = await supabaseBrowser
                .from("membros")
                .select("is_membro, referred_by_code")
                .eq("id", userId)
                .maybeSingle();

            if (!existingProfile?.is_membro && !existingProfile?.referred_by_code) {
                payload.referred_by_code = finalRefCode;
            }
        }

        const { error } = await supabaseBrowser.from("membros").upsert(payload, { onConflict: "id" });
        if (error) {
            if (error.code === '23505') { // Unique Violation
                if (error.message?.includes('email')) throw new Error(m.step2.errorEmailDuplicate);
                if (error.message?.includes('nif')) throw new Error(m.step2.errorNifDuplicate);
                if (error.message?.includes('numero_socio')) throw new Error(m.step2.errorMemberConflict);
                throw new Error(m.step2.errorDuplicate);
            }
            throw new Error(`${m.step2.errorSave}: ${error.message || '—'} `);
        }
        trackMembershipEvent('membership_profile_saved', {
            country: countryMeta?.code || null,
            has_nif: Boolean(formData.nif.trim()),
        });
    };

    const handlePayment = async () => {
        setPaymentError(null);
        setAuthLoading(true);
        trackMembershipEvent('membership_payment_submitted', {
            payment_provider: selectedPayment.provider,
            payment_option_id: selectedPaymentId,
            membership_amount: membershipAmount,
            country: countryMeta?.code || null,
        });
        try {
            if (!sessionUserId) throw new Error(m.step3.errorSession);
            await saveProfile(sessionUserId);

            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: membershipAmount,
                    type: "membership",
                    locale,
                    userId: sessionUserId,
                    provider: selectedPayment.provider,
                    paymentOptionId: selectedPaymentId,
                    donorName: formData.nome?.trim() || undefined,
                    donorEmail: formData.email?.trim().toLowerCase() || undefined,
                    donorCountry: countryMeta?.code || undefined,
                    donorNif: formData.nif?.trim() || undefined,
                    referralCode: manualReferralCode.trim() || undefined,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || m.step3.errorPayment);

            // Stripe Redirect
            setPaymentUrl(data.url);
            trackMembershipEvent('membership_checkout_created', {
                payment_provider: selectedPayment.provider,
                payment_option_id: selectedPaymentId,
                membership_amount: membershipAmount,
            });
            setStep(4);
        } catch (err) {
            trackMembershipEvent('membership_checkout_failed', {
                payment_provider: selectedPayment.provider,
                payment_option_id: selectedPaymentId,
            });
            setPaymentError(err instanceof Error ? err.message : m.step3.errorPayment);
        } finally {
            setAuthLoading(false);
        }
    };

    // Determine if back button should be shown
    const canGoBack = step > 1 && step < 4 && !(step === 2 && sessionUserId);

    // Check renewal status
    const renewalSource = modalMemberData !== undefined ? modalMemberData : authMemberData;
    const rawRenewalStatus = String(renewalSource?.estado_quota || '').replace(/['"]/g, '').trim();
    const renewalStatus = normalizeQuotaStatus(rawRenewalStatus);
    const isRenewal = !!(
        renewalSource?.is_membro ||
        renewalSource?.proxima_quota ||
        (renewalStatus && renewalStatus !== 'pendente')
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-3xl w-full max-w-6xl h-[85vh] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row"
                    >

                        {/* LEFT SIDEBAR (Visual) */}
                        <div className="hidden md:flex w-1/3 bg-garabandal-mist relative flex-col justify-between p-8 border-r border-gray-100">
                            <div>
                                <div className="text-3xl font-serif text-garabandal-dark mb-1">{m.sidebarTitle}</div>
                                <div className="text-xs uppercase tracking-widest text-garabandal-gold font-bold mb-8">{m.sidebarSubtitle}</div>

                                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm mb-6">
                                    <div className="text-4xl font-serif text-garabandal-dark mb-1">{formatPrice(membershipAmount)}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">{isRenewal ? m.annualRenewal : m.annualFee}</div>
                                    <div className="space-y-3">
                                        {[m.benefitVideos, m.benefitAltar, m.benefitVoucher, m.benefitMasses].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                                <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="relative h-48 rounded-2xl overflow-hidden bg-gray-200">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={slideIndex}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="absolute inset-0"
                                    >
                                        <img src={slideImages[slideIndex]} className="w-full h-full object-cover opacity-80" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-6 flex flex-col justify-end text-white">
                                            <p className="font-bold text-sm mb-1">{slides[slideIndex].title}</p>
                                            <p className="text-xs opacity-80 line-clamp-2">{slides[slideIndex].text}</p>
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>


                        {/* RIGHT MAIN CONTENT */}
                        <div className="flex-1 flex flex-col h-full bg-white relative">

                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white z-20">
                                <div className="flex items-center gap-3">
                                    {canGoBack && (
                                        <button onClick={() => setStep(s => s - 1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                                            <ChevronLeft size={20} />
                                        </button>
                                    )}
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                                            {m.step.replace('{current}', String(step)).replace('{total}', '4')}
                                        </div>
                                        <h3 className="font-serif text-xl font-bold text-garabandal-dark leading-none">
                                            {step === 1 && m.titles.account}
                                            {step === 2 && m.titles.personal}
                                            {step === 3 && (isRenewal ? m.titles.renew : m.titles.payment)}
                                            {step === 4 && m.titles.confirm}
                                        </h3>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Body Scrollable */}
                            <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
                                <AnimatePresence mode="wait">

                                    {/* STEP 1: AUTH */}
                                    {step === 1 && (
                                        <motion.div
                                            key="step1"
                                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                            className="max-w-md mx-auto pt-4"
                                        >
                                            <div className="text-center mb-8">
                                                <div className="w-16 h-16 bg-garabandal-gold/10 text-garabandal-gold rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                    <Lock size={32} />
                                                </div>
                                                <h4 className="text-2xl font-serif text-garabandal-dark mb-2">{m.step1.heading}</h4>
                                                <p className="text-gray-500">{m.step1.subheading}</p>
                                            </div>

                                            <div className="bg-gray-100 p-1 rounded-xl flex mb-8">
                                                <button
                                                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${authMode === 'login' ? 'bg-white shadow-sm text-garabandal-dark' : 'text-gray-400 hover:text-gray-600'}`}
                                                    onClick={() => setAuthMode('login')}
                                                >
                                                    {m.step1.signIn}
                                                </button>
                                                <button
                                                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${authMode === 'signup' ? 'bg-white shadow-sm text-garabandal-dark' : 'text-gray-400 hover:text-gray-600'}`}
                                                    onClick={() => setAuthMode('signup')}
                                                >
                                                    {m.step1.signUp}
                                                </button>
                                            </div>

                                            <div className="mb-6">
                                                <GoogleButton
                                                    isLoading={authLoading}
                                                    text={authMode === 'login' ? m.step1.googleSignIn : m.step1.googleSignUp}
                                                    className="bg-white border-gray-200 shadow-sm hover:shadow-md py-3"
                                                    referralCode={manualReferralCode.trim()}
                                                    locale={locale}
                                                    next={getModalReturnPath()}
                                                />
                                                <div className="relative flex items-center justify-center mt-6">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <div className="w-full border-t border-gray-200"></div>
                                                    </div>
                                                    <span className="relative z-10 bg-white px-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                        {m.step1.orEmail}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                <InputField
                                                    label={m.step1.email}
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                                />

                                                <PasswordInput
                                                    label={m.step1.password}
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                />

                                                {authMode === 'signup' && (
                                                    <>
                                                        <PasswordInput
                                                            label={m.step1.confirmPassword}
                                                            value={confirmPassword}
                                                            onChange={e => setConfirmPassword(e.target.value)}
                                                        />

                                                        <div className="flex items-start gap-3 mt-4">
                                                            <div className="relative flex items-center justify-center mt-0.5">
                                                                <input
                                                                    id="modal-terms"
                                                                    type="checkbox"
                                                                    checked={acceptedTerms}
                                                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                                                    className="w-5 h-5 rounded border-gray-300 text-garabandal-gold focus:ring-garabandal-gold cursor-pointer"
                                                                />
                                                            </div>
                                                            <label htmlFor="modal-terms" className="text-xs text-gray-500 leading-relaxed font-medium">
                                                                {m.step1.acceptPrefix}{" "}
                                                                <Link href={termsUrl} target="_blank" className="underline hover:text-garabandal-gold">
                                                                    {m.step1.terms}
                                                                </Link>{" "}
                                                                {m.step1.acceptMid}{" "}
                                                                <Link href={privacyUrl} target="_blank" className="underline hover:text-garabandal-gold">
                                                                    {m.step1.privacy}
                                                                </Link>{" "}
                                                                {m.step1.acceptSuffix}
                                                            </label>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {pendingConfirmationEmail && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                                    className="mt-6 p-4 bg-green-50 text-green-800 text-sm rounded-xl border border-green-100"
                                                >
                                                    <div className="font-bold mb-1">{m.step1.checkInboxTitle}</div>
                                                    <div className="leading-relaxed">
                                                        {m.step1.checkInboxHelp.replace('{email}', pendingConfirmationEmail)}
                                                    </div>
                                                    {resendMessage && (
                                                        <div className="mt-2 text-xs font-semibold text-green-700">
                                                            {resendMessage}
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={handleResendConfirmation}
                                                        disabled={resendLoading}
                                                        className="mt-3 text-xs font-bold uppercase tracking-widest text-green-900 underline underline-offset-4 disabled:opacity-60"
                                                    >
                                                        {resendLoading ? m.step1.processing : m.step1.resendConfirmation}
                                                    </button>
                                                </motion.div>
                                            )}

                                            {error && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                                    className="mt-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl text-center font-bold flex items-center justify-center gap-2"
                                                >
                                                    <span>⚠️</span> {error}
                                                </motion.div>
                                            )}

                                            <button
                                                onClick={handleAuth}
                                                disabled={authLoading}
                                                className="w-full mt-8 bg-garabandal-dark text-white font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-black transition-all flex justify-center items-center gap-2 shadow-lg shadow-garabandal-dark/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {authLoading ? m.step1.processing : m.step1.continue}
                                                {!authLoading && <ChevronLeft size={16} className="rotate-180" />}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STEP 2: DETAILS */}
                                    {step === 2 && (
                                        <motion.div
                                            key="step2"
                                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                            className="max-w-xl mx-auto"
                                        >
                                            <div className="mb-8">
                                                <h4 className="text-2xl font-serif text-garabandal-dark mb-2">{m.step2.heading}</h4>
                                                <p className="text-gray-500 text-sm">{m.step2.subheading}</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="md:col-span-2">
                                                    <InputField label={m.step2.fullName} value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <InputField
                                                        label={m.step2.email}
                                                        value={formData.email}
                                                        readOnly
                                                    />
                                                    <p className="text-[11px] text-gray-500 mt-1 ml-1">{m.step2.emailLocked}</p>
                                                </div>
                                                <div>
                                                    <SelectField label={m.step2.country} value={formData.pais} onChange={e => setFormData(p => ({ ...p, pais: e.target.value }))}>
                                                        <option value="">{m.step2.selectCountry}</option>
                                                        {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </SelectField>
                                                </div>
                                                <div>
                                                    <InputField
                                                        label={m.step2.phone}
                                                        value={formData.telefone}
                                                        placeholder={countryMeta?.phoneExample}
                                                        onChange={e => setFormData(p => ({ ...p, telefone: withCountryPrefix(e.target.value, formData.pais) }))}
                                                        onBlur={() => setFormData(p => ({ ...p, telefone: normalizePhone(withCountryPrefix(p.telefone, p.pais)) }))}
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <InputField
                                                        label={m.step2.address}
                                                        value={formData.morada}
                                                        inputMode={getPostalInputMode(formData.pais)}
                                                        onChange={e => setFormData(p => ({ ...p, morada: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <InputField
                                                        label={m.step2.postal}
                                                        value={formData.codigoPostal}
                                                        placeholder={countryMeta?.postalPlaceholder}
                                                        onChange={e => setFormData(p => ({ ...p, codigoPostal: formatPostalCode(e.target.value, formData.pais) }))}
                                                    />
                                                </div>
                                                <div>
                                                    <InputField label={m.step2.nif} value={formData.nif} onChange={e => setFormData(p => ({ ...p, nif: e.target.value }))} />
                                                </div>
                                            </div>

                                            {error && (
                                                <div className="mt-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl text-center font-bold">
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                onClick={() => {
                                                    const err = validateStepTwo();
                                                    if (err) setError(err);
                                                    else { setError(null); setStep(3); }
                                                }}
                                                className="w-full mt-8 bg-garabandal-dark text-white font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-black transition-all flex justify-center items-center gap-2 shadow-lg shadow-garabandal-dark/20 hover:scale-[1.02] active:scale-95"
                                            >
                                                {m.step2.confirm}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STEP 3: PAYMENT */}
                                    {step === 3 && (
                                        <motion.div
                                            key="step3"
                                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                            className="max-w-xl mx-auto"
                                        >
                                            <div className="mb-8">
                                                <h4 className="text-2xl font-serif text-garabandal-dark mb-2">{isRenewal ? m.step3.headingRenew : m.step3.headingNew}</h4>
                                                <p className="text-gray-500 text-sm">{m.step3.subheading.replace('{amount}', formatPrice(membershipAmount))}</p>
                                            </div>

                                            {!isRenewal && (
                                                <div className="mb-8 p-5 bg-yellow-50 border border-yellow-100/60 rounded-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                                                        <Gift size={64} />
                                                    </div>
                                                    <div className="relative z-10">
                                                        <InputField
                                                            label={m.step3.referralLabel}
                                                            placeholder={m.step3.referralPlaceholder}
                                                            value={manualReferralCode}
                                                            onChange={(e) => setManualReferralCode(e.target.value.toUpperCase())}
                                                        />
                                                        <p className="text-[11px] text-yellow-800/80 mt-2 font-medium">
                                                            {m.step3.referralHint}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-4">
                                                {UNIFIED_ONLINE_PAYMENT_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => setSelectedPaymentId(opt.id)}
                                                        className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 text-left group
                                                        ${selectedPaymentId === opt.id
                                                                ? 'border-garabandal-gold bg-garabandal-gold/5 shadow-md shadow-garabandal-gold/10'
                                                                : 'border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <div className="w-14 h-14 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 p-2 shrink-0">
                                                            {opt.iconSrc ? (
                                                                <img src={opt.iconSrc} alt={opt.iconAlt || opt.label} className="w-full h-full object-contain" />
                                                            ) : opt.id === 'reduniq_pix' ? (
                                                                <QrCode className="w-6 h-6 text-green-600" />
                                                            ) : (
                                                                <CreditCard className="w-6 h-6 text-gray-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-garabandal-dark text-lg">{opt.label}</span>
                                                                {opt.badge && (
                                                                    <span className="bg-green-100 text-green-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                                                                        {opt.badge}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-gray-500 font-medium">{opt.description}</div>
                                                        </div>
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selectedPaymentId === opt.id ? 'border-garabandal-gold' : 'border-gray-200 group-hover:border-gray-300'}`}>
                                                            {selectedPaymentId === opt.id && <div className="w-3 h-3 rounded-full bg-garabandal-gold" />}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="mt-8 flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl text-xs font-bold text-blue-800/60 uppercase tracking-wide">
                                                <Lock size={14} />
                                                <span>{m.step3.secureNote}</span>
                                            </div>

                                            {paymentError && (
                                                <div className="mt-4 p-4 bg-red-50 text-red-600 text-sm rounded-xl text-center font-bold">
                                                    {paymentError}
                                                </div>
                                            )}

                                            <button
                                                onClick={handlePayment}
                                                disabled={authLoading}
                                                className="w-full mt-8 bg-garabandal-dark text-white font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-black transition-all flex justify-center items-center gap-2 shadow-lg shadow-garabandal-dark/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {authLoading ? m.step3.processing : m.step3.payButton.replace('{amount}', formatPrice(membershipAmount))}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STEP 4: SUCCESS/REDIRECT */}
                                    {step === 4 && (
                                        <motion.div
                                            key="step4"
                                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                            className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto"
                                        >
                                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8 animate-[bounce_2s_infinite]">
                                                <CreditCard size={40} />
                                            </div>
                                            <h3 className="text-3xl font-serif text-garabandal-dark mb-4">{m.step4.heading}</h3>
                                            <p className="text-gray-500 mb-8 text-lg font-light leading-relaxed">
                                                {m.step4.subheadingPrefix} <strong className="text-gray-900 font-bold">{selectedPayment.label}</strong>.
                                            </p>

                                            <div className="w-full max-w-xs bg-gray-100 rounded-full h-1.5 mb-8 overflow-hidden">
                                                <div className="h-full bg-garabandal-gold animate-[progress_2s_ease-in-out_infinite]" style={{ width: '50%' }}></div>
                                            </div>

                                            <a
                                                href={paymentUrl || "#"}
                                                className="text-sm font-bold text-garabandal-gold hover:text-garabandal-dark transition-colors uppercase tracking-widest border-b border-transparent hover:border-current"
                                                onClick={e => !paymentUrl && e.preventDefault()}
                                            >
                                                {m.step4.fallbackLink}
                                            </a>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </div >
            )}

        </AnimatePresence >
    );
}
