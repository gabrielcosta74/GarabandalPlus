"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useForm, useFieldArray, FormProvider, useWatch, Controller } from 'react-hook-form';
import Swal from 'sweetalert2';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChevronRight, ChevronLeft, Check, User, Users, Loader2, AlertCircle, MapPin, Globe, Mail } from 'lucide-react';
import Link from 'next/link';
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

// Phone Input
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';


import RoomOrganizer, { Room } from '../../../../components/booking/RoomOrganizer';
import VIPLayout from '../../../../components/member/VIPLayout';
import DateInput from '../../../../components/ui/DateInput';
import ChatWidget from '../../../../components/pilgrimage/ChatWidget';
import PilgrimageFlightStep from '../../../../components/booking/PilgrimageFlightStep';

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */
const getCountries = (isEn: boolean) => [
    { code: 'PT', name: 'Portugal', postalMask: '0000-000', postalPlaceholder: '1000-001' },
    { code: 'BR', name: isEn ? 'Brazil' : 'Brasil', postalMask: '00000-000', postalPlaceholder: '12345-678' },
    { code: 'ES', name: isEn ? 'Spain' : 'Espanha', postalMask: '00000', postalPlaceholder: '28001' },
    { code: 'FR', name: isEn ? 'France' : 'França', postalMask: '00000', postalPlaceholder: '75001' },
    { code: 'CH', name: isEn ? 'Switzerland' : 'Suíça', postalMask: '0000', postalPlaceholder: '8001' },
    { code: 'GB', name: isEn ? 'United Kingdom' : 'Reino Unido', postalMask: '', postalPlaceholder: 'SW1A 1AA' },
    { code: 'US', name: isEn ? 'United States' : 'Estados Unidos', postalMask: '00000', postalPlaceholder: '90210' },
    { code: 'AO', name: 'Angola', postalMask: '', postalPlaceholder: '' },
    { code: 'MZ', name: isEn ? 'Mozambique' : 'Moçambique', postalMask: '', postalPlaceholder: '' },
    { code: 'OTHER', name: isEn ? 'Other' : 'Outro', postalMask: '', postalPlaceholder: '' },
];
const COUNTRIES = getCountries(false);
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
        paymentReq: isEn ? 'Select a donation method' : 'Selecione um método de doação',
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
        allergies: z.string().optional(),
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

// Utility function to round monetary values to 2 decimal places
const roundToTwo = (num: number): number => Math.round(num * 100) / 100;
const formatMoney = (value: number): string => `${roundToTwo(Number(value) || 0).toFixed(2)}€`;

// -- Step 1: Identification Component --
function StepIdentification({
    onNext,
    initialEmail,
    pilgrimageId,
    isPreview = false,
}: {
    onNext: (email: string, phone: string) => void,
    initialEmail?: string,
    pilgrimageId?: string,
    isPreview?: boolean,
}) {
    const router = useRouter();
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const myRegPath = isEn ? '/en/my-registrations' : '/peregrinacoes/minhas-inscricoes';
    const { user, signOut } = useAuth(); // Get current user for conditional UX
    const [email, setEmail] = useState(initialEmail || '');
    const [phone, setPhone] = useState<string | undefined>(''); // PhoneInput uses undefined | string
    const [loading, setLoading] = useState(false);

    // Duplicate State
    const [duplicateFound, setDuplicateFound] = useState<{ exists: boolean, email?: string } | null>(null);


    useEffect(() => {
        if (initialEmail && initialEmail.includes('@') && email !== initialEmail) {
            setEmail(initialEmail);
        }
    }, [initialEmail, email]);

    // If user is logged in, lock email to their account
    useEffect(() => {
        if (user?.email && !initialEmail) {
            setEmail(user.email);
        }
    }, [user, initialEmail]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.includes('@') || !phone || phone.length < 9) return;

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
        if (!user) {
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
                        confirmButtonColor: '#eab308',
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
                    pilgrimageId
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
                confirmButtonColor: '#eab308'
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
            <div className="animate-in fade-in zoom-in duration-300 max-w-md mx-auto text-center space-y-6">
                <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto">
                    <Check className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-serif font-bold text-white">{config.title}</h2>
                    {config.scenario === 3 && config.html ? (
                        <div dangerouslySetInnerHTML={{ __html: config.html }} className="text-slate-300" />
                    ) : (
                        <>
                            <p className="text-slate-400">
                                {isEn ? <>The email <strong className="text-white">{email}</strong> already has an active booking for this pilgrimage.</> : <>O email <strong className="text-white">{email}</strong> já tem uma reserva ativa nesta peregrinação.</>}
                            </p>
                            {config.text && <p className="text-sm text-slate-300">{config.text}</p>}
                        </>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    {/* Scenario 2: Direct link to booking */}
                    {config.showDirectLink && (
                        <button
                            onClick={() => router.push(myRegPath)}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
                        >
                            {isEn ? 'Go To My Registrations' : 'Ir Para Minhas Inscrições'}
                        </button>
                    )}

                    {/* Scenario 1: Magic Link only */}
                    {config.showMagicLinkButton && (
                        <button
                            onClick={handleSendMagicLink}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Mail className="w-5 h-5" />
                            {isEn ? 'Receive Access Link by Email' : 'Receber Link de Acesso por Email'}
                        </button>
                    )}

                    {/* Scenario 3: Logout required */}
                    {config.showLogoutButton && (
                        <>
                            <button
                                onClick={handleLogoutAndRequestLink}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
                            >
                                {isEn ? 'Sign Out and Request Link' : 'Terminar Sessão e Pedir Link'}
                            </button>
                            <p className="text-xs text-slate-500 text-center">
                                {isEn ? 'This will end your current session.' : 'Isto irá terminar a tua sessão atual.'}
                            </p>
                        </>
                    )}
                </div>

                <button
                    onClick={() => setDuplicateFound(null)}
                    className="text-slate-500 text-sm hover:text-white underline"
                >
                    {isEn ? 'Try another email' : 'Tentar com outro email'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto mb-6">
                    <User className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-white mb-3">{isEn ? "Let's get started!" : 'Vamos começar!'}</h2>
                <p className="text-slate-400 text-lg">{isEn ? 'Enter your contact details.' : 'Indica os teus contactos.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="text-lg uppercase font-bold text-slate-300 mb-2 block pl-2 tracking-wide">Email</label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-6 h-6 group-focus-within:text-yellow-500 transition-colors" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={loading || !!user}
                            className="w-full bg-slate-800 border-2 border-slate-700/50 focus:border-yellow-500 rounded-2xl pl-14 pr-6 py-5 text-white placeholder:text-slate-600 focus:outline-none transition-all text-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder={isEn ? 'you@email.com' : 'tu@email.com'}
                        />
                    </div>
                    {user && (
                        <div className="mt-2 px-2 flex items-start gap-2 text-sm">
                            <p className="text-slate-400 flex-1">
                                🔒 {isEn ? 'The booking will be made with your account email.' : 'A reserva será feita com o email da tua conta.'}{' '}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await signOut();
                                        setEmail('');
                                    }}
                                    className="text-yellow-500 hover:text-yellow-400 underline"
                                >
                                    {isEn ? "Not you? Sign out" : 'Não é você? Termine a sessão'}
                                </button>
                            </p>
                        </div>
                    )}

                </div>
                <div>
                    <label className="text-lg uppercase font-bold text-slate-300 mb-2 block pl-2 tracking-wide">{isEn ? 'WhatsApp / Mobile' : 'WhatsApp / Telemóvel'}</label>
                    <div className="relative">
                        {/* Custom CSS wrapper for React Phone Number Input to match theme */}
                        <div className="phone-input-wrapper text-lg">
                            <style jsx global>{`
                                .PhoneInput { display: flex; align-items: center; gap: 12px; }
                                .PhoneInputCountry { background: #1e293b; padding: 12px; border-radius: 12px; border: 2px solid rgba(51,65,85,0.5); }
                                .PhoneInputCountryIcon { width: 30px; height: 20px; }
                                .PhoneInputCountrySelectArrow { color: white; opacity: 0.7; }
                                .PhoneInputInput { 
                                    flex: 1; 
                                    background: #1e293b; 
                                    border: 2px solid rgba(51,65,85,0.5); 
                                    border-radius: 16px; 
                                    padding: 16px 20px; 
                                    font-size: 1.25rem; 
                                    color: white; 
                                    outline: none;
                                }
                                .PhoneInputInput:focus { border-color: #eab308; }
                            `}</style>
                            <PhoneInput
                                placeholder="+55 11 91234-5678"
                                value={phone}
                                onChange={setPhone}
                                defaultCountry="BR"
                                international
                                withCountryCallingCode
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-bold py-5 rounded-2xl shadow-xl shadow-yellow-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                    {loading ? <><Loader2 className="w-6 h-6 animate-spin" /> {isEn ? 'Verifying...' : 'A verificar...'}</> : <>{isEn ? 'Continue' : 'Continuar'} <ChevronRight className="w-6 h-6" /></>}
                </button>

                <p className="text-xs text-slate-500 text-center px-4 mt-2">
                    {isEn ? 'We use this data to send your tickets and important travel information.' : 'Usamos estes dados para enviar os bilhetes e informações importantes da viagem.'}
                </p>
            </form>
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
    errors,
    memberStatus,
    isLeader,
    leaderEmail,
    allEmails,
    isEn,
    countries,
    hideFlightOption = false,
    countryValueMode = 'name',
    flightRegistrationOptions = ['none', 'own', 'agency'],
}: any) => {
    // Watch Country for Postal Code Helper
    const country = useWatch({
        control,
        name: `pilgrims.${index}.country`,
        defaultValue: hideFlightOption ? '' : 'Portugal'
    });
    const emailValue = useWatch({
        control,
        name: `pilgrims.${index}.email`,
        defaultValue: '',
    });

    const countryList = countries || COUNTRIES;
    const selectedCountry = countryList.find((c: any) =>
        countryValueMode === 'code' ? c.code === country : c.name === country
    ) || countryList.find((c: any) => c.code === 'PT') || countryList[0];
    const postalPlaceholder = selectedCountry.postalPlaceholder || '0000-000';

    return (
        <div className="bg-slate-950/50 p-6 md:p-8 rounded-3xl border border-white/5 relative group space-y-6">
            <div className="flex justify-between items-center mb-4">
                <span className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">{isEn ? 'Person' : 'Pessoa'} {index + 1}</span>
                {index > 0 && <button type="button" onClick={() => remove(index)} className="text-red-500 text-sm font-bold opacity-70 hover:opacity-100 transition-opacity p-2">{isEn ? 'Remove' : 'Remover'}</button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal */}
                <div className="md:col-span-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Full Name (as on ID document)' : 'Nome Completo (Conforme Cartão Cidadão)'}</label>
                    <input
                        {...register(`pilgrims.${index}.full_name`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none focus:ring-0 shadow-inner ${errors.pilgrims?.[index]?.full_name ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                        placeholder={isEn ? 'e.g. Mary Smith' : 'Ex: Maria dos Anjos Silva'}
                    />
                    {errors.pilgrims?.[index]?.full_name && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.full_name?.message}</span>}
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">
                        Email {isLeader ? <span className="text-slate-500 text-xs normal-case ml-2">{isEn ? '(Required)' : '(Obrigatório)'}</span> : <span className="text-slate-500 text-xs normal-case ml-2">{isEn ? '(Optional - For Member discount)' : '(Opcional - Para desconto Membro)'}</span>}
                    </label>
                    <div className="relative">
                        <Controller
                            control={control}
                            name={`pilgrims.${index}.email`}
                            render={({ field }) => (
                                <input
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value)}
                                    type="email"
                                    readOnly={isLeader}
                                    className={`w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 pl-12 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner ${isLeader ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder={isEn ? 'email@example.com' : 'email@exemplo.com'}
                                />
                            )}
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />

                        {/* Member Status Badge */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {(() => {
                                if (!emailValue || !emailValue.includes('@')) return null;

                                // Real-time Duplicate Check
                                const emailLower = emailValue.toLowerCase().trim();
                                const isDuplicate = allEmails?.filter((e: string) => e?.toLowerCase().trim() === emailLower).length > 1;

                                if (isDuplicate) {
                                    return (
                                        <div className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/50 text-xs font-bold animate-in slide-in-from-right-2">
                                            <AlertCircle className="w-3 h-3" /> {isEn ? 'Email in use' : 'Email em uso'}
                                        </div>
                                    );
                                }

                                const isMember = memberStatus[emailLower];

                                if (isMember) {
                                    return (
                                        <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/50 text-xs font-bold animate-in zoom-in">
                                            <Check className="w-3 h-3" /> {isEn ? 'Member (-€50)' : 'Membro (-50€)'}
                                        </div>
                                    );
                                } else if (emailValue.length > 5) {
                                    // Non-member upsell
                                    return (
                                        <div className="hidden md:flex items-center gap-2 text-yellow-500/80 text-xs font-bold animate-in fade-in">
                                            💡 {isEn ? 'You would save €50 as a member' : 'Poupava 50€ se fosse membro'}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Birth Date' : 'Data Nascimento'}</label>
                    <Controller
                        control={control}
                        name={`pilgrims.${index}.birth_date`}
                        render={({ field: { onChange, value }, fieldState: { error } }) => (
                            <DateInput
                                value={value}
                                onChange={onChange}
                                error={error?.message}
                            />
                        )}
                    />
                </div>

                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Sex' : 'Sexo'}</label>
                    <select
                        {...register(`pilgrims.${index}.sex`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.sex ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                    >
                        <option value="M">{isEn ? 'Male' : 'Masculino'}</option>
                        <option value="F">{isEn ? 'Female' : 'Feminino'}</option>
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Tax ID / NIF / CPF (Optional)' : 'NIF / CPF (Opcional)'}</label>
                    <input {...register(`pilgrims.${index}.cpf_nif`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" />
                </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5">
                <div className="md:col-span-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Full Address' : 'Morada Completa'}</label>
                    <input
                        {...register(`pilgrims.${index}.address`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.address ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                        placeholder={isEn ? 'Street...' : 'Rua...'}
                    />
                    {errors.pilgrims?.[index]?.address && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.address?.message}</span>}
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Country of residence' : 'País de residência'}</label>
                        <select
                            {...register(`pilgrims.${index}.country`)}
                            className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${
                                errors.pilgrims?.[index]?.country
                                    ? 'border-red-500 error-ring'
                                    : 'border-slate-700 focus:border-yellow-500'
                            }`}
                        >
                            {hideFlightOption && <option value="">{isEn ? 'Select your country...' : 'Escolha o seu país...'}</option>}
                            {countryList.map((c: any) => (
                                <option key={c.code} value={countryValueMode === 'code' ? c.code : c.name}>{c.name}</option>
                            ))}
                        </select>
                        {errors.pilgrims?.[index]?.country && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.country?.message}</span>}
                    </div>
                    <div>
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Postal Code / ZIP' : 'Código Postal / CEP'}</label>
                        <div className="relative">
                            <input
                                {...register(`pilgrims.${index}.postal_code`)}
                                className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.postal_code ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                                placeholder={postalPlaceholder}
                            />
                            {selectedCountry.code === 'PT' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none font-bold opacity-50">{isEn ? 'e.g. 2495-000' : 'ex: 2495-000'}</span>}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'City' : 'Cidade'}</label>
                        <input
                            {...register(`pilgrims.${index}.city`)}
                            className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.city ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                        />
                        {errors.pilgrims?.[index]?.city && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.city?.message}</span>}
                    </div>
                </div>
            </div>

            {/* Flight & Extras */}
            <div className="grid grid-cols-1 gap-8 pt-6 border-t border-white/5">
                {!hideFlightOption && (
                    <div>
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Flight Option' : 'Opção de Aéreo'}</label>
                        <select
                            {...register(`pilgrims.${index}.flight_option`)}
                            className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.flight_option ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                        >
                            <option value="" disabled>{isEn ? 'Select an option...' : 'Selecione uma opção...'}</option>
                            {(flightRegistrationOptions as FlightRegistrationOption[]).map((option, optionIndex) => {
                                const selectableFlightOnly = flightRegistrationOptions.length === 2
                                    && !flightRegistrationOptions.includes('none');
                                const labels = selectableFlightOnly
                                    ? {
                                        own: isEn ? 'Own flight — I will buy my own tickets' : 'Voo próprio — Eu compro as minhas passagens',
                                        agency: isEn ? 'Group flight — I want to buy through the Agency' : 'Voo de grupo — Quero comprar pela Agência',
                                        none: isEn ? "I don't need it (I live in Europe/Other)" : 'Não preciso (Vivo na Europa/Outro)',
                                    }
                                    : {
                                        none: isEn ? "I don't need it (I live in Europe/Other)" : 'Não preciso (Vivo na Europa/Outro)',
                                        own: isEn ? 'I will buy my own tickets' : 'Eu compro as minhas passagens',
                                        agency: isEn ? 'I want to buy through the Agency' : 'Quero comprar pela Agência',
                                    };

                                return (
                                    <option key={option} value={option}>
                                        {optionIndex + 1}. {labels[option]}
                                    </option>
                                );
                            })}
                        </select>
                        {errors.pilgrims?.[index]?.flight_option && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.flight_option?.message}</span>}
                    </div>
                )}
                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Food Allergies?' : 'Alergias Alimentares?'}</label>
                    <input {...register(`pilgrims.${index}.allergies`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" placeholder={isEn ? "Write 'No' or describe the allergy..." : "Escreve 'Não' ou descreve a alergia..."} />
                </div>
                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">{isEn ? 'Notes / Observations' : 'Notas / Observações'}</label>
                    <textarea {...register(`pilgrims.${index}.notes`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none h-32 shadow-inner" placeholder={isEn ? 'Anything else we should know?' : 'Algo mais que devamos saber?'} />
                </div>
            </div>
        </div>
    );
};

// -- Main Page Component (Reconstruction) --
// ... (Previous logic remains, but PilgrimCard map is replaced)


// -- Main Page Component --
export default function PilgrimageBookingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const draftId = searchParams.get('draftId');
    const isLocalDraftPreview = process.env.NODE_ENV === 'development' && Boolean(draftId);
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const listPath = isEn ? '/en/pilgrimages' : '/peregrinacoes';
    const myRegPath = isEn ? '/en/my-registrations' : '/peregrinacoes/minhas-inscricoes';
    const bookingSchema = useMemo(() => createBookingSchema(isEn), [isEn]);

    // State
    const [step, setStep] = useState(1);
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
    const countriesList = useMemo(() => {
        if (!hasCountryBasedFlightStep) return getCountries(isEn);
        return listCountryOptions(isEn ? 'en' : 'pt-PT').map(option => ({
            code: option.code,
            name: option.label,
            postalPlaceholder: resolveCountryMeta(option.code)?.postalPlaceholder || '',
        }));
    }, [hasCountryBasedFlightStep, isEn]);

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
                address: '', postal_code: '', city: '', country: hasCountryBasedFlightStep ? '' : 'Portugal',
                flight_option: (hasCountryBasedFlightStep || requiresExplicitFlightChoice ? '' : 'none') as any,
                allergies: '', notes: '', cpf_nif: ''
            });
        }
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
                    confirmButtonColor: '#eab308'
                });
                return;
            }
        }
        setStep(s => s + 1);
        window.scrollTo(0, 0);
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
                confirmButtonColor: '#eab308',
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
            console.log("📦 [Frontend] Result:", result);
            console.log("🔑 [Frontend] View token:", result.view_token);

            // [UX IMPROVEMENT] Show Success Modal before redirecting
            // This prevents "disappearing" feeling
            await Swal.fire({
                title: isEn ? 'Registration Confirmed! 🎉' : 'Inscrição Confirmada! 🎉',
                html: isEn ? `
                    <div class="space-y-4 text-left">
                        <p>Your booking was successfully registered.</p>
                        <div class="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                            <p class="font-bold text-yellow-600 mb-1">What happens next?</p>
                            <ul class="list-disc list-inside text-sm text-slate-600 space-y-1">
                                <li>You will choose the payment method on the next page.</li>
                                <li>If you choose bank transfer, the proof of payment is mandatory to enter validation.</li>
                                <li>You will be redirected to the payments page.</li>
                            </ul>
                        </div>
                    </div>
                ` : `
                    <div class="space-y-4 text-left">
                        <p>A sua reserva foi registada com sucesso.</p>
                        <div class="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                            <p class="font-bold text-yellow-600 mb-1">O que acontece agora?</p>
                            <ul class="list-disc list-inside text-sm text-slate-600 space-y-1">
                                <li>Vai poder escolher o meio de pagamento na página seguinte.</li>
                                <li>Se optar por transferência bancária, o comprovativo é obrigatório para entrar em validação.</li>
                                <li>Vai ser redirecionado para a página de pagamentos.</li>
                            </ul>
                        </div>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: isEn ? 'Go to Payments' : 'Ir para Pagamentos',
                confirmButtonColor: '#eab308',
                timer: 5000,
                timerProgressBar: true,
                allowOutsideClick: false
            });

            // Always go directly to the booking payment page.
            // Keep viewToken to guarantee immediate access even without active session.
            const encodedViewToken = encodeURIComponent(result.view_token || '');
            const inscricaoBase = isEn ? '/en/pilgrimages/registration' : '/peregrinacoes/inscricao';
            const redirectUrl = `${inscricaoBase}/${result.booking_id}?viewToken=${encodedViewToken}&token=${encodedViewToken}${result.new_account ? '&first_time=true' : ''}`;
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
                    confirmButtonColor: '#eab308',
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


    if (loading || authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-10 h-10" /></div>;
    if (!pilgrimage) return <div className="text-white text-center pt-20">{isEn ? 'Pilgrimage not found.' : 'Peregrinação não encontrada.'}</div>;

    const stepLabels = hasCountryBasedFlightStep
        ? (isEn
            ? ['Identification', 'People details', 'Accommodation', 'Flights', 'Donation']
            : ['Identificação', 'Dados das pessoas', 'Alojamento', 'Voos', 'Doação'])
        : (isEn
            ? ['Identification', 'People details', 'Accommodation', 'Donation']
            : ['Identificação', 'Dados das pessoas', 'Alojamento', 'Doação']);

    return (
        <VIPLayout allowPublic={true}>
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5 h-20">
                <div className="container mx-auto px-4 h-full flex items-center justify-between">
                    <span className="font-serif font-bold text-white text-lg tracking-wider">APP GAR</span>
                    <button onClick={() => window.history.back()} className="text-slate-400 text-sm font-bold hover:text-white transition-colors">{isEn ? 'Cancel' : 'Cancelar'}</button>
                </div>
            </header>

            <main className="pt-32 pb-20 container mx-auto px-4 max-w-4xl">
                {isLocalDraftPreview && (
                    <div className="mb-6 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4 text-center">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                            {isEn ? 'Private local draft preview' : 'Pré-visualização local privada do draft'}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-amber-100">
                            {isEn
                                ? 'Nothing submitted here is saved. This preview is unavailable in production.'
                                : 'Nada do que submeter aqui será gravado. Esta pré-visualização não existe em produção.'}
                        </p>
                    </div>
                )}
                <div className="flex justify-between mb-8 px-4 md:px-12 relative">
                    <div className="absolute top-1/2 left-12 right-12 h-0.5 bg-slate-800 -z-10 -translate-y-1/2" />
                    {stepLabels.map((_, index) => {
                        const s = index + 1;
                        return (
                        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'bg-yellow-500 text-black scale-110 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-500 border-2 border-slate-700'}`}>
                            {step > s ? <Check className="w-5 h-5" /> : s}
                        </div>
                        );
                    })}
                </div>

                <h1 className="text-center text-3xl md:text-4xl font-serif font-bold text-white mb-2">{(isEn && pilgrimage.title_en) ? pilgrimage.title_en : pilgrimage.title}</h1>
                <p className="text-center text-slate-400 mb-12">
                    {isEn ? 'Step' : 'Passo'} {step}: {stepLabels[step - 1]}
                </p>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden min-h-[400px]">
                    {step === 1 && (
                        <StepIdentification
                            onNext={handleIdentitySubmit}
                            initialEmail={userEmail}
                            pilgrimageId={pilgrimage.id}
                            isPreview={isLocalDraftPreview}
                        />
                    )}

                    {step > 1 && (
                        <div id="booking-form-start">
                            <FormProvider {...methods}>
                                <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                    {step === 2 && (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                                <h3 className="text-xl font-bold text-white">{isEn ? 'Who is traveling?' : 'Quem vai viajar?'}</h3>
                                            </div>
                                            {fields.map((field, idx) => (
                                                <PilgrimCard
                                                    key={field.id}
                                                    index={idx}
                                                    remove={remove}
                                                    control={methods.control}
                                                    register={methods.register}
                                                    errors={errors}
                                                    memberStatus={memberStatus} // Pass verification map
                                                    isLeader={idx === 0}
                                                    leaderEmail={userEmail}
                                                    allEmails={currentPilgrims.map(p => p.email)}
                                                    isEn={isEn}
                                                    countries={countriesList}
                                                    hideFlightOption={hasCountryBasedFlightStep}
                                                    countryValueMode={hasCountryBasedFlightStep ? 'code' : 'name'}
                                                    flightRegistrationOptions={flightRegistrationOptions}
                                                />
                                            ))}
                                            <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-3xl p-6 text-center space-y-4">
                                                <div className="flex justify-center"><AlertCircle className="w-10 h-10 text-yellow-500" /></div>
                                                <div className="space-y-1">
                                                    <h4 className="text-xl font-bold text-white">{isEn ? 'Add Family Member' : 'Adicionar Familiar'}</h4>
                                                    <p className="text-sm text-yellow-200/80 max-w-lg mx-auto leading-relaxed">
                                                        {isEn ? <>ATTENTION: You should only add members of your <span className="font-bold text-yellow-500 uppercase">Household</span> (Father, Mother, Children) who live with you.<br />For friends or acquaintances, each one must make their own separate registration.</> : <>ATENÇÃO: Só deves adicionar pessoas do teu <span className="font-bold text-yellow-500 uppercase">Agregado Familiar</span> (Pai, Mãe, Filhos) que vivam contigo.<br />Para amigos ou conhecidos, cada uno deve fazer a sua própria inscrição separadamente.</>}
                                                    </p>
                                                </div>
                                                <button type="button" onClick={() => append({ full_name: '', email: '', phone: '', birth_date: '', sex: 'M', address: '', postal_code: '', city: '', country: hasCountryBasedFlightStep ? '' : 'Portugal', flight_option: (hasCountryBasedFlightStep || requiresExplicitFlightChoice ? '' : 'none') as any, allergies: isEn ? 'No' : 'Não', notes: '', cpf_nif: '' })} className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/20 active:scale-95">
                                                    {isEn ? 'Understood, add family member' : 'Entendido, adicionar familiar'}
                                                </button>
                                            </div>
                                            <div className="pt-8">
                                                <button
                                                    type="button"
                                                    onClick={nextStep}
                                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-6 rounded-2xl shadow-xl shadow-yellow-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 text-xl uppercase tracking-wider"
                                                >
                                                    {isEn ? 'Next Step' : 'Passo Seguinte'} <ChevronRight className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center pb-4 border-b border-white/5"><h3 className="text-xl font-bold text-white">{isEn ? 'Room Distribution' : 'Distribuição de Quartos'}</h3></div>
                                            <RoomOrganizer
                                                pilgrims={watch('pilgrims')}
                                                onUpdate={setRooms}
                                                pricing={pilgrimage?.pricing_config?.room_supplements}
                                            />
                                            <div className="flex justify-between pt-8"><button type="button" onClick={() => setStep(2)} className="text-slate-400 font-bold hover:text-white">{isEn ? 'Back' : 'Voltar'}</button><button type="button" onClick={nextStep} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">{hasCountryBasedFlightStep ? (isEn ? 'Flight information' : 'Informação dos voos') : (isEn ? 'Review Donation' : 'Rever Doação')} <ChevronRight className="w-5 h-5" /></button></div>
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
                                        <div className="space-y-8">
                                            <div className="text-center"><h2 className="text-3xl font-bold text-white mb-2">{isEn ? 'Almost there!' : 'Quase lá!'}</h2><p className="text-slate-400">{isEn ? 'Check the final summary before confirming.' : 'Verifica o resumo final antes de confirmar.'}</p></div>

                                            <div className="bg-slate-950 p-6 rounded-3xl space-y-4 border border-white/5">
                                                {pricedPilgrims.map(({ pilgrim: f, index: i, price: pPrice }) => {
                                                    return (
                                                        <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                                            <div>
                                                                <p className="font-bold text-white">{f.full_name || (isEn ? 'Person ' : 'Pessoa ') + (i + 1)}</p>
                                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                                                    {isEn ? (pPrice.roomType === 'single' ? 'Single Room' : pPrice.roomType === 'double' ? 'Double Room (Shared)' : pPrice.roomType === 'triple' ? 'Triple Room' : 'Family Room') : (pPrice.roomType === 'single' ? 'Quarto Individual' : pPrice.roomType === 'double' ? 'Quarto Duplo (Partilhado)' : pPrice.roomType === 'triple' ? 'Quarto Triplo' : 'Quarto Familiar')}
                                                                </p>
                                                                {pPrice.isMember && <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> {isEn ? 'Member (-€50.00)' : 'Membro (-50,00€)'}</p>}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-white font-mono font-bold">{formatMoney(pPrice.finalPrice)}</p>
                                                                {pPrice.isChild && <p className="text-[10px] text-emerald-400 font-bold">{isEn ? 'Child Disc. (20%)' : 'Dsc. Criança (20%)'}</p>}
                                                                {pPrice.isInfant && <p className="text-[10px] text-emerald-400 font-bold">{isEn ? 'Infant Exemption' : 'Isenção Bebé'}</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                <div className="pt-4 space-y-2 border-t border-white/10">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">{isEn ? 'Base Donations' : 'Donativos Base'}</span>
                                                        <span className="text-slate-300 font-mono">{formatMoney(baseTotal)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">{isEn ? 'Registration Fees' : 'Taxas de Inscrição'}</span>
                                                        <span className="text-slate-300 font-mono">{formatMoney(depositTotal)}</span>
                                                    </div>
                                                    {supplementsTotal > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">{isEn ? 'Accommodation Supplements' : 'Suplementos de Alojamento'}</span>
                                                            <span className="text-slate-300 font-mono">+{formatMoney(supplementsTotal)}</span>
                                                        </div>
                                                    )}
                                                    {ageDiscountTotal > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">{isEn ? 'Child/Infant Discount' : 'Desconto Criança/Bebé'}</span>
                                                            <span className="text-emerald-400 font-mono">-{formatMoney(ageDiscountTotal)}</span>
                                                        </div>
                                                    )}
                                                    {memberDiscountTotal > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">{isEn ? 'Member Discount' : 'Desconto de Membro'}</span>
                                                            <span className="text-emerald-400 font-mono">-{formatMoney(memberDiscountTotal)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center pt-2">
                                                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">{isEn ? 'Land-package total' : 'Total terrestre'}</span>
                                                        <span className="text-3xl font-bold text-white font-mono">{formatMoney(totalBookingAmount)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-sm font-bold text-slate-400 uppercase tracking-tight text-center">{isEn ? 'Choose your donation method' : 'Escolhe o método de doação'}</p>

                                                <div className="grid gap-3">
                                                    <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${watch('payment_method') === 'installments' ? 'bg-yellow-500/10 border-yellow-500 shadow-lg shadow-yellow-500/10' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                                        <input type="radio" value="installments" {...methods.register('payment_method')} className="w-6 h-6 text-yellow-500 accent-yellow-500" />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-white text-lg">{isEn ? 'I want to donate in several monthly installments' : 'Quero fazer doação em várias parcelas mensais'}</div>
                                                            <div className="text-sm text-slate-400">{isEn ? <>Donate the deposit now (<span className="text-white font-bold">{formatMoney(depositTotal)}</span>) and the rest later.</> : <>Doa o sinal agora (<span className="text-white font-bold">{formatMoney(depositTotal)}</span>) e o resto depois.</>}</div>
                                                        </div>
                                                    </label>

                                                    <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${watch('payment_method') === 'full' ? 'bg-yellow-500/10 border-yellow-500 shadow-lg shadow-yellow-500/10' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                                        <input type="radio" value="full" {...methods.register('payment_method')} className="w-6 h-6 text-yellow-500 accent-yellow-500" />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-white text-lg">{isEn ? 'I want to donate the full amount' : 'Quero fazer doação total'}</div>
                                                            <div className="text-sm text-slate-400">{isEn ? <>Donate the full amount now (<span className="text-white font-bold">{formatMoney(totalBookingAmount)}</span>).</> : <>Doa já o valor total (<span className="text-white font-bold">{formatMoney(totalBookingAmount)}</span>).</>}</div>
                                                        </div>
                                                    </label>
                                                </div>

                                                {watch('payment_method') === 'installments' && (
                                                    <div className="mt-4 bg-slate-900/50 rounded-2xl p-6 border-2 border-yellow-500/20 animate-in fade-in slide-in-from-top-2">
                                                        <div className="text-center mb-6">
                                                            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-2">{isEn ? 'Custom Donation Plan' : 'Plano de Doações Personalizado'}</p>
                                                            <h4 className="text-white font-bold text-lg">{isEn ? 'In how many installments would you like to donate?' : 'Em quantas prestações quer doar?'}</h4>
                                                        </div>

                                                        {installmentDeadlineLabel && (
                                                            <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
                                                                <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                                                                    {isEn ? 'Final payment deadline' : 'Data limite do pagamento total'}
                                                                </p>
                                                                <p className="mt-1 text-lg font-black text-white">
                                                                    {installmentDeadlineLabel}
                                                                </p>
                                                                <p className="mt-1 text-xs font-semibold text-amber-100">
                                                                    {isEn
                                                                        ? 'The maximum installment plan ends on this date.'
                                                                        : 'O plano máximo de prestações termina nesta data.'}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {maximumInstallmentCount > 1 ? (
                                                            <div className="flex flex-wrap justify-center gap-2 mb-8">
                                                                {[...Array(maximumInstallmentCount)].map((_, i) => {
                                                                    const count = i + 1;
                                                                    const isSelected = (installmentCount || maximumInstallmentCount) === count;
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={() => setInstallmentCount(count)}
                                                                            className={`px-6 py-3 rounded-xl font-bold transition-all border-2 ${isSelected ? 'bg-yellow-500 border-yellow-500 text-slate-900 scale-110 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                                                                        >
                                                                            {count}x
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center mb-6 py-4 bg-slate-800/50 rounded-xl border border-white/5">
                                                                <p className="text-sm text-slate-400">
                                                                    {installmentDeadlineLabel
                                                                        ? (isEn
                                                                            ? `This option has 1 installment, due by ${installmentDeadlineLabel}.`
                                                                            : `Nesta opção existe 1 prestação, com data limite a ${installmentDeadlineLabel}.`)
                                                                        : (isEn
                                                                            ? 'Due to the proximity of the date, only 1 installment is possible.'
                                                                            : 'Devido à proximidade da data, apenas 1 prestação é possível.')}
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                                                <span className="text-slate-400 italic">{isEn ? 'Today (Registration)' : 'Hoje (Inscrição)'}</span>
                                                                <span className="text-white font-bold">{formatMoney(depositTotal)}</span>
                                                            </div>
                                                            {calculateInstallments(
                                                                totalBookingAmount - depositTotal,
                                                                pilgrimage.start_date,
                                                                installmentCount || maximumInstallmentCount,
                                                                installmentDeadline,
                                                            ).map((inst, idx) => (
                                                                <div key={idx} className="flex justify-between text-sm py-2 border-b border-white/5 last:border-0">
                                                                    <span className="text-slate-300">
                                                                        {isEn ? 'Installment' : 'Mensalidade'} {idx + 1} - {inst.date.toLocaleDateString(
                                                                            isEn ? 'en-GB' : 'pt-PT',
                                                                            installmentDeadline
                                                                                ? { day: 'numeric', month: 'long', year: 'numeric' }
                                                                                : { month: 'long', year: 'numeric' },
                                                                        )}
                                                                    </span>
                                                                    <span className="text-white font-bold">{formatMoney(inst.amount)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-6 leading-relaxed italic text-center px-4">
                                                            {isEn
                                                                ? `* The remaining amount of ${formatMoney(totalBookingAmount - depositTotal)} will be divided into ${installmentCount || maximumInstallmentCount} installments paid by Bank Transfer or MBWAY. We will send reminders via WhatsApp/Email every month.`
                                                                : `* O valor em falta de ${formatMoney(totalBookingAmount - depositTotal)} será dividido em ${installmentCount || maximumInstallmentCount} mensalidades pagas via Transferência Bancária ou MBWAY. Enviaremos os lembretes por WhatsApp/Email todos os meses.`
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-center gap-4 p-4">
                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <div className="mt-1">
                                                        <input type="checkbox" {...methods.register('terms_accepted')} className="w-5 h-5 text-yellow-500 rounded border-slate-700 bg-slate-800 focus:ring-yellow-500" />
                                                    </div>
                                                    <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                                                        {isEn ? <>I confirm that I have read and accept the <a href={isEn ? '/en/terms#pilgrimages' : '/termos#peregrinacoes'} target="_blank" className="underline font-bold text-slate-200">Terms and Conditions</a> and the pilgrimage cancellation policy.</> : <>Confirmo que li e aceito os <a href="/termos#peregrinacoes" target="_blank" className="underline font-bold text-slate-200">Termos e Condições</a> e a política de cancelamento das peregrinações.</>}
                                                    </span>
                                                </label>
                                                {errors.terms_accepted && <p className="text-red-500 text-xs font-bold animate-bounce tracking-wide">{errors.terms_accepted.message}</p>}
                                            </div>

                                            <div className="flex justify-between items-center pt-4">
                                                <button type="button" onClick={() => setStep(hasCountryBasedFlightStep ? 4 : 3)} className="text-slate-500 font-bold hover:text-white transition-colors">{isEn ? 'Back' : 'Voltar'}</button>
                                                <button
                                                    type="submit"
                                                    disabled={submitting}
                                                    className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-10 py-5 rounded-2xl font-bold transition-all shadow-xl shadow-yellow-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-3 text-lg"
                                                >
                                                    {submitting ? <><Loader2 className="animate-spin" /> {isEn ? 'Processing registration...' : 'A processar inscrição...'}</> : (isEn ? 'Confirm Registration' : 'Confirmar Inscrição')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </FormProvider>
                        </div>
                    )}
                </div>
            </main>
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
