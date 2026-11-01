"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Lock, ChevronLeft, ChevronDown, CreditCard, Eye, EyeOff, QrCode } from "lucide-react";
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

const countryOptions = listCountryLabels();

// Shared form styling (homepage tokens: ink text, line borders, brand focus).
const FIELD_LABEL = "mb-1.5 block text-sm font-medium text-ink";
const FIELD_CONTROL =
    "h-12 w-full rounded-xl border border-line bg-white px-4 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10 read-only:bg-paper read-only:text-muted";
const PRIMARY_BUTTON =
    "inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-base font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";
const EASE = [0.22, 1, 0.36, 1] as const;

// Helper Components (Defined outside to prevent re-renders)
type FieldExtras = { label: string; hint?: string; error?: string | null };

const FieldMessage = ({ hint, error }: { hint?: string; error?: string | null }) =>
    error ? (
        <span role="alert" className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>
    ) : hint ? (
        <span className="mt-1.5 block text-xs text-muted">{hint}</span>
    ) : null;

const InputField = ({ label, hint, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & FieldExtras) => (
    <label className="block">
        <span className={FIELD_LABEL}>{label}</span>
        <input
            {...props}
            aria-invalid={error ? true : undefined}
            className={`${FIELD_CONTROL} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
        />
        <FieldMessage hint={hint} error={error} />
    </label>
);

/**
 * Phone input with the country dialling code shown as a fixed prefix, so people
 * only type their national number. The stored value keeps the same shape as
 * before ("+351 912345678"); countries without metadata fall back to a free
 * input where the user types the full international number.
 */
const PhoneField = ({
    label, hint, error, country, value, onValueChange, onBlur,
}: FieldExtras & { country: string; value: string; onValueChange: (next: string) => void; onBlur?: () => void }) => {
    const meta = resolveCountryMeta(country);
    const prefix = meta?.phonePrefix;
    const usePrefix = Boolean(prefix) && (!value || value.startsWith(prefix as string));
    const national = usePrefix && prefix ? value.slice(prefix.length).replace(/^ /, "") : value;
    const nationalExample = meta?.phoneExample && prefix ? meta.phoneExample.slice(prefix.length).trim() : undefined;

    return (
        <label className="block">
            <span className={FIELD_LABEL}>{label}</span>
            <span
                className={`flex h-12 w-full items-stretch overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 focus-within:ring-4 ${error ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/10" : "border-line focus-within:border-brand focus-within:ring-brand/10"}`}
            >
                {usePrefix && (
                    <span className="flex shrink-0 items-center border-r border-line bg-paper px-3.5 text-[16px] font-medium tabular-nums text-ink">
                        {prefix}
                    </span>
                )}
                <input
                    type="tel"
                    inputMode="tel"
                    autoComplete={usePrefix ? "tel-national" : "tel"}
                    aria-invalid={error ? true : undefined}
                    value={national}
                    placeholder={usePrefix ? nationalExample : "+55 11 91234 5678"}
                    onChange={(e) => {
                        const raw = e.target.value;
                        if (!usePrefix || raw.trim().startsWith("+")) {
                            onValueChange(raw);
                            return;
                        }
                        const digits = raw.replace(/[^\d ]/g, "").replace(/^ +/, "");
                        onValueChange(digits ? `${prefix} ${digits}` : "");
                    }}
                    onBlur={onBlur}
                    className="min-w-0 flex-1 bg-transparent px-4 text-[16px] tabular-nums text-ink outline-none placeholder:text-muted/70"
                />
            </span>
            <FieldMessage hint={hint} error={error} />
        </label>
    );
};

const PasswordInput = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => {
    const [show, setShow] = useState(false);
    return (
        <label className="block">
            <span className={FIELD_LABEL}>{label}</span>
            <span className="relative block">
                <input {...props} type={show ? "text" : "password"} className={`${FIELD_CONTROL} pr-12`} />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink"
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </span>
        </label>
    );
};

const SelectField = ({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => (
    <label className="block">
        <span className={FIELD_LABEL}>{label}</span>
        <span className="relative block">
            <select {...props} className={`${FIELD_CONTROL} cursor-pointer appearance-none pr-10`}>
                {children}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
        </span>
    </label>
);

const Notice = ({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) => (
    <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        role={tone === "error" ? "alert" : "status"}
        className={`mt-5 rounded-xl px-4 py-3 text-sm leading-relaxed ${tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
    >
        {children}
    </motion.div>
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

    // Traduz erros técnicos do Supabase para mensagens PT/EN claras.
    // Mensagens que já lançamos nós (ex.: emailAlreadyRegistered) passam intactas.
    const friendlyAuthError = (err: unknown): string => {
        if (!(err instanceof Error)) return m.step1.errorGeneric;
        const status = (err as { status?: number }).status;
        const code = String((err as { code?: string }).code || '').toLowerCase();
        const raw = err.message || '';
        const msg = raw.toLowerCase();

        // Demasiadas tentativas / limite de envio de email.
        if (status === 429 || code.startsWith('over_') || msg.includes('rate limit') || msg.includes('too many')) {
            return m.step1.errorRateLimited;
        }
        // Email com formato inválido.
        if (code === 'email_address_invalid' || (msg.includes('email') && msg.includes('invalid') && !msg.includes('credential'))) {
            return m.step1.errorInvalidEmail;
        }
        // Credenciais erradas no login.
        if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
            return m.step1.errorInvalidCredentials;
        }
        // Falha ao enviar o email de confirmação (SMTP / endereço suprimido ou com bounce).
        if (msg.includes('confirmation email') || msg.includes('error sending') || (msg.includes('sending') && msg.includes('email'))) {
            return m.step1.errorEmailSend;
        }
        // Falha de rede.
        if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
            return m.step1.errorNetwork;
        }
        // Já é uma das nossas mensagens amigáveis (ou algo inesperado) — mostra tal como está.
        return raw || m.step1.errorGeneric;
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
                    // Supabase obscures whether an existing account is confirmed.
                    // A duplicate signup is not evidence that a new email was sent.
                    setPendingConfirmationEmail(null);
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
            if (authMode === 'login') {
                const code = err instanceof Error ? String((err as { code?: string }).code || '') : '';
                if (code === 'invalid_credentials') {
                    setPendingConfirmationEmail(null);
                    setResendMessage(null);
                }
            }
            setError(friendlyAuthError(err));
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
                setError(friendlyAuthError(err));
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

    // While open: lock page scroll, close on Escape, and flag <body> so the
    // site header can fade out behind the blurred backdrop.
    useEffect(() => {
        if (!isOpen) return;
        const { body } = document;
        const prevOverflow = body.style.overflow;
        body.style.overflow = 'hidden';
        body.dataset.modalOpen = '1';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            body.style.overflow = prevOverflow;
            delete body.dataset.modalOpen;
            window.removeEventListener('keydown', onKey);
        };
    }, [isOpen, onClose]);

    // Inline (on blur) validation for the fields people get wrong most often.
    // Uses the same validators as validateStepTwo, so it only surfaces earlier.
    const [fieldErrors, setFieldErrors] = useState<{ telefone?: string | null; codigoPostal?: string | null }>({});
    const messageLocale = locale === 'en' ? 'en' : 'pt-PT';
    const checkPhone = () => {
        if (!formData.telefone.trim()) return;
        setFieldErrors((f) => ({ ...f, telefone: validatePhone(formData.telefone, formData.pais) ? null : getPhoneInvalidMessage(formData.pais, messageLocale) }));
    };
    const checkPostal = () => {
        if (!formData.codigoPostal.trim()) return;
        setFieldErrors((f) => ({ ...f, codigoPostal: validatePostalCode(formData.pais, formData.codigoPostal) ? null : getPostalInvalidMessage(formData.pais, messageLocale) }));
    };
    const changeCountry = (nextCountry: string) => {
        setFormData((p) => {
            // Move an already-typed national number onto the new dialling code.
            const oldPrefix = resolveCountryMeta(p.pais)?.phonePrefix;
            const newPrefix = resolveCountryMeta(nextCountry)?.phonePrefix;
            let telefone = p.telefone;
            if (oldPrefix && telefone.startsWith(oldPrefix)) {
                const national = telefone.slice(oldPrefix.length).trim();
                telefone = newPrefix ? (national ? `${newPrefix} ${national}` : "") : national;
            }
            return { ...p, pais: nextCountry, telefone, codigoPostal: formatPostalCode(p.codigoPostal, nextCountry) };
        });
        setFieldErrors({});
    };
    const phoneHint = !formData.pais
        ? (locale === 'en' ? 'Choose your country first to fill in the dialling code.' : 'Escolha primeiro o país para preencher o indicativo.')
        : !resolveCountryMeta(formData.pais)
            ? (locale === 'en' ? 'Include the country code, e.g. +39.' : 'Inclua o indicativo do país, ex.: +39.')
            : undefined;

    const stepTitle =
        step === 1 ? m.titles.account
        : step === 2 ? m.titles.personal
        : step === 3 ? (isRenewal ? m.titles.renew : m.titles.payment)
        : m.titles.confirm;

    // Primary action per step, rendered in the sticky footer (same handlers as before).
    const footerAction =
        step === 1 ? { onClick: handleAuth, disabled: authLoading, label: authLoading ? m.step1.processing : m.step1.continue }
        : step === 2 ? {
            onClick: () => {
                const err = validateStepTwo();
                if (err) setError(err);
                else { setError(null); setStep(3); }
            },
            disabled: false,
            label: m.step2.confirm,
        }
        : step === 3 ? { onClick: handlePayment, disabled: authLoading, label: authLoading ? m.step3.processing : m.step3.payButton.replace('{amount}', formatPrice(membershipAmount)) }
        : null;

    const stepMotion = {
        initial: { opacity: 0, x: 16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -16 },
        transition: { duration: 0.28, ease: EASE },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={stepTitle}>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="absolute inset-0 bg-ink/40 backdrop-blur-md"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
                        className="relative z-10 flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_40px_120px_-30px_rgba(15,27,51,0.5)] md:h-[min(760px,90dvh)] md:max-w-[980px] md:flex-row md:rounded-[1.75rem]"
                    >
                        {/* SUMMARY (desktop) */}
                        <aside className="hidden w-[340px] shrink-0 flex-col justify-between bg-paper p-8 md:flex">
                            <div>
                                <div
                                    className="relative aspect-[1.586] overflow-hidden rounded-2xl p-5 text-white shadow-[0_20px_40px_-20px_rgba(31,85,214,0.6)]"
                                    style={{ background: "linear-gradient(140deg, #4a84f6 0%, #2259db 48%, #10307f 100%)" }}
                                >
                                    <img
                                        src="/images/app-icon-512.png"
                                        alt=""
                                        aria-hidden
                                        className="pointer-events-none absolute -right-[14%] top-1/2 h-[125%] w-auto -translate-y-1/2 opacity-90 mix-blend-screen"
                                        style={{ maskImage: "radial-gradient(closest-side, black 62%, transparent 100%)", WebkitMaskImage: "radial-gradient(closest-side, black 62%, transparent 100%)" }}
                                    />
                                    <div className="relative flex h-full flex-col justify-between">
                                        <p className="text-sm font-semibold">Apostolado de Garabandal</p>
                                        <div>
                                            <p className="text-3xl font-semibold tracking-[-0.03em]">{formatPrice(membershipAmount)}</p>
                                            <p className="text-xs text-white/75">{isRenewal ? m.annualRenewal : m.annualFee}</p>
                                        </div>
                                    </div>
                                </div>

                                <ul className="mt-7 space-y-3">
                                    {[m.benefitVideos, m.benefitAltar, m.benefitVoucher, m.benefitMasses].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3 text-[15px] text-ink">
                                            <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-brand" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <p className="flex items-center gap-2 text-xs text-muted">
                                <Lock size={13} /> {m.step3.secureNote}
                            </p>
                        </aside>

                        {/* MAIN */}
                        <div className="flex min-h-0 flex-1 flex-col">
                            {/* Mobile grab handle */}
                            <div className="flex justify-center pt-2.5 md:hidden">
                                <span className="h-1.5 w-10 rounded-full bg-line" />
                            </div>

                            {/* Header */}
                            <header className="px-5 pb-4 pt-3 md:px-10 md:pt-8">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        {canGoBack && (
                                            <button
                                                type="button"
                                                onClick={() => setStep(s => s - 1)}
                                                aria-label="Back"
                                                className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm text-muted">{m.step.replace('{current}', String(step)).replace('{total}', '4')}</p>
                                            <h3 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink md:text-2xl">{stepTitle}</h3>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Close"
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition-colors hover:bg-line"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Progress */}
                                <div className="mt-5 grid grid-cols-4 gap-1.5">
                                    {[1, 2, 3, 4].map((n) => (
                                        <span key={n} className="h-1 overflow-hidden rounded-full bg-line">
                                            <motion.span
                                                className="block h-full rounded-full bg-brand"
                                                initial={false}
                                                animate={{ width: n <= step ? "100%" : "0%" }}
                                                transition={{ duration: 0.45, ease: EASE }}
                                            />
                                        </span>
                                    ))}
                                </div>

                                {/* Mobile price summary */}
                                <div className="mt-4 flex items-center justify-between rounded-xl bg-paper px-4 py-3 md:hidden">
                                    <span className="text-sm text-muted">{isRenewal ? m.annualRenewal : m.annualFee}</span>
                                    <span className="text-base font-semibold text-ink">{formatPrice(membershipAmount)}</span>
                                </div>
                            </header>

                            {/* Body */}
                            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 md:px-10">
                                <AnimatePresence mode="wait" initial={false}>

                                    {/* STEP 1: AUTH */}
                                    {step === 1 && (
                                        <motion.div key="step1" {...stepMotion} className="mx-auto max-w-md pt-2">
                                            <p className="mb-6 text-[15px] leading-relaxed text-muted">{m.step1.subheading}</p>

                                            <div className="mb-6 grid grid-cols-2 rounded-full bg-paper p-1" role="tablist">
                                                {(["login", "signup"] as const).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={authMode === mode}
                                                        onClick={() => setAuthMode(mode)}
                                                        className="relative h-10 rounded-full text-sm font-semibold transition-colors"
                                                    >
                                                        {authMode === mode && (
                                                            <motion.span
                                                                layoutId="membership-auth-tab"
                                                                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(15,27,51,0.12)]"
                                                                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                                                            />
                                                        )}
                                                        <span className={`relative ${authMode === mode ? "text-ink" : "text-muted"}`}>
                                                            {mode === "login" ? m.step1.signIn : m.step1.signUp}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>

                                            <GoogleButton
                                                isLoading={authLoading}
                                                text={authMode === 'login' ? m.step1.googleSignIn : m.step1.googleSignUp}
                                                className="h-12 rounded-full border-line bg-white py-3 shadow-none hover:bg-paper"
                                                referralCode={manualReferralCode.trim()}
                                                locale={locale}
                                                next={getModalReturnPath()}
                                            />

                                            <div className="my-6 flex items-center gap-4 text-xs text-muted">
                                                <span className="h-px flex-1 bg-line" />
                                                {m.step1.orEmail}
                                                <span className="h-px flex-1 bg-line" />
                                            </div>

                                            <div className="space-y-4">
                                                <InputField
                                                    label={m.step1.email}
                                                    type="email"
                                                    autoComplete="email"
                                                    inputMode="email"
                                                    value={formData.email}
                                                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                                />

                                                <PasswordInput
                                                    label={m.step1.password}
                                                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                />

                                                {authMode === 'login' && (
                                                    <div className="text-right">
                                                        <Link href={t.urls.forgotPassword} className="text-sm font-medium text-brand hover:text-brand-700">
                                                            {t.auth.login.forgotPassword}
                                                        </Link>
                                                    </div>
                                                )}

                                                <AnimatePresence initial={false}>
                                                    {authMode === 'signup' && (
                                                        <motion.div
                                                            key="signup-extra"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.3, ease: EASE }}
                                                            className="space-y-4 overflow-hidden"
                                                        >
                                                            <PasswordInput
                                                                label={m.step1.confirmPassword}
                                                                autoComplete="new-password"
                                                                value={confirmPassword}
                                                                onChange={e => setConfirmPassword(e.target.value)}
                                                            />

                                                            <label htmlFor="modal-terms" className="flex cursor-pointer items-start gap-3 pt-1">
                                                                <input
                                                                    id="modal-terms"
                                                                    type="checkbox"
                                                                    checked={acceptedTerms}
                                                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                                                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line accent-brand"
                                                                />
                                                                <span className="text-sm leading-relaxed text-muted">
                                                                    {m.step1.acceptPrefix}{" "}
                                                                    <Link href={termsUrl} target="_blank" className="text-ink underline underline-offset-2 hover:text-brand">{m.step1.terms}</Link>{" "}
                                                                    {m.step1.acceptMid}{" "}
                                                                    <Link href={privacyUrl} target="_blank" className="text-ink underline underline-offset-2 hover:text-brand">{m.step1.privacy}</Link>{" "}
                                                                    {m.step1.acceptSuffix}
                                                                </span>
                                                            </label>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {pendingConfirmationEmail && (
                                                <Notice tone="success">
                                                    <p className="font-semibold">{m.step1.checkInboxTitle}</p>
                                                    <p className="mt-1">{m.step1.checkInboxHelp.replace('{email}', pendingConfirmationEmail)}</p>
                                                    {resendMessage && <p className="mt-2 font-medium">{resendMessage}</p>}
                                                    <button
                                                        type="button"
                                                        onClick={handleResendConfirmation}
                                                        disabled={resendLoading}
                                                        className="mt-3 font-semibold underline underline-offset-4 disabled:opacity-60"
                                                    >
                                                        {resendLoading ? m.step1.processing : m.step1.resendConfirmation}
                                                    </button>
                                                </Notice>
                                            )}

                                            {error && <Notice tone="error">{error}</Notice>}
                                        </motion.div>
                                    )}

                                    {/* STEP 2: DETAILS */}
                                    {step === 2 && (
                                        <motion.div key="step2" {...stepMotion} className="mx-auto max-w-xl pt-2">
                                            <p className="mb-6 text-[15px] leading-relaxed text-muted">{m.step2.subheading}</p>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="sm:col-span-2">
                                                    <InputField label={m.step2.fullName} autoComplete="name" value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <InputField label={m.step2.email} value={formData.email} readOnly />
                                                    <p className="mt-1.5 text-xs text-muted">{m.step2.emailLocked}</p>
                                                </div>
                                                <SelectField label={m.step2.country} autoComplete="country-name" value={formData.pais} onChange={e => changeCountry(e.target.value)}>
                                                    <option value="">{m.step2.selectCountry}</option>
                                                    {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                </SelectField>
                                                <PhoneField
                                                    label={m.step2.phone}
                                                    country={formData.pais}
                                                    value={formData.telefone}
                                                    hint={phoneHint}
                                                    error={fieldErrors.telefone}
                                                    onValueChange={(next) => {
                                                        setFormData(p => ({ ...p, telefone: next }));
                                                        if (fieldErrors.telefone) setFieldErrors(f => ({ ...f, telefone: null }));
                                                    }}
                                                    onBlur={checkPhone}
                                                />
                                                <div className="sm:col-span-2">
                                                    <InputField
                                                        label={m.step2.address}
                                                        value={formData.morada}
                                                        autoComplete="street-address"
                                                        onChange={e => setFormData(p => ({ ...p, morada: e.target.value }))}
                                                    />
                                                </div>
                                                <InputField
                                                    label={m.step2.postal}
                                                    value={formData.codigoPostal}
                                                    inputMode={getPostalInputMode(formData.pais)}
                                                    autoComplete="postal-code"
                                                    placeholder={countryMeta?.postalPlaceholder}
                                                    error={fieldErrors.codigoPostal}
                                                    onChange={e => {
                                                        setFormData(p => ({ ...p, codigoPostal: formatPostalCode(e.target.value, formData.pais) }));
                                                        if (fieldErrors.codigoPostal) setFieldErrors(f => ({ ...f, codigoPostal: null }));
                                                    }}
                                                    onBlur={checkPostal}
                                                />
                                                <InputField label={m.step2.nif} value={formData.nif} onChange={e => setFormData(p => ({ ...p, nif: e.target.value }))} />
                                            </div>

                                            {error && <Notice tone="error">{error}</Notice>}
                                        </motion.div>
                                    )}

                                    {/* STEP 3: PAYMENT */}
                                    {step === 3 && (
                                        <motion.div key="step3" {...stepMotion} className="mx-auto max-w-xl pt-2">
                                            <p className="mb-6 text-[15px] leading-relaxed text-muted">{m.step3.subheading.replace('{amount}', formatPrice(membershipAmount))}</p>

                                            <div className="space-y-3" role="radiogroup">
                                                {UNIFIED_ONLINE_PAYMENT_OPTIONS.map(opt => {
                                                    const selected = selectedPaymentId === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={selected}
                                                            onClick={() => setSelectedPaymentId(opt.id)}
                                                            className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${selected ? 'border-brand bg-brand-50/50 shadow-[0_0_0_3px_rgba(53,99,233,0.12)]' : 'border-line bg-white hover:border-brand-200'}`}
                                                        >
                                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2">
                                                                {opt.iconSrc ? (
                                                                    <img src={opt.iconSrc} alt={opt.iconAlt || opt.label} className="h-full w-full object-contain" />
                                                                ) : opt.id === 'reduniq_pix' ? (
                                                                    <QrCode className="h-5 w-5 text-ink" />
                                                                ) : (
                                                                    <CreditCard className="h-5 w-5 text-ink" />
                                                                )}
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-semibold text-ink">{opt.label}</span>
                                                                    {opt.badge && <span className="text-xs font-medium text-brand">{opt.badge}</span>}
                                                                </span>
                                                                <span className="mt-0.5 block text-sm text-muted">{opt.description}</span>
                                                            </span>
                                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selected ? 'border-brand' : 'border-line'}`}>
                                                                <motion.span
                                                                    initial={false}
                                                                    animate={{ scale: selected ? 1 : 0 }}
                                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                                    className="h-2.5 w-2.5 rounded-full bg-brand"
                                                                />
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {!isRenewal && (
                                                <div className="mt-6">
                                                    <InputField
                                                        label={m.step3.referralLabel}
                                                        placeholder={m.step3.referralPlaceholder}
                                                        value={manualReferralCode}
                                                        autoCapitalize="characters"
                                                        onChange={(e) => setManualReferralCode(e.target.value.toUpperCase())}
                                                    />
                                                    <p className="mt-1.5 text-xs text-muted">{m.step3.referralHint}</p>
                                                </div>
                                            )}

                                            {paymentError && <Notice tone="error">{paymentError}</Notice>}
                                        </motion.div>
                                    )}

                                    {/* STEP 4: SUCCESS/REDIRECT */}
                                    {step === 4 && (
                                        <motion.div
                                            key="step4"
                                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, ease: EASE }}
                                            className="mx-auto flex h-full max-w-sm flex-col items-center justify-center py-10 text-center"
                                        >
                                            <motion.div
                                                initial={{ scale: 0.6, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                                                className="mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-[0_16px_40px_-12px_rgba(53,99,233,0.7)]"
                                            >
                                                <Check size={36} strokeWidth={2.5} />
                                            </motion.div>
                                            <h3 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{m.step4.heading}</h3>
                                            <p className="mt-3 text-[15px] leading-relaxed text-muted">
                                                {m.step4.subheadingPrefix} <strong className="font-semibold text-ink">{selectedPayment.label}</strong>.
                                            </p>

                                            <div className="mt-8 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-line">
                                                <motion.div
                                                    className="h-full rounded-full bg-brand"
                                                    initial={{ width: "0%" }}
                                                    animate={{ width: "100%" }}
                                                    transition={{ duration: 1.5, ease: "easeInOut" }}
                                                />
                                            </div>

                                            <a
                                                href={paymentUrl || "#"}
                                                className="mt-8 text-sm font-semibold text-brand underline-offset-4 hover:underline"
                                                onClick={e => !paymentUrl && e.preventDefault()}
                                            >
                                                {m.step4.fallbackLink}
                                            </a>
                                        </motion.div>
                                    )}

                                </AnimatePresence>
                            </div>

                            {/* Sticky footer with the step's primary action */}
                            {footerAction && (
                                <footer className="border-t border-line bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-10 md:pb-8 md:pt-5">
                                    <div className={`mx-auto ${step === 1 ? 'max-w-md' : 'max-w-xl'}`}>
                                        <button type="button" onClick={footerAction.onClick} disabled={footerAction.disabled} className={PRIMARY_BUTTON}>
                                            {footerAction.disabled && authLoading && (
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                                            )}
                                            {footerAction.label}
                                        </button>
                                        {step === 3 && (
                                            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted md:hidden">
                                                <Lock size={12} /> {m.step3.secureNote}
                                            </p>
                                        )}
                                    </div>
                                </footer>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
