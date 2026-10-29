"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useForm, useFieldArray, FormProvider, useWatch, Controller } from 'react-hook-form';
import Swal from 'sweetalert2';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChevronRight, ChevronLeft, Check, Loader2, AlertCircle, Mail, Lock, UserPlus, Plus, Users, Eye, EyeOff, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { GoogleButton } from '../../../../components/auth/AuthLayout';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLocale } from '../../../../contexts/LocaleContext';
import { handleBookingWithAutoLogin } from '../../../../lib/booking-api';
import { listCountryOptions, resolveCountryMeta } from '../../../../lib/country-utils';
import {
    deriveFlightOption,
    getCountryBasedFlightPolicy,
    getFlightRegistrationOptions,
    type FlightRegistrationOption,
} from '../../../../lib/pilgrimage-flight-policy';
import {
    calculateInstallments,
    getConfiguredInstallmentDeadline,
    getMaxInstallments,
} from '../../../../lib/pilgrimage-installments';

import { DIETARY_MAX_LENGTH, dietaryAnswerSchema } from '../../../../lib/pilgrimage-dietary';
import { getRegistrationFeeDueDate } from '../../../../lib/pilgrimage-payment-deadlines';

import RegistrationPhoneInput from '../../../../components/ui/RegistrationPhoneInput';


import RoomOrganizer, { Room } from '../../../../components/booking/RoomOrganizer';
import VIPLayout from '../../../../components/member/VIPLayout';
import DateInput from '../../../../components/ui/DateInput';
import ChatWidget from '../../../../components/pilgrimage/ChatWidget';
import PilgrimageFlightStep from '../../../../components/booking/PilgrimageFlightStep';
import './registration.css';

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */
// The old short list ended in an "Outro"/"Other" escape hatch that got stored
// verbatim as the country and later blocked checkout, since it maps to no ISO
// code. Offer every country instead, and store the code rather than the label.
const getCountries = (isEn: boolean) => listCountryOptions(isEn ? 'en' : 'pt-PT').map(option => ({
    code: option.code,
    name: option.label,
    postalPlaceholder: resolveCountryMeta(option.code)?.postalPlaceholder || '',
}));
const COUNTRIES = getCountries(false);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Methods accepted on the booking payment page (Reduniq online + bank transfer with receipt).
const PAYMENT_METHOD_CHIPS = [
    { label: 'PIX', labelEn: 'PIX', icon: '/payment-icons/pix.svg' },
    { label: 'Cartão', labelEn: 'Card', icon: '/payment-icons/credit-card.svg' },
    { label: 'MB WAY', labelEn: 'MB WAY', icon: '/payment-icons/mbway.svg' },
    { label: 'Multibanco', labelEn: 'Multibanco', icon: '/payment-icons/multibanco.svg' },
    { label: 'Transferência', labelEn: 'Bank transfer', icon: '' },
];
// Matches --reg-accent in registration.css, so SweetAlert buttons fit the page.
const ACCENT = '#11295a';
const LOCAL_DRAFT_INSTALLMENT_DEADLINES: Record<string, string> = {
    'a7e2616e-fe39-48dc-968e-b14153c25325': '2027-04-01',
};

/* -------------------------------------------------------------------------- */
/*                                 Validations                                */
/* -------------------------------------------------------------------------- */

// -- Schema Defs --
const createBookingSchema = (isEn: boolean) => {
    const t = {
        fullNameReq: isEn ? 'Full name is required' : 'Nome completo é obrigatório',
        emailInv: isEn ? 'Invalid email' : 'Email inválido',
        birthReq: isEn ? 'Birth date required' : 'Data de nascimento obrigatória',
        sexReq: isEn ? 'Sex selection required' : 'Seleção do sexo obrigatória',
        addrReq: isEn ? 'Address required' : 'Morada obrigatória',
        postalReq: isEn ? 'Postal code required' : 'Código Postal / CEP obrigatório',
        cityReq: isEn ? 'City required' : 'Cidade obrigatória',
        countryReq: isEn ? 'Country required' : 'País obrigatório',
        flightReq: isEn ? 'Flight selection required' : 'Seleção do voo obrigatória',
        minPilgrim: isEn ? 'At least 1 pilgrim required' : 'Necessário pelo menos 1 peregrino',
        dupEmail: isEn ? 'You cannot use the same email for multiple people. Each passenger must have a unique email for validation.' : 'Não é permitido usar o mesmo email para múltiplas pessoas. Cada passageiro deve ter um email único para validação.',
        paymentReq: isEn ? 'Select a payment method' : 'Selecione uma forma de pagamento',
        termsReq: isEn ? 'You must accept the terms to continue.' : 'Tens de aceitar as condições para continuar.',
    };
    const pilgrimSchema = z.object({
        full_name: z.string({ required_error: t.fullNameReq }).min(3, t.fullNameReq),
        email: z.string().email(t.emailInv).optional().or(z.literal("")),
        phone: z.string().optional(),
        birth_date: z.string({ required_error: t.birthReq }).min(1, t.birthReq),
        sex: z.enum(["M", "F"], { errorMap: () => ({ message: t.sexReq }) }),
        address: z.string({ required_error: t.addrReq }).min(5, t.addrReq),
        postal_code: z.string({ required_error: t.postalReq }).min(4, t.postalReq),
        city: z.string({ required_error: t.cityReq }).min(2, t.cityReq),
        country: z.string({ required_error: t.countryReq }).min(2, t.countryReq),
        cpf_nif: z.string().optional(),
        flight_option: z.enum(["agency", "own", "none"], { errorMap: () => ({ message: t.flightReq }) }),
        allergies: dietaryAnswerSchema(isEn),
        notes: z.string().optional()
    });
    return z.object({
        pilgrims: z.array(pilgrimSchema).min(1, t.minPilgrim)
            .superRefine((items, ctx) => {
                const emails = items.map(p => p.email?.toLowerCase().trim()).filter(Boolean);
                const unique = new Set(emails);
                if (unique.size !== emails.length) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t.dupEmail, path: [0, "email"] });
                }
            }),
        payment_method: z.enum(['full', 'installments'], { errorMap: () => ({ message: t.paymentReq }) }),
        terms_accepted: z.literal(true, { errorMap: () => ({ message: t.termsReq }) }),
    });
};

type BookingFormValues = z.infer<ReturnType<typeof createBookingSchema>>;

const calculatePilgrimPrice = (pilgrim: any, pilgrimage: any, rooms: Room[], pilgrimIndex: number, isMember: boolean = false) => {
    const room = rooms.find(r => r.occupantIndexes.includes(pilgrimIndex));
    const roomType = room ? room.type : 'double';

    // Age Calc
    let age = 30;
    if (pilgrim.birth_date) {
        const birth = new Date(pilgrim.birth_date);
        age = new Date().getFullYear() - birth.getFullYear();
        const today = new Date();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
    }

    if (isNaN(age)) age = 30;
    const isChild = age <= 6 && age >= 3;
    const isInfant = age <= 2;

    // --- V2 PRICING ENGINE ---
    let subtotal = 0;
    // Access nested structure: pricing_config.room_supplements
    const supplements = pilgrimage?.pricing_config?.room_supplements || {};
    const basePrice = Number(pilgrimage?.base_price) || 0;
    const regFee = Number(pilgrimage?.deposit_value) || 0;

    const supplementPrice = Number(supplements[roomType]) || 0;

    // Formula: Base + Registration Fee + Supplement
    subtotal = basePrice + regFee + supplementPrice;

    // Fallback for hardcoded Single Supplement ONLY if not configured in JSON and type is single
    if (roomType === 'single' && (!supplements.single || supplements.single === 0)) {
        if (Object.keys(supplements).length === 0) subtotal += 250;
    }

    // --- DISCOUNTS ---
    let discount = 0;

    // 1. Age Discounts (Percentage based on Subtotal)
    if (isChild) discount += subtotal * 0.20; // 20% Discount
    if (isInfant) discount = subtotal; // 100% Discount (Overrides everything)

    // 2. Member Discount (Flat 50€) - Only applies if NOT infant (free is free)
    if (isMember && !isInfant) {
        discount += 50;
    }

    const finalPrice = Math.max(0, subtotal - discount);

    return { finalPrice, subtotal, discount, isChild, isInfant, age, roomType, regFee, basePrice, supplementPrice, isMember };
};

// Used for the ✓ on each person chip in joint registrations (display only).
const isPersonComplete = (person?: Partial<BookingFormValues['pilgrims'][number]>) => Boolean(
    person
    && (person.full_name || '').trim().length >= 3
    && person.birth_date
    && (person.address || '').trim().length >= 5
    && (person.postal_code || '').trim().length >= 4
    && (person.city || '').trim().length >= 2
    && person.country
    && (person.allergies || '').trim(),
);

// Utility function to round monetary values to 2 decimal places
const roundToTwo = (num: number): number => Math.round(num * 100) / 100;
const formatMoney = (value: number): string => `${roundToTwo(Number(value) || 0).toFixed(2)}€`;

// -- Step 1: Identification Component --
function StepIdentification({
    onNext,
    initialEmail,
    initialPhone,
    pilgrimageId,
    isPreview = false,
}: {
    onNext: (email: string, phone: string) => void,
    initialEmail?: string,
    initialPhone?: string,
    pilgrimageId?: string,
    isPreview?: boolean,
}) {
    const router = useRouter();
    const { locale, t } = useLocale();
    const isEn = locale === 'en';
    const myRegPath = isEn ? '/en/my-registrations' : '/peregrinacoes/minhas-inscricoes';
    const { user, memberData, signOut } = useAuth(); // Get current user for conditional UX
    const [email, setEmail] = useState(initialEmail || '');
    const [phone, setPhone] = useState<string | undefined>(initialPhone || ''); // PhoneInput uses undefined | string
    const [loading, setLoading] = useState(false);
    const [contactError, setContactError] = useState<string | null>(null);
    // Signed in: confirm the account first. Otherwise email, then the phone on its
    // own screen (the email collapses into a chip). Coming back: straight to phone.
    // 'login' = the typed email already has an account: sign in before going on.
    // "Coming back" is keyed on the phone: the parent pre-fills initialEmail for
    // signed-in users on load, but only has a phone once this step was completed.
    const [phase, setPhase] = useState<'account' | 'email' | 'login' | 'phone'>(() => (initialPhone ? 'phone' : user?.email ? 'account' : 'email'));
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [loginLinkSent, setLoginLinkSent] = useState(false);
    // Inline sign-in (same signInWithPassword call as /login).
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    // The auth context updates a moment after signing in; don't re-ask for login meanwhile.
    const [signedInHere, setSignedInHere] = useState(false);
    const reducedMotion = useReducedMotion();

    // Duplicate State
    const [duplicateFound, setDuplicateFound] = useState<{ exists: boolean, email?: string } | null>(null);


    // Only sync when the parent hands us a new email (coming back to this step).
    // Depending on `email` too reset the field on every keystroke.
    useEffect(() => {
        if (initialEmail && initialEmail.includes('@')) {
            setEmail(initialEmail);
        }
    }, [initialEmail]);

    // If user is logged in, lock email to their account
    useEffect(() => {
        if (user?.email && !initialEmail) {
            setEmail(user.email);
        }
    }, [user, initialEmail]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.includes('@')) {
            setContactError(isEn ? 'Please enter a valid email.' : 'Indique um email válido.');
            return;
        }
        if (!phone || phone.length < 9) {
            setContactError(isEn ? 'Please enter your mobile number.' : 'Indique o seu número de telemóvel.');
            return;
        }
        setContactError(null);

        setLoading(true);
        setDuplicateFound(null);

        if (isPreview) {
            onNext(email, phone);
            setLoading(false);
            return;
        }

        // Check for duplicates
        if (pilgrimageId) {
            try {
                const res = await fetch('/api/booking/check-duplicate', {
                    method: 'POST',
                    body: JSON.stringify({ email, pilgrimageId })
                });
                const checkData = await res.json();

                if (checkData.exists) {
                    setDuplicateFound(checkData);
                    setLoading(false);
                    return; // BLOCK EXECUTION
                }
            } catch (err) {
                console.error("Duplicate check failed:", err);
                // Continue anyway to not block user on technical error
            }
        }

        // If user is not authenticated and this email already has an account,
        // force login before continuing booking flow.
        if (!user && !signedInHere) {
            try {
                const accountRes = await fetch('/api/auth/check-account-exists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const accountData = await accountRes.json().catch(() => ({ exists: false }));

                if (accountData?.exists) {
                    setLoading(false);

                    const next = typeof window !== 'undefined' ? window.location.pathname : (isEn ? '/en/pilgrimages' : '/peregrinacoes');
                    const decision = await Swal.fire({
                        title: isEn ? 'Account already exists' : 'Conta já existente',
                        text: isEn ? 'This email is already registered. To continue your registration, please log in to your account.' : 'Este email já está registado. Para continuar a inscrição, faz login na tua conta.',
                        icon: 'info',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: isEn ? 'Go to login' : 'Ir para login',
                        denyButtonText: isEn ? 'Receive magic link' : 'Receber link mágico',
                        cancelButtonText: isEn ? 'Cancel' : 'Cancelar',
                        confirmButtonColor: ACCENT,
                        denyButtonColor: '#475569',
                    });

                    if (decision.isConfirmed) {
                        router.push(`${isEn ? '/en/login' : '/login'}?next=${encodeURIComponent(next)}`);
                    } else if (decision.isDenied) {
                        await handleSendMagicLink();
                    }
                    return;
                }
            } catch (err) {
                console.warn('Account existence check failed:', err);
            }
        }

        // --- LEAD CAPTURE (ABANDONED CART RECOVERY) ---
        if (pilgrimageId) {
            try {
                // Fire and forget - don't await/block
                fetch('/api/leads/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        phone,
                        name: isEn ? 'Pilgrim (Draft)' : 'Peregrino (Rascunho)',
                        pilgrimageId,
                        step: 1,
                        data: { email, phone, locale },
                        locale
                    })
                });
            } catch (e) {
                // Ignore capture errors
            }
        }

        onNext(email, phone);
        setLoading(false);
    };

    const handleSendMagicLink = async () => {
        const duplicateEmail = (duplicateFound?.email || email || '').trim().toLowerCase();
        if (!duplicateEmail.includes('@')) {
            Swal.fire(isEn ? 'Error' : 'Erro', isEn ? 'Invalid email for sending the link.' : 'Email inválido para envio do link.', 'error');
            return;
        }

        try {
            const endpoint = duplicateFound?.exists && pilgrimageId
                ? '/api/booking/send-access-link'
                : '/api/auth/send-magic-link';

            const payload = duplicateFound?.exists && pilgrimageId
                ? {
                    email: duplicateEmail,
                    pilgrimageId,
                    locale,
                }
                : {
                    email: duplicateEmail,
                    next: myRegPath
                };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || (isEn ? 'Could not send email.' : 'Não foi possível enviar o email.'));
            }

            Swal.fire({
                title: isEn ? 'Check Your Email' : 'Verifique o Email',
                text: isEn ? 'We sent a direct access link to your booking.' : 'Enviámos um link de acesso direto para a sua reserva.',
                icon: 'success',
                confirmButtonColor: ACCENT
            });
        } catch (err: any) {
            Swal.fire(isEn ? 'Error' : 'Erro', err?.message || (isEn ? 'Could not send email.' : 'Não foi possível enviar o email.'), 'error');
        }
    };

    // Helper to determine which UI to show based on auth state
    const getDuplicateModalConfig = () => {
        const duplicateEmail = duplicateFound?.email || email;
        const maskEmail = (email: string) => email.replace(/(?<=.{2}).(?=.*@)/g, '*');

        if (!user) {
            return {
                scenario: 1,
                title: isEn ? 'Booking Already Exists' : 'Reserva Já Existente',
                text: isEn ? 'You already have a confirmed booking for this pilgrimage. We will send you a secure access link to your email.' : 'Já tens uma reserva confirmada para esta peregrinação. Vamos enviar-te um link de acesso seguro ao teu email.',
                showDirectLink: false,
                showMagicLinkButton: true,
                showLogoutButton: false,
            };
        }

        if (user.email === duplicateEmail) {
            return {
                scenario: 2,
                title: isEn ? 'Booking Found' : 'Reserva Encontrada',
                text: isEn ? 'You already have a confirmed booking. Click below to see the details.' : 'Já tens uma reserva confirmada. Clica abaixo para veres os detalhes.',
                showDirectLink: true,
                showMagicLinkButton: false,
                showLogoutButton: false,
            };
        }

        return {
            scenario: 3,
            title: isEn ? 'Attention' : 'Atenção',
            html: isEn ? `
                <div class="text-left space-y-3">
                    <p class="text-gray-700">The email <strong>${maskEmail(duplicateEmail)}</strong> already has a booking for this pilgrimage.</p>
                    <p class="text-gray-600 text-sm">You are logged in with <strong>${user.email}</strong>.</p>
                    <p class="text-gray-600 text-sm">To access the booking, you need to:</p>
                    <ol class="text-sm text-gray-600 list-decimal list-inside space-y-1 ml-2">
                        <li>Sign out of the current session</li>
                        <li>Request an access link for the booking email</li>
                    </ol>
                </div>
            ` : `
                <div class="text-left space-y-3">
                    <p class="text-gray-700">O email <strong>${maskEmail(duplicateEmail)}</strong> já tem uma reserva nesta peregrinação.</p>
                    <p class="text-gray-600 text-sm">Estás autenticado com <strong>${user.email}</strong>.</p>
                    <p class="text-gray-600 text-sm">Para acederes à reserva, precisas de:</p>
                    <ol class="text-sm text-gray-600 list-decimal list-inside space-y-1 ml-2">
                        <li>Terminar a sessão atual</li>
                        <li>Pedir um link de acesso para o email da reserva</li>
                    </ol>
                </div>
            `,
            showDirectLink: false,
            showMagicLinkButton: false,
            showLogoutButton: true,
        };
    };

    // Handle logout and show modal again (now as non-authenticated)
    const handleLogoutAndRequestLink = async () => {
        await signOut();
        // Wait for signOut to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        // Modal will re-render with scenario 1 since user is now null
    };

    // If duplicate is found, show blocking UI
    if (duplicateFound) {
        const config = getDuplicateModalConfig();

        return (
            <div className="reg-dup reg-step">
                <div className="reg-dup-icon"><Check className="w-8 h-8" /></div>
                <h2>{config.title}</h2>
                {config.scenario === 3 && config.html ? (
                    <div dangerouslySetInnerHTML={{ __html: config.html }} className="reg-dup-html" />
                ) : (
                    <>
                        <p>
                            {isEn ? <>The email <strong>{email}</strong> already has an active booking for this pilgrimage.</> : <>O email <strong>{email}</strong> já tem uma reserva ativa nesta peregrinação.</>}
                        </p>
                        {config.text && <p>{config.text}</p>}
                    </>
                )}

                <div className="reg-dup-actions">
                    {/* Scenario 2: Direct link to booking */}
                    {config.showDirectLink && (
                        <button onClick={() => router.push(myRegPath)} className="reg-primary is-block">
                            {isEn ? 'Go to my registrations' : 'Ir para as minhas inscrições'} <ChevronRight className="w-5 h-5" />
                        </button>
                    )}

                    {/* Scenario 1: Magic Link only */}
                    {config.showMagicLinkButton && (
                        <button onClick={handleSendMagicLink} className="reg-primary is-block">
                            <Mail className="w-5 h-5" />
                            {isEn ? 'Receive access link by email' : 'Receber link de acesso por email'}
                        </button>
                    )}

                    {/* Scenario 3: Logout required */}
                    {config.showLogoutButton && (
                        <>
                            <button onClick={handleLogoutAndRequestLink} className="reg-primary reg-danger is-block">
                                {isEn ? 'Sign out and request link' : 'Terminar sessão e pedir link'}
                            </button>
                            <p className="reg-hint" style={{ textAlign: 'center', margin: 0 }}>
                                {isEn ? 'This will end your current session.' : 'Isto irá terminar a tua sessão atual.'}
                            </p>
                        </>
                    )}

                    <button onClick={() => setDuplicateFound(null)} className="reg-ghost" style={{ justifyContent: 'center' }}>
                        {isEn ? 'Try another email' : 'Tentar com outro email'}
                    </button>
                </div>
            </div>
        );
    }

    const emailLooksValid = EMAIL_PATTERN.test(email.trim());
    const slide = reducedMotion
        ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : {
            initial: { opacity: 0, x: 28, filter: 'blur(4px)' },
            animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
            exit: { opacity: 0, x: -28, filter: 'blur(4px)' },
        };

    // Same duplicate / existing-account checks as handleSubmit, but run as soon as
    // the email is entered so people learn right away (handleSubmit keeps them too).
    const goToPhone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailLooksValid) {
            setContactError(isEn ? 'Please enter a valid email.' : 'Indique um email válido.');
            return;
        }
        setContactError(null);
        if (isPreview) {
            setPhase('phone');
            return;
        }

        setCheckingEmail(true);
        try {
            if (pilgrimageId) {
                try {
                    const res = await fetch('/api/booking/check-duplicate', {
                        method: 'POST',
                        body: JSON.stringify({ email, pilgrimageId })
                    });
                    const checkData = await res.json();
                    if (checkData.exists) {
                        setDuplicateFound(checkData);
                        return;
                    }
                } catch (err) {
                    console.error("Duplicate check failed:", err);
                }
            }

            if (!user) {
                try {
                    const accountRes = await fetch('/api/auth/check-account-exists', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    const accountData = await accountRes.json().catch(() => ({ exists: false }));
                    if (accountData?.exists) {
                        setLoginLinkSent(false);
                        setPhase('login');
                        return;
                    }
                } catch (err) {
                    console.warn('Account existence check failed:', err);
                }
            }

            setPhase('phone');
        } finally {
            setCheckingEmail(false);
        }
    };

    // Magic link that brings them back to this registration, already signed in.
    const sendLoginLink = async () => {
        setContactError(null);
        setCheckingEmail(true);
        try {
            const res = await fetch('/api/auth/send-magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), next: window.location.pathname })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) throw new Error(data?.message || '');
            setLoginLinkSent(true);
        } catch (err: unknown) {
            setContactError((err instanceof Error && err.message) || (isEn ? 'Could not send the email. Please try again.' : 'Não foi possível enviar o email. Tente novamente.'));
        } finally {
            setCheckingEmail(false);
        }
    };

    const signInHere = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.trim().length < 6 || signingIn) return;
        setContactError(null);
        setSigningIn(true);
        try {
            if (!supabaseBrowser) throw new Error(isEn ? 'Sign-in is unavailable right now.' : 'O início de sessão não está disponível agora.');
            const { error: loginError } = await supabaseBrowser.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim(),
            });
            if (loginError) throw loginError;
            // AuthContext picks the session up via onAuthStateChange.
            setSignedInHere(true);
            setPassword('');
            setPhase('phone');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '';
            setContactError(
                /invalid login credentials/i.test(message)
                    ? (isEn ? 'Wrong password. Try again, or get a sign-in link by email.' : 'Password incorreta. Tente de novo ou receba um link de acesso por email.')
                    : /email not confirmed/i.test(message)
                        ? (isEn ? 'This email is not confirmed yet. Get a sign-in link by email.' : 'Este email ainda não está confirmado. Receba um link de acesso por email.')
                        : (message || (isEn ? 'Unable to sign in.' : 'Erro ao iniciar sessão.')),
            );
        } finally {
            setSigningIn(false);
        }
    };

    const changeEmail = () => {
        setContactError(null);
        // A signed-in account is confirmed (or swapped) on its own screen.
        setPhase(user ? 'account' : 'email');
    };

    const useAnotherEmail = async () => {
        setContactError(null);
        // The email is locked to the signed-in account: switching means signing out.
        await signOut();
        setEmail('');
        setPhase('email');
    };

    const accountName = (memberData?.nome || '').trim();
    const accountInitial = (accountName || email || '?').charAt(0).toUpperCase();

    const errorBox = (
        <AnimatePresence>
            {contactError && (
                <motion.div
                    className="reg-alert"
                    role="alert"
                    initial={reducedMotion ? false : { opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto', x: reducedMotion ? 0 : [0, -5, 4, -3, 0] }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                >
                    <AlertCircle className="w-5 h-5" />{contactError}
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="reg-hero">
            <AnimatePresence mode="wait" initial={false}>
                {phase === 'account' ? (
                    <motion.div
                        key="account"
                        className="reg-hero-form"
                        {...slide}
                        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <h2 className="reg-hero-q">{isEn ? 'Continue with this account?' : 'Continuar com esta conta?'}</h2>
                        <div className="reg-account">
                            <span className="reg-account-avatar" aria-hidden="true">{accountInitial}</span>
                            <span className="reg-account-text">
                                {accountName && <strong>{accountName}</strong>}
                                <span>{email}</span>
                            </span>
                            <span className="reg-account-check" aria-hidden="true"><Check className="h-4 w-4" strokeWidth={3} /></span>
                        </div>
                        <button type="button" className="reg-primary is-block" autoFocus onClick={() => { setContactError(null); setPhase('phone'); }}>
                            {isEn ? 'Yes, continue' : 'Sim, continuar'} <ChevronRight className="w-5 h-5" />
                        </button>
                        <button type="button" className="reg-secondary is-block reg-account-switch" onClick={useAnotherEmail}>
                            {isEn ? 'Use another email' : 'Usar outro email'}
                        </button>
                    </motion.div>
                ) : phase === 'email' ? (
                    <motion.form
                        key="email"
                        onSubmit={goToPhone}
                        className="reg-hero-form"
                        noValidate
                        {...slide}
                        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <label htmlFor="registration-email" className="reg-hero-q">{isEn ? 'What’s your email?' : 'Qual é o seu email?'}</label>
                        <div className={`reg-hero-field ${contactError ? 'is-invalid' : ''}`}>
                            <input
                                id="registration-email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                enterKeyHint="next"
                                required
                                autoFocus
                                value={email}
                                onChange={e => { setEmail(e.target.value); setContactError(null); }}
                                disabled={loading}
                                placeholder={isEn ? 'you@email.com' : 'nome@email.com'}
                            />
                            <AnimatePresence>
                                {emailLooksValid && (
                                    <motion.span
                                        className="reg-phone-ok"
                                        initial={reducedMotion ? false : { opacity: 0, scale: 0.4 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.6 }}
                                        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                                        aria-hidden="true"
                                    >
                                        <Check className="h-4 w-4" strokeWidth={3} />
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        {errorBox}
                        <button type="submit" className="reg-primary is-block" disabled={checkingEmail}>
                            {checkingEmail
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> {isEn ? 'Checking...' : 'A verificar...'}</>
                                : <>{isEn ? 'Continue' : 'Continuar'} <ChevronRight className="w-5 h-5" /></>}
                        </button>
                    </motion.form>
                ) : phase === 'login' ? (
                    <motion.form
                        key="login"
                        onSubmit={signInHere}
                        className="reg-hero-form"
                        noValidate
                        {...slide}
                        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <motion.button
                            type="button"
                            className="reg-email-chip"
                            onClick={() => { setContactError(null); setPassword(''); setPhase('email'); }}
                            layoutId="reg-email"
                            disabled={signingIn}
                        >
                            <span className="reg-email-chip-icon" aria-hidden="true"><Mail className="h-3.5 w-3.5" /></span>
                            <span className="reg-email-chip-text">{email}</span>
                            <em>{isEn ? 'Change' : 'Alterar'}</em>
                        </motion.button>

                        <label htmlFor="registration-password" className="reg-hero-q">{isEn ? 'Welcome back' : 'Bem-vindo(a) de volta'}</label>
                        <p className="reg-hero-sub">{isEn ? 'This email already has an account. Sign in to continue.' : 'Este email já tem conta. Entre para continuar a inscrição.'}</p>

                        {/* Lets password managers pair the saved password with this email. */}
                        <input type="email" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
                        <div className={`reg-hero-field ${contactError ? 'is-invalid' : ''}`}>
                            <input
                                id="registration-password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                enterKeyHint="go"
                                autoFocus
                                value={password}
                                onChange={e => { setPassword(e.target.value); setContactError(null); }}
                                disabled={signingIn}
                                placeholder={isEn ? 'Your password' : 'A sua password'}
                            />
                            <button
                                type="button"
                                className="reg-reveal"
                                onClick={() => setShowPassword(value => !value)}
                                aria-label={showPassword ? (isEn ? 'Hide password' : 'Esconder password') : (isEn ? 'Show password' : 'Mostrar password')}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                        <div className="reg-login-links">
                            <Link href={t.urls.forgotPassword}>{isEn ? 'Forgot your password?' : 'Esqueceu a password?'}</Link>
                        </div>
                        {errorBox}
                        <button type="submit" className="reg-primary is-block" disabled={signingIn || password.trim().length < 6}>
                            {signingIn
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> {isEn ? 'Signing in...' : 'A entrar...'}</>
                                : <>{isEn ? 'Sign in and continue' : 'Entrar e continuar'} <ChevronRight className="w-5 h-5" /></>}
                        </button>

                        <div className="reg-divider"><span>{isEn ? 'or' : 'ou'}</span></div>

                        <GoogleButton
                            isLoading={signingIn}
                            text={isEn ? 'Continue with Google' : 'Continuar com Google'}
                            locale={isEn ? 'en' : 'pt'}
                            next={typeof window !== 'undefined' ? window.location.pathname : undefined}
                            className="reg-google"
                        />
                        <AnimatePresence mode="wait" initial={false}>
                            {loginLinkSent ? (
                                <motion.div
                                    key="sent"
                                    className="reg-link-sent"
                                    role="status"
                                    initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                >
                                    <span className="reg-account-check" aria-hidden="true"><Check className="h-4 w-4" strokeWidth={3} /></span>
                                    <span>
                                        <strong>{isEn ? 'Check your email' : 'Veja o seu email'}</strong>
                                        {isEn ? 'Open the link we sent to come back here, signed in.' : 'Abra o link que enviámos para voltar aqui já com sessão iniciada.'}
                                    </span>
                                </motion.div>
                            ) : (
                                <motion.button
                                    key="link"
                                    type="button"
                                    className="reg-secondary is-block reg-account-switch"
                                    onClick={sendLoginLink}
                                    disabled={checkingEmail || signingIn}
                                    initial={false}
                                    exit={{ opacity: 0 }}
                                >
                                    {checkingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    {isEn ? 'Email me a sign-in link instead' : 'Entrar sem password (link por email)'}
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </motion.form>
                ) : (
                    <motion.form
                        key="phone"
                        onSubmit={handleSubmit}
                        className="reg-hero-form"
                        noValidate
                        {...slide}
                        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <motion.button
                            type="button"
                            className="reg-email-chip"
                            onClick={changeEmail}
                            layoutId="reg-email"
                            disabled={loading}
                        >
                            <span className="reg-email-chip-icon" aria-hidden="true"><Mail className="h-3.5 w-3.5" /></span>
                            <span className="reg-email-chip-text">{email}</span>
                            <em>{isEn ? 'Change' : 'Alterar'}</em>
                        </motion.button>

                        <label htmlFor="registration-phone" className="reg-hero-q">{isEn ? 'And your mobile?' : 'E o seu telemóvel?'}</label>
                        <div className={`reg-hero-field reg-hero-phone ${contactError ? 'is-invalid' : ''}`}>
                            <RegistrationPhoneInput
                                id="registration-phone"
                                value={phone}
                                onChange={(value) => { setPhone(value); setContactError(null); }}
                                isEn={isEn}
                                autoFocus
                                variant="hero"
                            />
                        </div>
                        {errorBox}
                        <button type="submit" disabled={loading} className="reg-primary is-block">
                            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {isEn ? 'Verifying...' : 'A verificar...'}</> : <>{isEn ? 'Continue' : 'Continuar'} <ChevronRight className="w-5 h-5" /></>}
                        </button>
                        <p className="reg-note"><Lock className="inline h-3.5 w-3.5 -mt-0.5 mr-1" aria-hidden="true" />{isEn ? 'Only used for your trip.' : 'Usado apenas para a sua viagem.'}</p>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper for Pilgrim Card to manage reactivity independently if needed, or straight in map
// We will use standard map but boost Field Labels
const PilgrimCard = ({
    index,
    remove,
    control,
    register,
    trigger,
    errors,
    memberStatus,
    isLeader,
    leaderEmail,
    allEmails,
    isEn,
    countries,
    hideFlightOption = false,
    flightRegistrationOptions = ['none', 'own', 'agency'],
    section = 0,
}: any) => {
    // Watch Country for Postal Code Helper
    const country = useWatch({
        control,
        name: `pilgrims.${index}.country`,
        defaultValue: hideFlightOption ? '' : 'PT'
    });
    const emailValue = useWatch({
        control,
        name: `pilgrims.${index}.email`,
        defaultValue: '',
    });

    const countryList = countries || COUNTRIES;
    const selectedCountry = countryList.find((c: any) => c.code === country)
        || countryList.find((c: any) => c.code === 'PT')
        || countryList[0];
    const postalPlaceholder = selectedCountry.postalPlaceholder || '0000-000';

    const fieldError = (name: string): string | undefined => errors.pilgrims?.[index]?.[name]?.message;
    const fieldClass = (name: string, extra = '') => `reg-field ${extra} ${fieldError(name) ? 'is-invalid error-ring' : ''}`;
    const ErrorText = ({ name }: { name: string }) => fieldError(name)
        ? <span className="reg-error" role="alert"><AlertCircle className="w-4 h-4" /> {fieldError(name)}</span>
        : null;

    const memberBadge = (() => {
        if (!emailValue || !emailValue.includes('@')) return null;

        // Real-time Duplicate Check
        const emailLower = emailValue.toLowerCase().trim();
        const isDuplicate = allEmails?.filter((e: string) => e?.toLowerCase().trim() === emailLower).length > 1;
        if (isDuplicate) {
            return <span className="reg-badge is-warn"><AlertCircle className="w-3 h-3" /> {isEn ? 'Email in use' : 'Email em uso'}</span>;
        }

        if (memberStatus[emailLower]) {
            return <span className="reg-badge is-ok"><Check className="w-3 h-3" /> {isEn ? 'Member (-€50)' : 'Membro (-50€)'}</span>;
        }
        if (emailValue.length > 5) {
            // Non-member upsell
            return <span className="reg-badge is-gold">{isEn ? 'Members save €50' : 'Membros poupam 50€'}</span>;
        }
        return null;
    })();

    return (
        <div className="registration-pilgrim" data-section={section}>
            {index > 0 && (
                <div className="reg-person-bar">
                    <button type="button" onClick={() => remove(index)} className="reg-remove">{isEn ? 'Remove this person' : 'Remover esta pessoa'}</button>
                </div>
            )}

            {/* Personal */}
            {section === 0 && <div className="reg-stack">
                <div>
                    <label className={fieldClass('full_name')}>
                        <span className="reg-field-label">{isEn ? 'Full name' : 'Nome completo'} <em>{isEn ? '· as on your ID' : '· como no documento'}</em></span>
                        <input
                            {...register(`pilgrims.${index}.full_name`)}
                            autoFocus
                            autoComplete={isLeader ? 'name' : 'off'}
                            autoCapitalize="words"
                            enterKeyHint="next"
                            placeholder={isEn ? 'e.g. Mary Smith' : 'Ex.: Maria dos Anjos Silva'}
                        />
                    </label>
                    <ErrorText name="full_name" />
                </div>

                <div>
                    <label className={`reg-field ${isLeader ? 'is-readonly' : ''}`}>
                        <span className="reg-field-label">
                            <span>Email {!isLeader && <em>{isEn ? '· optional' : '· opcional'}</em>}</span>
                            {memberBadge}
                        </span>
                        <Controller
                            control={control}
                            name={`pilgrims.${index}.email`}
                            render={({ field }) => (
                                <input
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    type="email"
                                    inputMode="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    readOnly={isLeader}
                                    placeholder={isEn ? 'email@example.com' : 'email@exemplo.com'}
                                />
                            )}
                        />
                    </label>
                    <ErrorText name="email" />
                </div>

                <Controller
                    control={control}
                    name={`pilgrims.${index}.birth_date`}
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <div className={error ? 'error-ring' : ''}>
                            <DateInput
                                value={value}
                                onChange={onChange}
                                error={error?.message}
                                label={isEn ? 'Date of birth' : 'Data de nascimento'}
                                isEn={isEn}
                            />
                        </div>
                    )}
                />

                <div>
                    <span className="reg-label-out">{isEn ? 'Sex' : 'Sexo'}</span>
                    <div className="reg-segment" role="radiogroup" aria-label={isEn ? 'Sex' : 'Sexo'}>
                        <label className={`reg-choice ${fieldError('sex') ? 'is-invalid error-ring' : ''}`}>
                            <input type="radio" value="F" {...register(`pilgrims.${index}.sex`)} />
                            {isEn ? 'Female' : 'Feminino'}
                        </label>
                        <label className={`reg-choice ${fieldError('sex') ? 'is-invalid' : ''}`}>
                            <input type="radio" value="M" {...register(`pilgrims.${index}.sex`)} />
                            {isEn ? 'Male' : 'Masculino'}
                        </label>
                    </div>
                    <ErrorText name="sex" />
                </div>

                <label className="reg-field">
                    <span className="reg-field-label">{isEn ? 'Tax ID / NIF / CPF' : 'NIF / CPF'} <em>{isEn ? '· optional' : '· opcional'}</em></span>
                    <input {...register(`pilgrims.${index}.cpf_nif`)} autoComplete="off" placeholder={isEn ? 'For the invoice' : 'Para a fatura'} />
                </label>
            </div>}

            {/* Address */}
            {section === 1 && <div className="reg-stack">
                <div>
                    <label className={fieldClass('address')}>
                        <span className="reg-field-label">{isEn ? 'Address' : 'Morada'}</span>
                        <input
                            {...register(`pilgrims.${index}.address`)}
                            autoFocus
                            autoComplete={isLeader ? 'street-address' : 'off'}
                            enterKeyHint="next"
                            placeholder={isEn ? 'Street, number, floor' : 'Rua, número, andar'}
                        />
                    </label>
                    <ErrorText name="address" />
                </div>

                <div className="reg-row">
                    <div>
                        <label className={fieldClass('postal_code')}>
                            <span className="reg-field-label">{isEn ? 'Postal code / ZIP' : 'Código postal / CEP'}</span>
                            <input
                                {...register(`pilgrims.${index}.postal_code`)}
                                autoComplete={isLeader ? 'postal-code' : 'off'}
                                enterKeyHint="next"
                                placeholder={postalPlaceholder}
                            />
                        </label>
                        <ErrorText name="postal_code" />
                    </div>
                    <div>
                        <label className={fieldClass('city')}>
                            <span className="reg-field-label">{isEn ? 'City' : 'Cidade'}</span>
                            <input
                                {...register(`pilgrims.${index}.city`)}
                                autoComplete={isLeader ? 'address-level2' : 'off'}
                                autoCapitalize="words"
                                enterKeyHint="next"
                                placeholder={isEn ? 'e.g. Lisbon' : 'Ex.: Lisboa'}
                            />
                        </label>
                        <ErrorText name="city" />
                    </div>
                </div>

                <div>
                    <label className={fieldClass('country', 'reg-field-select')}>
                        <span className="reg-field-label">{isEn ? 'Country of residence' : 'País de residência'}</span>
                        <select {...register(`pilgrims.${index}.country`)} autoComplete={isLeader ? 'country' : 'off'}>
                            {hideFlightOption && <option value="">{isEn ? 'Select your country...' : 'Escolha o seu país...'}</option>}
                            {countryList.map((c: any) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                    <ErrorText name="country" />
                </div>
            </div>}

            {/* Flight & Extras */}
            {section === 2 && <div className="reg-stack" style={{ gap: 22 }}>
                {!hideFlightOption && (
                    <div>
                        <span className="reg-label-out">{isEn ? 'Flights' : 'Voos'}</span>
                        <div className="reg-stack" style={{ gap: 10 }} role="radiogroup" aria-label={isEn ? 'Flights' : 'Voos'}>
                            {(flightRegistrationOptions as FlightRegistrationOption[]).map((option) => {
                                const selectableFlightOnly = flightRegistrationOptions.length === 2
                                    && !flightRegistrationOptions.includes('none');
                                const labels = selectableFlightOnly
                                    ? {
                                        own: isEn ? ['Own flight', 'I will buy my own tickets'] : ['Voo próprio', 'Eu compro as minhas passagens'],
                                        agency: isEn ? ['Group flight', 'I want to buy through the Agency'] : ['Voo de grupo', 'Quero comprar pela Agência'],
                                        none: isEn ? ["I don't need it", 'I live in Europe/Other'] : ['Não preciso', 'Vivo na Europa/Outro'],
                                    }
                                    : {
                                        none: isEn ? ["I don't need it", 'I live in Europe/Other'] : ['Não preciso', 'Vivo na Europa/Outro'],
                                        own: isEn ? ['Own tickets', 'I will buy my own tickets'] : ['Passagens próprias', 'Eu compro as minhas passagens'],
                                        agency: isEn ? ['Through the Agency', 'I want to buy through the Agency'] : ['Pela Agência', 'Quero comprar pela Agência'],
                                    };

                                return (
                                    <label key={option} className={`reg-choice ${fieldError('flight_option') ? 'is-invalid error-ring' : ''}`}>
                                        <input type="radio" value={option} {...register(`pilgrims.${index}.flight_option`)} />
                                        <span className="reg-choice-mark" aria-hidden="true" />
                                        <span className="reg-choice-body">
                                            <span className="reg-choice-title" style={{ display: 'block' }}>{labels[option][0]}</span>
                                            <span className="reg-choice-desc" style={{ display: 'block' }}>{labels[option][1]}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        <ErrorText name="flight_option" />
                    </div>
                )}

                <div className="reg-callout">
                    <label htmlFor={`registration-dietary-${index}`} className="reg-label-out">{isEn ? 'Food allergies or dietary requirements' : 'Alergias ou restrições alimentares'}</label>
                    <p id={`registration-dietary-help-${index}`} className="reg-help">{isEn ? 'Write what to avoid, or “No”.' : 'Indique o que deve evitar, ou “Não”.'}</p>
                    <div className={fieldClass('allergies')}>
                        <textarea id={`registration-dietary-${index}`} {...register(`pilgrims.${index}.allergies`, { onChange: () => { if (errors.pilgrims?.[index]?.allergies) void trigger(`pilgrims.${index}.allergies`); } })} autoFocus={hideFlightOption} rows={2} maxLength={DIETARY_MAX_LENGTH} aria-required="true" aria-invalid={!!errors.pilgrims?.[index]?.allergies} aria-describedby={`registration-dietary-help-${index} registration-dietary-error-${index}`} placeholder={isEn ? 'E.g. lactose intolerance' : 'Ex.: intolerância à lactose'} />
                    </div>
                    <p id={`registration-dietary-error-${index}`} role="alert" className="reg-error">{errors.pilgrims?.[index]?.allergies?.message}</p>
                </div>

                <label className="reg-field">
                    <span className="reg-field-label">{isEn ? 'Notes' : 'Notas'} <em>{isEn ? '· optional' : '· opcional'}</em></span>
                    <textarea {...register(`pilgrims.${index}.notes`)} rows={3} placeholder={isEn ? 'Mobility, medication, requests…' : 'Mobilidade, medicação, pedidos…'} />
                </label>
            </div>}
        </div>
    );
};

// -- Main Page Component (Reconstruction) --
// ... (Previous logic remains, but PilgrimCard map is replaced)


// -- Loading visuals --
// A PayPal-style ring: the arc spins while it grows and shrinks.
function RegSpinner({ size = 64 }: { size?: number }) {
    return (
        <span className="reg-spinner" style={{ width: size, height: size }} aria-hidden="true">
            <svg className="reg-spinner-ring" viewBox="0 0 50 50">
                <circle className="reg-spinner-track" cx="25" cy="25" r="21" />
                <circle className="reg-spinner-arc" cx="25" cy="25" r="21" />
            </svg>
        </span>
    );
}

// Full-screen overlay while the registration is being created and we redirect to payment.
function SubmittingOverlay({ show, isEn }: { show: boolean; isEn: boolean }) {
    const reduced = useReducedMotion();
    const messages = isEn
        ? ['Confirming your details', 'Reserving your place', 'Preparing your payment']
        : ['A confirmar os seus dados', 'A reservar o seu lugar', 'A preparar o pagamento'];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!show) { setIndex(0); return; }
        // Advance and stay on the last message; never loop back.
        const interval = setInterval(() => setIndex(value => Math.min(value + 1, messages.length - 1)), 1800);
        return () => clearInterval(interval);
    }, [show, messages.length]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="reg-overlay"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <motion.div
                        className="reg-overlay-card"
                        initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    >
                        <RegSpinner size={72} />
                        <div className="reg-overlay-text">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.p
                                    key={index}
                                    initial={reduced ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                                >
                                    {messages[index]}
                                </motion.p>
                            </AnimatePresence>
                            <span>{isEn ? 'Please keep this page open.' : 'Não feche esta página.'}</span>
                        </div>
                        <div className="reg-overlay-steps" aria-hidden="true">
                            {messages.map((_, step) => <i key={step} className={step <= index ? 'is-on' : ''} />)}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// -- Main Page Component --
export default function PilgrimageBookingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const draftId = searchParams.get('draftId');
    const isLocalDraftPreview = process.env.NODE_ENV === 'development' && (Boolean(draftId) || searchParams.get('preview') === '1');
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const myRegPath = isEn ? '/en/my-registrations' : '/peregrinacoes/minhas-inscricoes';
    const bookingSchema = useMemo(() => createBookingSchema(isEn), [isEn]);

    // State
    const [step, setStep] = useState(1);
    const [detailsSection, setDetailsSection] = useState(0);
    const [activePilgrimIndex, setActivePilgrimIndex] = useState(0);
    const [paymentSection, setPaymentSection] = useState(0);
    const [pilgrimage, setPilgrimage] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [installmentCount, setInstallmentCount] = useState<number | null>(null);
    const [flightAcknowledgements, setFlightAcknowledgements] = useState<Record<number, boolean>>({});

    const countryBasedFlightPolicy = useMemo(
        () => getCountryBasedFlightPolicy(pilgrimage),
        [pilgrimage],
    );
    const flightRegistrationOptions = useMemo(
        () => getFlightRegistrationOptions(pilgrimage),
        [pilgrimage],
    );
    const hasCountryBasedFlightStep = Boolean(countryBasedFlightPolicy);
    const requiresExplicitFlightChoice = !flightRegistrationOptions.includes('none');
    const finalStep = hasCountryBasedFlightStep ? 5 : 4;
    const countriesList = useMemo(() => getCountries(isEn), [isEn]);

    // Slide new content in from the right when moving forward, from the left when going back.
    const navPos = step * 100 + activePilgrimIndex * 10 + (step === 2 ? detailsSection : step === finalStep ? paymentSection : 0);
    const [nav, setNav] = useState({ pos: navPos, dir: 'is-forward' });
    if (nav.pos !== navPos) setNav({ pos: navPos, dir: navPos > nav.pos ? 'is-forward' : 'is-back' });
    const navDir = nav.dir;

    const [toast, setToast] = useState<string | null>(null);
    useEffect(() => {
        if (!toast) return;
        const timeout = setTimeout(() => setToast(null), 2800);
        return () => clearTimeout(timeout);
    }, [toast]);

    // User State
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');

    // Auth Context for auto-login
    const { setSession, isAuthenticated, loading: authLoading, user, signOut } = useAuth();

    // Form
    const methods = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
        defaultValues: { pilgrims: [], payment_method: 'installments' }
    });
    const { handleSubmit, watch, control, formState: { errors } } = methods;
    const { fields, append, remove } = useFieldArray({ control, name: "pilgrims" });

    // Watch pilgrims for realtime price calculation
    // FIX: Use useWatch instead of watch for reliable array updates in parent
    const [rooms, setRooms] = useState<Room[]>([]);

    // We need to use useWatch to get the latest array state for the Effect
    const currentPilgrims = useWatch({
        control: methods.control,
        name: 'pilgrims',
        defaultValue: []
    });

    useEffect(() => {
        if (!countryBasedFlightPolicy) return;

        currentPilgrims.forEach((pilgrim, index) => {
            const derivedOption = deriveFlightOption(pilgrim.country, countryBasedFlightPolicy);
            if (derivedOption && pilgrim.flight_option !== derivedOption) {
                methods.setValue(`pilgrims.${index}.flight_option`, derivedOption, {
                    shouldDirty: true,
                    shouldValidate: false,
                });
            }
        });
    }, [countryBasedFlightPolicy, currentPilgrims, methods]);

    const residenceCountrySignature = currentPilgrims.map(pilgrim => pilgrim.country || '').join('|');
    useEffect(() => {
        if (countryBasedFlightPolicy) setFlightAcknowledgements({});
    }, [countryBasedFlightPolicy, residenceCountrySignature]);

    // Member Status State
    const [memberStatus, setMemberStatus] = useState<Record<string, boolean>>({});

    // Debounced Member Check
    // Debounced Member Check
    useEffect(() => {
        console.log("🔍 [Frontend] Raw Pilgrims:", JSON.stringify(currentPilgrims));
        const emailsToCheck = currentPilgrims
            .map(p => p.email)
            .filter(e => e && e.includes('@') && e.length > 5)
            .map(e => e?.toLowerCase().trim()) as string[];

        // Also include the main user email if it's assigned to pilgrim 0
        if (userEmail && currentPilgrims.length > 0 && (!currentPilgrims[0].email || currentPilgrims[0].email === userEmail)) {
            emailsToCheck.push(userEmail.toLowerCase().trim());
        }

        if (emailsToCheck.length === 0) return;

        const timeoutId = setTimeout(async () => {
            const uniqueEmails = [...new Set(emailsToCheck)];
            try {
                const res = await fetch('/api/members/check-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emails: uniqueEmails })
                });
                const { results } = await res.json();
                setMemberStatus(prev => ({ ...prev, ...results }));
            } catch (err) {
                console.error("Member check failed", err);
            }
        }, 800); // 800ms debounce

        return () => clearTimeout(timeoutId);
    }, [currentPilgrims, userEmail]);

    // Init
    useEffect(() => {
        const init = async () => {
            if (!supabaseBrowser) return;
            const pilgrimageQuery = supabaseBrowser.from('pilgrimages').select('*');
            const { data: pData, error } = isLocalDraftPreview && draftId
                ? await pilgrimageQuery.eq('id', draftId).eq('status', 'draft').single()
                : await pilgrimageQuery.eq('slug', slug).single();

            let resolved = pData;
            // Early-access pilgrimages are hidden from anon reads by RLS; a
            // code-holder (valid grant cookie) loads them through the gated API.
            if (!isLocalDraftPreview && (error || !pData)) {
                const ea = await fetch(`/api/pilgrimages/${encodeURIComponent(slug)}/early-access`, { cache: 'no-store' })
                    .then((r) => (r.ok ? r.json() : null))
                    .catch(() => null);
                if (ea?.pilgrimage) resolved = ea.pilgrimage;
            }

            if (!resolved) { setLoading(false); return; }
            setPilgrimage(resolved);

            const { data: { user } } = await supabaseBrowser.auth.getUser();
            if (user) {
                setUserEmail(user.email || '');
            }
            setLoading(false);
        };
        init();
    }, [draftId, isLocalDraftPreview, slug]);

    // Calculated Totals (Moved up for onSubmit access)
    const pricedPilgrims = useMemo(() => {
        return (currentPilgrims || []).map((pilgrim, index) => {
            const effectiveEmail = (pilgrim.email || (index === 0 ? userEmail : '') || '').toLowerCase().trim();
            const isMember = !!memberStatus[effectiveEmail];
            const price = calculatePilgrimPrice(pilgrim, pilgrimage, rooms, index, isMember);
            const memberDiscount = price.isMember && !price.isInfant ? 50 : 0;
            const ageDiscount = Math.max(0, price.discount - memberDiscount);
            const supplementTotal = Math.max(0, price.subtotal - price.basePrice - price.regFee);
            return { pilgrim, index, email: effectiveEmail, isMember, price, memberDiscount, ageDiscount, supplementTotal };
        });
    }, [currentPilgrims, userEmail, memberStatus, pilgrimage, rooms]);

    const baseTotal = pricedPilgrims.reduce((sum, p) => sum + Number(p.price.basePrice || 0), 0);
    const depositTotal = pricedPilgrims.reduce((sum, p) => sum + Number(p.price.regFee || 0), 0);
    const supplementsTotal = pricedPilgrims.reduce((sum, p) => sum + Number(p.supplementTotal || 0), 0);
    const ageDiscountTotal = pricedPilgrims.reduce((sum, p) => sum + Number(p.ageDiscount || 0), 0);
    const memberDiscountTotal = pricedPilgrims.reduce((sum, p) => sum + Number(p.memberDiscount || 0), 0);
    const totalBookingAmount = pricedPilgrims.reduce((sum, p) => sum + Number(p.price.finalPrice || 0), 0);
    const installmentDeadline = getConfiguredInstallmentDeadline(pilgrimage)
        ?? (
            isLocalDraftPreview && draftId
                ? LOCAL_DRAFT_INSTALLMENT_DEADLINES[draftId] || null
                : null
        );
    const maximumInstallmentCount = pilgrimage
        ? getMaxInstallments(pilgrimage.start_date, installmentDeadline)
        : 1;
    const installmentDeadlineLabel = installmentDeadline
        ? new Intl.DateTimeFormat(isEn ? 'en-GB' : 'pt-PT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(new Date(`${installmentDeadline}T12:00:00`))
        : null;

    // Handlers
    const handleIdentitySubmit = (email: string, phone: string) => {
        setUserEmail(email);
        setUserPhone(phone);
        if (fields.length === 0) {
            append({
                full_name: '', email: email, phone: '', birth_date: '', sex: 'M', // Phone will be overwritten on Submit for leader
                address: '', postal_code: '', city: '', country: hasCountryBasedFlightStep ? '' : 'PT',
                flight_option: (hasCountryBasedFlightStep || requiresExplicitFlightChoice ? '' : 'none') as any,
                allergies: '', notes: '', cpf_nif: ''
            });
        }
        setActivePilgrimIndex(0);
        setDetailsSection(0);
        setStep(2);
        window.scrollTo(0, 0);
    };

    const nextStep = async () => {
        if (step === 2) {
            if (countryBasedFlightPolicy) {
                methods.getValues('pilgrims').forEach((pilgrim, index) => {
                    const derivedOption = deriveFlightOption(pilgrim.country, countryBasedFlightPolicy);
                    if (derivedOption) {
                        methods.setValue(`pilgrims.${index}.flight_option`, derivedOption, {
                            shouldDirty: true,
                            shouldValidate: false,
                        });
                    }
                });
            }

            const valid = await methods.trigger('pilgrims');
            if (!valid) {
                handleValidationErrors();
                return;
            }

            // Age Validation: At least one person must be an adult (>= 18)
            // (User mentioned >6, but legal responsibility requires 18. Adjusting for safety).
            const pilgrims = watch('pilgrims');
            const hasAdult = pilgrims.some(p => {
                if (!p.birth_date) return false;
                const birth = new Date(p.birth_date);
                let age = new Date().getFullYear() - birth.getFullYear();
                const today = new Date();
                if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
                    age--;
                }
                return age >= 18;
            });

            if (!hasAdult) {
                alert(isEn ? 'At least one adult (18 or over) responsible for the registration is required.' : 'É necessário pelo menos um adulto (maior de 18 anos) responsável pela inscrição.');
                return;
            }
        }
        if (step === 3) {
            const assignedCount = rooms.reduce((acc, r) => acc + r.occupantIndexes.length, 0);
            if (assignedCount < fields.length) {
                Swal.fire({
                    title: isEn ? 'Rooms not assigned!' : 'Quartos por atribuir!',
                    text: isEn ? 'Please place all pilgrims in a room before continuing.' : 'Por favor, coloca todos os peregrinos num quarto antes de continuar.',
                    icon: 'warning',
                    confirmButtonColor: ACCENT
                });
                return;
            }
        }
        setStep(s => s + 1);
        window.scrollTo(0, 0);
    };

    const detailFields = (index: number, section: number) => {
        if (section === 0) return [
            `pilgrims.${index}.full_name`, `pilgrims.${index}.email`,
            `pilgrims.${index}.birth_date`, `pilgrims.${index}.sex`,
        ] as const;
        if (section === 1) return [
            `pilgrims.${index}.address`, `pilgrims.${index}.country`,
            `pilgrims.${index}.postal_code`, `pilgrims.${index}.city`,
        ] as const;
        return [`pilgrims.${index}.flight_option`, `pilgrims.${index}.allergies`] as const;
    };

    const advanceDetails = async () => {
        const valid = await methods.trigger(detailFields(activePilgrimIndex, detailsSection), { shouldFocus: true });
        if (!valid) return;
        if (detailsSection < 2) {
            setDetailsSection(value => value + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        await nextStep();
    };

    const addFamilyMember = async () => {
        const valid = await methods.trigger(`pilgrims.${activePilgrimIndex}`, { shouldFocus: true });
        if (!valid) return;
        append({ full_name: '', email: '', phone: '', birth_date: '', sex: 'M', address: '', postal_code: '', city: '', country: hasCountryBasedFlightStep ? '' : 'PT', flight_option: (hasCountryBasedFlightStep || requiresExplicitFlightChoice ? '' : 'none') as any, allergies: '', notes: '', cpf_nif: '' });
        setActivePilgrimIndex(fields.length);
        setDetailsSection(0);
        setToast(isEn ? `Person ${fields.length + 1} added to the same registration` : `Pessoa ${fields.length + 1} adicionada à mesma inscrição`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const continueFromFlightStep = () => {
        if (!countryBasedFlightPolicy) return;
        const allAcknowledged = currentPilgrims.length > 0
            && currentPilgrims.every((_, index) => flightAcknowledgements[index]);
        if (!allAcknowledged) return;

        currentPilgrims.forEach((pilgrim, index) => {
            const derivedOption = deriveFlightOption(pilgrim.country, countryBasedFlightPolicy);
            if (derivedOption) {
                methods.setValue(`pilgrims.${index}.flight_option`, derivedOption, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
        });
        setStep(5);
        window.scrollTo(0, 0);
    };

    const handleValidationErrors = () => {
        // 1. Show Global Alert
        Swal.fire({
            title: isEn ? 'Required data missing!' : 'Faltam dados obrigatórios!',
            text: isEn ? 'There are empty or incorrect fields. Please check the fields marked in red.' : 'Existem campos por preencher ou incorretos. Por favor verifica os campos assinalados a vermelho.',
            icon: 'error',
            confirmButtonColor: '#d33',
            confirmButtonText: isEn ? 'Check Fields' : 'Verificar Campos'
        });

        // 2. Scroll to first error
        // Because of multi-step or dynamic forms, let's try to find the first error field
        // We need a timeout to let React render validation states (red borders)
        setTimeout(() => {
            const firstError = document.querySelector('.error-ring');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Fallback: Scroll to top of form
                const formStart = document.getElementById('booking-form-start');
                if (formStart) formStart.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const onError = (errors: any) => {
        console.log("Validation Errors:", errors);
        handleValidationErrors();
    };

    const onSubmit = async (data: BookingFormValues) => {
        console.log("🚀 [Frontend] onSubmit called - starting booking process");

        if (isLocalDraftPreview) {
            await Swal.fire({
                title: isEn ? 'Local preview completed' : 'Pré-visualização local concluída',
                text: isEn
                    ? 'No booking, lead, or payment was created.'
                    : 'Não foi criada nenhuma inscrição, lead ou pagamento.',
                icon: 'success',
                confirmButtonColor: ACCENT,
            });
            return;
        }

        setSubmitting(true);
        try {
            const pilgrimsPayload = data.pilgrims.map((p, idx) => {
                const room = rooms.find(r => r.occupantIndexes.includes(idx));
                const finalPhone = (idx === 0) ? userPhone : (p.phone || '');

                // Append Room Details to Notes
                let extraNotes = '';
                if (room) {
                    if (room.bed_type) extraNotes += `\n[${isEn ? 'Bed Pref.' : 'Pref. Cama'}: ${room.bed_type === 'big_bed' ? (isEn ? 'Double' : 'Casal') : 'Twin'}]`;
                    if (room.sharing_mode) extraNotes += `\n[${isEn ? 'Sharing Mode' : 'Modo Partilha'}: ${room.sharing_mode === 'random' ? (isEn ? 'Random' : 'Aleatório') : (isEn ? 'With Friend' : 'Com Amigo')}]`;
                    if (room.sharing_with_names && room.sharing_with_names.length > 0) {
                        const names = room.sharing_with_names.filter(Boolean).join(', ');
                        if (names) extraNotes += `\n[${isEn ? 'With Whom' : 'Com Quem'}: ${names}]`;
                    }
                }

                return {
                    ...p,
                    flight_option: countryBasedFlightPolicy
                        ? deriveFlightOption(p.country, countryBasedFlightPolicy)
                        : p.flight_option,
                    flight_policy_acknowledged: countryBasedFlightPolicy
                        ? Boolean(flightAcknowledgements[idx])
                        : undefined,
                    phone: finalPhone,
                    room_type: room?.type || 'double',
                    notes: (p.notes || '') + extraNotes
                };
            });

            console.log("🔵 [Frontend] Preparing booking request...");
            console.log("📧 Email:", userEmail);
            console.log("🆔 Pilgrimage ID:", pilgrimage.id);
            console.log("👥 Pilgrims count:", pilgrimsPayload.length);
            console.log("💳 Payment method:", data.payment_method);

            // Use auto-login helper
            const paymentPlan = data.payment_method === 'installments' ? calculateInstallments(
                totalBookingAmount - depositTotal,
                pilgrimage.start_date,
                installmentCount || maximumInstallmentCount,
                installmentDeadline,
            ) : null;

            console.log("📞 [Frontend] Calling handleBookingWithAutoLogin...");

            const result = await handleBookingWithAutoLogin({
                email: userEmail,
                pilgrimage_id: pilgrimage.id,
                payment_method: data.payment_method,
                installment_count: installmentCount || maximumInstallmentCount,
                payment_plan: paymentPlan ? JSON.stringify(paymentPlan) : undefined,
                pilgrim_data: pilgrimsPayload,
                terms_accepted: data.terms_accepted,
                locale: isEn ? 'en' : 'pt'
            }, setSession);

            console.log("✅ [Frontend] handleBookingWithAutoLogin completed");

            // Go directly to the booking page, where the short payment tutorial
            // explains the 5-day registration-fee deadline and shows where to pay.
            const inscricaoBase = isEn ? '/en/pilgrimages/registration' : '/peregrinacoes/inscricao';
            const tutorialParams = new URLSearchParams({
                viewToken: result.view_token || '',
                token: result.view_token || '',
                payment_tutorial: 'true',
            });
            if (result.new_account) tutorialParams.set('first_time', 'true');
            const redirectUrl = `${inscricaoBase}/${result.booking_id}?${tutorialParams.toString()}`;
            console.log("🔄 [Frontend] Redirecting to:", redirectUrl);
            window.location.href = redirectUrl;

        } catch (err: any) {
            console.error("🚨 [Frontend] Booking error:", err);

            // [SENIOR UX] User exists logic
            if (err.message && (err.message.includes('already registered') || err.message.includes('User already registered') || err.code === 'user_already_exists')) {
                setSubmitting(false);

                // 1. Show Friendly Modal
                const { isConfirmed } = await Swal.fire({
                    title: isEn ? 'You already have an active account!' : 'Já tem conta ativa!',
                    html: isEn ? `
                        <p class="mb-4">The email <strong>${userEmail}</strong> is already registered on our platform.</p>
                        <p class="mb-4 text-sm text-slate-400">For your security, we need you to confirm your identity.</p>
                        <p class="font-bold text-yellow-500">Would you like to receive a link by email to sign in without a password?</p>
                    ` : `
                        <p class="mb-4">O email <strong>${userEmail}</strong> já está registado na nossa plataforma.</p>
                        <p class="mb-4 text-sm text-slate-400">Para sua segurança, precisamos que confirme a sua identidade.</p>
                        <p class="font-bold text-yellow-500">Quer receber um link no email para entrar sem password?</p>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonColor: ACCENT,
                    cancelButtonColor: '#334155',
                    confirmButtonText: isEn ? 'Yes, send Link' : 'Sim, enviar Link',
                    cancelButtonText: isEn ? "No, I'll try again" : 'Não, vou tentar outra vez'
                });

                if (isConfirmed) {
                    Swal.fire({
                        title: isEn ? 'Sending...' : 'A enviar...',
                        didOpen: () => Swal.showLoading()
                    });

                    try {
                        if (!supabaseBrowser) throw new Error(isEn ? 'Supabase client not initialized' : 'Cliente Supabase não inicializado');

                        const redirectPath = isEn ? `/en/pilgrimages/${slug}/register` : `/peregrinacoes/${slug}/inscrever`;
                        const { error } = await supabaseBrowser.auth.signInWithOtp({
                            email: userEmail,
                            options: {
                                emailRedirectTo: `${window.location.origin}/auth-callback?next=${redirectPath}`,
                            }
                        });

                        if (error) throw error;

                        Swal.fire({
                            title: isEn ? 'Check your email' : 'Verifique o seu email',
                            text: isEn ? 'We sent a magic link! Click it to sign in and finish your registration.' : 'Enviámos um link mágico! Clique nele para entrar e finalizar a inscrição.',
                            icon: 'success',
                            confirmButtonText: isEn ? 'Got it' : 'Entendido'
                        });

                    } catch (magicErr: any) {
                        Swal.fire(isEn ? 'Error' : 'Erro', (isEn ? 'Could not send the link: ' : 'Não foi possível enviar o link: ') + magicErr.message, 'error');
                    }
                }
                return;
            }

            console.error("🚨 [Frontend] Error stack:", err.stack);
            alert((isEn ? 'Error: ' : 'Erro: ') + err.message);
            setSubmitting(false);
        }
    };


    if (loading || authLoading) return <div className="registration-page reg-page-loader" role="status" aria-label={isEn ? 'Loading registration' : 'A carregar inscrição'}><RegSpinner size={56} /></div>;
    if (!pilgrimage) return <div className="min-h-screen bg-white text-slate-600 text-center pt-20">{isEn ? 'Pilgrimage not found.' : 'Peregrinação não encontrada.'}</div>;

    const stepLabels = hasCountryBasedFlightStep
        ? (isEn
            ? ['Contact', 'Travellers', 'Room', 'Flights', 'Payment']
            : ['Contactos', 'Pessoas', 'Quarto', 'Voos', 'Pagamento'])
        : (isEn
            ? ['Contact', 'Travellers', 'Room', 'Payment']
            : ['Contactos', 'Pessoas', 'Quarto', 'Pagamento']);

    const pilgrimageTitle = (isEn && pilgrimage.title_en) ? pilgrimage.title_en : pilgrimage.title;
    // Same 5-day rule the booking page and reminder emails use (counted from today).
    const registrationFeeDue = getRegistrationFeeDueDate(new Date().toISOString());
    const registrationFeeDueLabel = registrationFeeDue
        ? new Intl.DateTimeFormat(isEn ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'long' }).format(new Date(registrationFeeDue))
        : null;

    const tripDates = (() => {
        if (!pilgrimage.start_date) return null;
        const fmt = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
        const start = new Date(`${String(pilgrimage.start_date).slice(0, 10)}T12:00:00`);
        const end = pilgrimage.end_date ? new Date(`${String(pilgrimage.end_date).slice(0, 10)}T12:00:00`) : null;
        if (isNaN(start.getTime())) return null;
        return end && !isNaN(end.getTime()) ? `${fmt.format(start)} – ${fmt.format(end)}` : fmt.format(start);
    })();

    // Progress fills smoothly through the sub-sections of the long steps.
    const stepProgress = step === 2 ? (detailsSection + 1) / 3 : step === finalStep ? (paymentSection + 1) / 2 : 1;
    const progressPct = Math.round(((step - 1 + (step === 1 ? 0.35 : stepProgress)) / stepLabels.length) * 100);

    const detailTitles = isEn ? ['About you', 'Where do you live?', 'Last details'] : ['Sobre si', 'Onde vive?', 'Últimos detalhes'];
    const activeName = currentPilgrims[activePilgrimIndex]?.full_name?.trim();
    const personEyebrow = fields.length > 1 || activePilgrimIndex > 0
        ? `${activeName || `${isEn ? 'Person' : 'Pessoa'} ${activePilgrimIndex + 1}`} · ${detailsSection + 1}/3`
        : `${isEn ? 'Step' : 'Parte'} ${detailsSection + 1} ${isEn ? 'of' : 'de'} 3`;

    // Enter moves forward on the details step, like a native app (textareas keep newlines).
    const handleDetailsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (event.key !== 'Enter' || event.shiftKey || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
        event.preventDefault();
        void advanceDetails();
    };

    return (
        <VIPLayout allowPublic={true} className="registration-page" showQuotaWarning={false}>
            <header className="reg-header">
                <div className="reg-header-inner">
                    <Link href={isEn ? `/en/pilgrimages/${slug}` : `/peregrinacoes/${slug}`} className="reg-back-link" aria-label={isEn ? 'Back to pilgrimage' : 'Voltar à peregrinação'}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></Link>
                    <div className="reg-header-trip">
                        <p className="reg-trip-title">{pilgrimageTitle}</p>
                        {tripDates && <p className="reg-trip-dates">{tripDates}</p>}
                    </div>
                    <span className="reg-step-count"><strong>{stepLabels[step - 1]}</strong> {step}/{stepLabels.length}</span>
                </div>
                <div className="reg-progress-track" role="progressbar" aria-label={isEn ? 'Registration progress' : 'Progresso da inscrição'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
                    <div className="reg-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
            </header>

            <main className="reg-main">
                <section className={`reg-card ${step === 1 ? 'is-bare' : ''}`} aria-label={stepLabels[step - 1]}>
                    {step === 1 && (
                        <StepIdentification
                            onNext={handleIdentitySubmit}
                            initialEmail={userEmail}
                            initialPhone={userPhone}
                            pilgrimageId={pilgrimage.id}
                            isPreview={isLocalDraftPreview}
                        />
                    )}

                    {step > 1 && (
                        <div id="booking-form-start">
                            <FormProvider {...methods}>
                                <form onSubmit={handleSubmit(onSubmit, onError)} className={`reg-step ${navDir}`} key={step}>
                                    {step === 2 && (
                                        <div className="registration-details" onKeyDown={handleDetailsKeyDown}>
                                            <div className="reg-step-head">
                                                <p className="reg-eyebrow">{personEyebrow}</p>
                                                <h2>{detailTitles[detailsSection]}</h2>
                                            </div>
                                            {fields.length > 1 && <div className="reg-group">
                                                <div className="reg-group-head">
                                                    <span><Users className="h-4 w-4" aria-hidden="true" />{isEn ? `Joint registration · ${fields.length} people` : `Inscrição conjunta · ${fields.length} pessoas`}</span>
                                                    <span className="reg-badge is-ok">{isEn ? '1 payment' : '1 pagamento'}</span>
                                                </div>
                                                <div className="reg-people" aria-label={isEn ? 'Travellers' : 'Pessoas'}>{fields.map((field, index) => {
                                                    const person = currentPilgrims[index];
                                                    const name = person?.full_name?.trim();
                                                    const complete = isPersonComplete(person);
                                                    return (
                                                        <button type="button" key={field.id} className={`${index === activePilgrimIndex ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`} onClick={() => { setActivePilgrimIndex(index); setDetailsSection(0); }}>
                                                            <span className="reg-avatar" aria-hidden="true">{complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : (name ? name.charAt(0).toUpperCase() : index + 1)}</span>
                                                            <span>{name || `${isEn ? 'Person' : 'Pessoa'} ${index + 1}`}</span>
                                                        </button>
                                                    );
                                                })}</div>
                                            </div>}
                                            <div key={`${activePilgrimIndex}-${detailsSection}`} className={`reg-section ${navDir}`}>
                                            {fields.map((field, idx) => idx === activePilgrimIndex && (
                                                <PilgrimCard
                                                    key={field.id}
                                                    index={idx}
                                                    section={detailsSection}
                                                    remove={(index: number) => { remove(index); setActivePilgrimIndex(Math.max(0, index - 1)); setDetailsSection(2); }}
                                                    control={methods.control}
                                                    register={methods.register}
                                                    trigger={methods.trigger}
                                                    errors={errors}
                                                    memberStatus={memberStatus} // Pass verification map
                                                    isLeader={idx === 0}
                                                    leaderEmail={userEmail}
                                                    allEmails={currentPilgrims.map(p => p.email)}
                                                    isEn={isEn}
                                                    countries={countriesList}
                                                    hideFlightOption={hasCountryBasedFlightStep}
                                                    flightRegistrationOptions={flightRegistrationOptions}
                                                />
                                            ))}
                                            {detailsSection === 2 && <div className="reg-family">
                                                <div className="reg-family-top">
                                                    <div className="reg-avatar-stack" aria-hidden="true">
                                                        {currentPilgrims.slice(0, 4).map((person, index) => (
                                                            <span key={index} className="reg-avatar">{person?.full_name?.trim()?.charAt(0).toUpperCase() || index + 1}</span>
                                                        ))}
                                                        <span className="reg-avatar is-add"><Plus className="h-3.5 w-3.5" strokeWidth={3} /></span>
                                                    </div>
                                                    <div>
                                                        <h4>{fields.length > 1 ? (isEn ? 'Anyone else from your household?' : 'Mais alguém da sua família?') : (isEn ? 'Travelling with family?' : 'Viaja com alguém da família?')}</h4>
                                                        <p>{isEn ? 'Add the people who live with you.' : 'Adicione quem vive consigo.'}</p>
                                                    </div>
                                                </div>
                                                <ul className="reg-perks">
                                                    <li><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />{isEn ? 'Same registration' : 'Mesma inscrição'}</li>
                                                    <li><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />{isEn ? 'One single payment' : 'Um só pagamento'}</li>
                                                    <li><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />{isEn ? 'Rooms arranged together' : 'Quartos organizados juntos'}</li>
                                                </ul>
                                                <button type="button" onClick={addFamilyMember} className="reg-secondary is-block">
                                                    <UserPlus className="h-4 w-4" aria-hidden="true" />{isEn ? 'Add family member' : 'Adicionar familiar'}
                                                </button>
                                                <p className="reg-family-foot">{isEn ? 'Friends and acquaintances register separately.' : 'Amigos e conhecidos fazem a sua própria inscrição.'}</p>
                                            </div>}
                                            </div>
                                            <div className="reg-actions">
                                                <button type="button" onClick={() => { if (detailsSection > 0) setDetailsSection(value => value - 1); else if (activePilgrimIndex > 0) { setActivePilgrimIndex(value => value - 1); setDetailsSection(2); } else setStep(1); }} className="reg-ghost"><ChevronLeft className="w-5 h-5" />{isEn ? 'Back' : 'Voltar'}</button>
                                                <button type="button" onClick={advanceDetails} className="reg-primary">
                                                    {detailsSection === 2 ? (isEn ? 'Choose room' : 'Escolher quarto') : (isEn ? 'Continue' : 'Continuar')} <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div>
                                            <div className="reg-step-head">
                                                <h2>{isEn ? 'How would you like to stay?' : 'Como prefere ficar?'}</h2>
                                            </div>
                                            <RoomOrganizer
                                                pilgrims={watch('pilgrims')}
                                                onUpdate={setRooms}
                                                pricing={pilgrimage?.pricing_config?.room_supplements}
                                            />
                                            <div className="reg-actions"><button type="button" onClick={() => { setStep(2); setDetailsSection(2); }} className="reg-ghost"><ChevronLeft className="w-5 h-5" />{isEn ? 'Back' : 'Voltar'}</button><button type="button" onClick={nextStep} className="reg-primary">{hasCountryBasedFlightStep ? (isEn ? 'Flight information' : 'Informação dos voos') : (isEn ? 'Review payment' : 'Ver pagamento')} <ChevronRight className="w-5 h-5" /></button></div>
                                        </div>
                                    )}

                                    {hasCountryBasedFlightStep && step === 4 && countryBasedFlightPolicy && (
                                        <PilgrimageFlightStep
                                            pilgrims={currentPilgrims}
                                            policy={countryBasedFlightPolicy}
                                            acknowledgements={flightAcknowledgements}
                                            onAcknowledgementChange={(index, acknowledged) => {
                                                setFlightAcknowledgements(previous => ({
                                                    ...previous,
                                                    [index]: acknowledged,
                                                }));
                                            }}
                                            onBack={() => {
                                                setStep(3);
                                                window.scrollTo(0, 0);
                                            }}
                                            onContinue={continueFromFlightStep}
                                            isEn={isEn}
                                        />
                                    )}

                                    {step === finalStep && (
                                        <div key={paymentSection} className={`reg-section ${navDir}`}>
                                            <div className="reg-step-head">
                                                <h2>{paymentSection === 0 ? (isEn ? 'How would you like to pay?' : 'Como prefere pagar?') : (isEn ? 'Review and confirm' : 'Reveja e confirme')}</h2>
                                            </div>

                                            {paymentSection === 1 && <div className="reg-receipt">
                                                {pricedPilgrims.map(({ pilgrim: f, index: i, price: pPrice }) => {
                                                    return (
                                                        <div key={i} className="reg-receipt-person">
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <h4>{f.full_name || (isEn ? 'Person ' : 'Pessoa ') + (i + 1)}</h4>
                                                                <p>
                                                                    {isEn ? (pPrice.roomType === 'single' ? 'Single room' : pPrice.roomType === 'double' ? 'Double room (shared)' : pPrice.roomType === 'triple' ? 'Triple room' : 'Family room') : (pPrice.roomType === 'single' ? 'Quarto individual' : pPrice.roomType === 'double' ? 'Quarto duplo (partilhado)' : pPrice.roomType === 'triple' ? 'Quarto triplo' : 'Quarto familiar')}
                                                                </p>
                                                                {pPrice.isMember && <span className="reg-badge is-ok"><Check className="w-3 h-3" /> {isEn ? 'Member (-€50.00)' : 'Membro (-50,00€)'}</span>}
                                                                <p className="reg-diet">{isEn ? 'Food allergies / dietary requirements: ' : 'Alergias / restrições alimentares: '}{f.allergies}</p>
                                                            </div>
                                                            <div className="reg-receipt-price">
                                                                <strong>{formatMoney(pPrice.finalPrice)}</strong>
                                                                {pPrice.isChild && <small>{isEn ? 'Child disc. (20%)' : 'Desc. criança (20%)'}</small>}
                                                                {pPrice.isInfant && <small>{isEn ? 'Infant exemption' : 'Isenção bebé'}</small>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                <div className="reg-receipt-lines">
                                                    <div>
                                                        <span>{isEn ? 'Base amount' : 'Valor base'}</span>
                                                        <span>{formatMoney(baseTotal)}</span>
                                                    </div>
                                                    <div>
                                                        <span>{isEn ? 'Registration fees' : 'Taxas de inscrição'}</span>
                                                        <span>{formatMoney(depositTotal)}</span>
                                                    </div>
                                                    {supplementsTotal > 0 && (
                                                        <div>
                                                            <span>{isEn ? 'Accommodation supplements' : 'Suplementos de alojamento'}</span>
                                                            <span>+{formatMoney(supplementsTotal)}</span>
                                                        </div>
                                                    )}
                                                    {ageDiscountTotal > 0 && (
                                                        <div className="is-discount">
                                                            <span>{isEn ? 'Child/infant discount' : 'Desconto criança/bebé'}</span>
                                                            <span>-{formatMoney(ageDiscountTotal)}</span>
                                                        </div>
                                                    )}
                                                    {memberDiscountTotal > 0 && (
                                                        <div className="is-discount">
                                                            <span>{isEn ? 'Member discount' : 'Desconto de membro'}</span>
                                                            <span>-{formatMoney(memberDiscountTotal)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="reg-receipt-total">
                                                    <span>{isEn ? 'Land-package total' : 'Total terrestre'}{pricedPilgrims.length > 1 && <small>{isEn ? `${pricedPilgrims.length} people · one payment` : `${pricedPilgrims.length} pessoas · um só pagamento`}</small>}</span>
                                                    <strong>{formatMoney(totalBookingAmount)}</strong>
                                                </div>
                                            </div>}

                                            {paymentSection === 0 && <div className="reg-stack" style={{ gap: 12 }}>
                                                <div className="reg-deadline-callout">
                                                    <span className="reg-deadline-icon" aria-hidden="true"><CalendarClock className="h-5 w-5" /></span>
                                                    <span>
                                                        <strong>{isEn ? 'You have 5 days to pay' : 'Tem 5 dias para pagar'}</strong>
                                                        {isEn
                                                            ? <>No need to pay right now: make the first payment by <b>{registrationFeeDueLabel || '5 days from today'}</b>. Your place is secured as soon as we receive it.</>
                                                            : <>Não precisa de pagar já: faça o 1.º pagamento até <b>{registrationFeeDueLabel || 'daqui a 5 dias'}</b>. A vaga fica garantida assim que o recebermos.</>}
                                                    </span>
                                                </div>
                                                <div className="reg-stack" style={{ gap: 10 }} role="radiogroup">
                                                    <label className="reg-choice" style={{ padding: '20px' }}>
                                                        <input type="radio" value="installments" {...methods.register('payment_method')} />
                                                        <span className="reg-choice-mark" aria-hidden="true" />
                                                        <span className="reg-choice-body">
                                                            <span className="reg-choice-title" style={{ display: 'block' }}>{isEn ? 'Pay in monthly instalments' : 'Pagar em prestações mensais'}</span>
                                                            <span className="reg-choice-desc" style={{ display: 'block' }}>{isEn ? <>Registration fee (<strong>{formatMoney(depositTotal)}</strong>) within 5 days, then monthly payments.</> : <>Inscrição (<strong>{formatMoney(depositTotal)}</strong>) até 5 dias, e o restante em mensalidades.</>}</span>
                                                        </span>
                                                    </label>

                                                    <label className="reg-choice" style={{ padding: '20px' }}>
                                                        <input type="radio" value="full" {...methods.register('payment_method')} />
                                                        <span className="reg-choice-mark" aria-hidden="true" />
                                                        <span className="reg-choice-body">
                                                            <span className="reg-choice-title" style={{ display: 'block' }}>{isEn ? 'Pay the full amount' : 'Pagar o valor total'}</span>
                                                            <span className="reg-choice-desc" style={{ display: 'block' }}>{isEn ? <>The full amount (<strong>{formatMoney(totalBookingAmount)}</strong>) in a single payment.</> : <>O valor total (<strong>{formatMoney(totalBookingAmount)}</strong>) num só pagamento.</>}</span>
                                                        </span>
                                                    </label>
                                                </div>

                                                <div className="reg-methods">
                                                    <span>{isEn ? 'Pay with' : 'Pode pagar com'}</span>
                                                    <ul>
                                                        {PAYMENT_METHOD_CHIPS.map(method => (
                                                            <li key={method.label}>
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                {method.icon && <img src={method.icon} alt="" />}
                                                                {isEn ? method.labelEn : method.label}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {watch('payment_method') === 'installments' && (
                                                    <div className="reg-plan reg-step">
                                                        <p className="reg-plan-title">{isEn ? 'How many instalments would you like?' : 'Em quantas prestações quer pagar?'}</p>

                                                        {installmentDeadlineLabel && (
                                                            <div className="reg-deadline">
                                                                <small>{isEn ? 'Final payment deadline' : 'Data limite do pagamento total'}</small>
                                                                <strong>{installmentDeadlineLabel}</strong>
                                                                <span>
                                                                    {isEn
                                                                        ? 'The maximum installment plan ends on this date.'
                                                                        : 'O plano máximo de prestações termina nesta data.'}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {maximumInstallmentCount > 1 ? (
                                                            <div className="reg-counts">
                                                                {[...Array(maximumInstallmentCount)].map((_, i) => {
                                                                    const count = i + 1;
                                                                    const isSelected = (installmentCount || maximumInstallmentCount) === count;
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={() => setInstallmentCount(count)}
                                                                            className={isSelected ? 'is-selected' : ''}
                                                                            aria-pressed={isSelected}
                                                                        >
                                                                            {count}x
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="reg-fine" style={{ margin: '14px 0 16px' }}>
                                                                {installmentDeadlineLabel
                                                                    ? (isEn
                                                                        ? `This option has 1 installment, due by ${installmentDeadlineLabel}.`
                                                                        : `Nesta opção existe 1 prestação, com data limite a ${installmentDeadlineLabel}.`)
                                                                    : (isEn
                                                                        ? 'Due to the proximity of the date, only 1 installment is possible.'
                                                                        : 'Devido à proximidade da data, apenas 1 prestação é possível.')}
                                                            </p>
                                                        )}

                                                        <div className="reg-schedule">
                                                            <div className="is-today">
                                                                <span>{isEn ? 'Registration' : 'Inscrição'} <em className="reg-due-pill">{registrationFeeDueLabel ? (isEn ? `by ${registrationFeeDueLabel}` : `até ${registrationFeeDueLabel}`) : (isEn ? 'within 5 days' : 'até 5 dias')}</em></span>
                                                                <strong>{formatMoney(depositTotal)}</strong>
                                                            </div>
                                                            {calculateInstallments(
                                                                totalBookingAmount - depositTotal,
                                                                pilgrimage.start_date,
                                                                installmentCount || maximumInstallmentCount,
                                                                installmentDeadline,
                                                            ).map((inst, idx) => (
                                                                <div key={idx}>
                                                                    <span>
                                                                        {isEn ? 'Installment' : 'Mensalidade'} {idx + 1} · {inst.date.toLocaleDateString(
                                                                            isEn ? 'en-GB' : 'pt-PT',
                                                                            installmentDeadline
                                                                                ? { day: 'numeric', month: 'long', year: 'numeric' }
                                                                                : { month: 'long', year: 'numeric' },
                                                                        )}
                                                                    </span>
                                                                    <strong>{formatMoney(inst.amount)}</strong>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="reg-fine">
                                                            {isEn
                                                                ? `The remaining ${formatMoney(totalBookingAmount - depositTotal)} is split into ${installmentCount || maximumInstallmentCount} monthly payments. We remind you every month by WhatsApp/email.`
                                                                : `O restante (${formatMoney(totalBookingAmount - depositTotal)}) fica dividido em ${installmentCount || maximumInstallmentCount} mensalidades. Lembramos todos os meses por WhatsApp/email.`
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                            </div>}

                                            {paymentSection === 1 && <div>
                                                <p className="reg-confirm-note"><CalendarClock className="h-4 w-4" aria-hidden="true" /><span>{isEn ? <>After confirming you have <strong>5 days to pay</strong>{registrationFeeDueLabel ? ` (until ${registrationFeeDueLabel})` : ''}.</> : <>Depois de confirmar, tem <strong>5 dias para pagar</strong>{registrationFeeDueLabel ? ` (até ${registrationFeeDueLabel})` : ''}.</>}</span></p>
                                                <label className="reg-terms">
                                                    <input type="checkbox" {...methods.register('terms_accepted')} />
                                                    <span>
                                                        {isEn ? <>I confirm that I have read and accept the <a href={isEn ? '/en/terms#pilgrimages' : '/termos#peregrinacoes'} target="_blank">Terms and Conditions</a> and the pilgrimage cancellation policy.</> : <>Confirmo que li e aceito os <a href="/termos#peregrinacoes" target="_blank">Termos e Condições</a> e a política de cancelamento das peregrinações.</>}
                                                    </span>
                                                </label>
                                                {errors.terms_accepted && <p className="reg-error" role="alert"><AlertCircle className="w-4 h-4" /> {errors.terms_accepted.message}</p>}
                                            </div>}

                                            <div className="reg-actions">
                                                <button type="button" onClick={() => paymentSection === 1 ? setPaymentSection(0) : setStep(hasCountryBasedFlightStep ? 4 : 3)} className="reg-ghost"><ChevronLeft className="w-5 h-5" />{isEn ? 'Back' : 'Voltar'}</button>
                                                {/* Distinct keys: otherwise React reuses this <button> and flips it to
                                                    type="submit" mid-click, which submits the form on arrival. */}
                                                {paymentSection === 0 ? <button key="review" type="button" onClick={() => { setPaymentSection(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="reg-primary">{isEn ? 'Review registration' : 'Rever inscrição'} <ChevronRight className="w-5 h-5" /></button> : <button
                                                    key="confirm"
                                                    type="submit"
                                                    disabled={submitting}
                                                    className="reg-primary"
                                                >
                                                    {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {isEn ? 'Processing registration...' : 'A processar inscrição...'}</> : <><Check className="w-5 h-5" /> {isEn ? 'Confirm registration' : 'Confirmar inscrição'}</>}
                                                </button>}
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </FormProvider>
                        </div>
                    )}
                </section>
            </main>
            <SubmittingOverlay show={submitting} isEn={isEn} />
            <AnimatePresence>
                {toast && (
                    <motion.div
                        className="reg-toast"
                        role="status"
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    >
                        <span className="reg-toast-icon" aria-hidden="true"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
            <ChatWidget
                pilgrimageSlug={slug}
                pilgrimageTitle={pilgrimage?.title}
                pilgrimageId={pilgrimage?.id}
                context="registration-form"
                currentStep={step}
                stepLabels={stepLabels}
            />
        </VIPLayout>
    );
}
