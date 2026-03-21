"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useForm, useFieldArray, FormProvider, useWatch, Controller } from 'react-hook-form';
import Swal from 'sweetalert2';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChevronRight, ChevronLeft, Check, User, Users, Loader2, AlertCircle, MapPin, Globe, Mail } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { handleBookingWithAutoLogin } from '../../../../lib/booking-api';

// Phone Input
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';


import RoomOrganizer, { Room } from '../../../../components/booking/RoomOrganizer';
import VIPLayout from '../../../../components/member/VIPLayout';
import DateInput from '../../../../components/ui/DateInput';

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */
const COUNTRIES = [
    { code: 'PT', name: 'Portugal', postalMask: '0000-000', postalPlaceholder: '1000-001' },
    { code: 'BR', name: 'Brasil', postalMask: '00000-000', postalPlaceholder: '12345-678' },
    { code: 'ES', name: 'Espanha', postalMask: '00000', postalPlaceholder: '28001' },
    { code: 'FR', name: 'França', postalMask: '00000', postalPlaceholder: '75001' },
    { code: 'CH', name: 'Suíça', postalMask: '0000', postalPlaceholder: '8001' },
    { code: 'GB', name: 'Reino Unido', postalMask: '', postalPlaceholder: 'SW1A 1AA' },
    { code: 'US', name: 'Estados Unidos', postalMask: '00000', postalPlaceholder: '90210' },
    { code: 'AO', name: 'Angola', postalMask: '', postalPlaceholder: '' },
    { code: 'MZ', name: 'Moçambique', postalMask: '', postalPlaceholder: '' },
    { code: 'OTHER', name: 'Outro', postalMask: '', postalPlaceholder: '' },
];

/* -------------------------------------------------------------------------- */
/*                                 Validations                                */
/* -------------------------------------------------------------------------- */

// -- Schema Defs --
const pilgrimSchema = z.object({
    full_name: z.string({ required_error: "Nome completo é obrigatório" }).min(3, "Nome completo é obrigatório"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
    birth_date: z.string({ required_error: "Data de nascimento obrigatória" }).min(1, "Data de nascimento obrigatória"),
    sex: z.enum(["M", "F"], { errorMap: () => ({ message: "Seleção do sexo obrigatória" }) }),
    address: z.string({ required_error: "Morada obrigatória" }).min(5, "Morada obrigatória"),
    postal_code: z.string({ required_error: "Código Postal / CEP obrigatório" }).min(4, "Código Postal / CEP obrigatório"),
    city: z.string({ required_error: "Cidade obrigatória" }).min(2, "Cidade obrigatória"),
    country: z.string({ required_error: "País obrigatório" }).min(2, "País obrigatório"),
    cpf_nif: z.string().optional(),
    flight_option: z.enum(["agency", "own", "none"], { errorMap: () => ({ message: "Seleção do voo obrigatória" }) }),
    allergies: z.string().optional(),
    notes: z.string().optional()
});

const bookingSchema = z.object({
    pilgrims: z.array(pilgrimSchema).min(1, "Necessário pelo menos 1 peregrino")
        .superRefine((items, ctx) => {
            const emails = items.map(p => p.email?.toLowerCase().trim()).filter(Boolean);
            const unique = new Set(emails);
            if (unique.size !== emails.length) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Não é permitido usar o mesmo email para múltiplas pessoas. Cada passageiro deve ter um email único para validação.",
                    path: [0, "email"] // Attaches error generally, or handled by form global error
                });
                // Or better, find the duplicate index? For now, global error is safe.
            }
        }),
    payment_method: z.enum(['full', 'installments'], { errorMap: () => ({ message: "Selecione um método de doação" }) }),
    terms_accepted: z.literal(true, { errorMap: () => ({ message: "Tens de aceitar as condições para continuar." }) }),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

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

const getMaxInstallments = (startDate: string) => {
    const start = new Date();
    const end = new Date(startDate);
    end.setMonth(end.getMonth() - 1); // Deadline is 1 month before

    let monthsMax = 0;
    let current = new Date(start);
    current.setMonth(current.getMonth() + 1);
    current.setDate(10);

    while (current < end) {
        monthsMax++;
        current.setMonth(current.getMonth() + 1);
    }
    return monthsMax;
};

// Utility function to round monetary values to 2 decimal places
const roundToTwo = (num: number): number => Math.round(num * 100) / 100;
const formatMoney = (value: number): string => `${roundToTwo(Number(value) || 0).toFixed(2)}€`;

const calculateInstallments = (totalBalance: number, startDate: string, desiredCount?: number) => {
    const installments: { date: Date; amount: number }[] = [];
    if (totalBalance <= 0) return installments;

    const start = new Date();
    const end = new Date(startDate);
    end.setMonth(end.getMonth() - 1); // Deadline is 1 month before

    let current = new Date(start);
    current.setMonth(current.getMonth() + 1);
    current.setDate(10); // Monthly payments on the 10th

    const maxMonths = getMaxInstallments(startDate);
    const actualCount = desiredCount ? Math.min(desiredCount, maxMonths) : maxMonths;

    if (actualCount <= 1) {
        installments.push({ date: end, amount: roundToTwo(totalBalance) });
    } else {
        const perMonth = roundToTwo(totalBalance / actualCount);
        let remaining = roundToTwo(totalBalance);

        for (let i = 0; i < actualCount; i++) {
            const date = new Date(current);
            const amount = i === actualCount - 1 ? roundToTwo(remaining) : perMonth;
            installments.push({ date, amount });
            remaining = roundToTwo(remaining - amount);
            current.setMonth(current.getMonth() + 1);
        }
    }

    return installments;
};

// -- Step 1: Identification Component --
function StepIdentification({ onNext, initialEmail, pilgrimageId }: { onNext: (email: string, phone: string) => void, initialEmail?: string, pilgrimageId?: string }) {
    const router = useRouter();
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

                    const next = typeof window !== 'undefined' ? window.location.pathname : '/peregrinacoes';
                    const decision = await Swal.fire({
                        title: 'Conta já existente',
                        text: 'Este email já está registado. Para continuar a inscrição, faz login na tua conta.',
                        icon: 'info',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: 'Ir para login',
                        denyButtonText: 'Receber link mágico',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#eab308',
                        denyButtonColor: '#475569',
                    });

                    if (decision.isConfirmed) {
                        router.push(`/login?next=${encodeURIComponent(next)}`);
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
                        name: "Peregrino (Rascunho)", // Name might be unknown yet if not separate input, or we can prompt for it. 
                        pilgrimageId,
                        step: 1,
                        data: { email, phone }
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
            Swal.fire('Erro', 'Email inválido para envio do link.', 'error');
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
                    next: '/peregrinacoes/minhas-inscricoes'
                };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Não foi possível enviar o email.');
            }

            Swal.fire({
                title: 'Verifique o Email',
                text: 'Enviámos um link de acesso direto para a sua reserva.',
                icon: 'success',
                confirmButtonColor: '#eab308'
            });
        } catch (err: any) {
            Swal.fire('Erro', err?.message || 'Não foi possível enviar o email.', 'error');
        }
    };

    // Helper to determine which UI to show based on auth state
    const getDuplicateModalConfig = () => {
        const duplicateEmail = duplicateFound?.email || email;
        const maskEmail = (email: string) => email.replace(/(?<=.{2}).(?=.*@)/g, '*');

        if (!user) {
            // Scenario 1: Not authenticated
            return {
                scenario: 1,
                title: 'Reserva Já Existente',
                text: 'Já tens uma reserva confirmada para esta peregrinação. Vamos enviar-te um link de acesso seguro ao teu email.',
                showDirectLink: false,
                showMagicLinkButton: true,
                showLogoutButton: false,
            };
        }

        if (user.email === duplicateEmail) {
            // Scenario 2: Same email - direct access
            return {
                scenario: 2,
                title: 'Reserva Encontrada',
                text: 'Já tens uma reserva confirmada. Clica abaixo para veres os detalhes.',
                showDirectLink: true,
                showMagicLinkButton: false,
                showLogoutButton: false,
            };
        }

        // Scenario 3: Different email - needs logout
        return {
            scenario: 3,
            title: 'Atenção',
            html: `
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
                                O email <strong className="text-white">{email}</strong> já tem uma reserva ativa nesta peregrinação.
                            </p>
                            {config.text && <p className="text-sm text-slate-300">{config.text}</p>}
                        </>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    {/* Scenario 2: Direct link to booking */}
                    {config.showDirectLink && (
                        <button
                            onClick={() => router.push('/peregrinacoes/minhas-inscricoes')}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
                        >
                            Ir Para Minhas Inscrições
                        </button>
                    )}

                    {/* Scenario 1: Magic Link only */}
                    {config.showMagicLinkButton && (
                        <button
                            onClick={handleSendMagicLink}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Mail className="w-5 h-5" />
                            Receber Link de Acesso por Email
                        </button>
                    )}

                    {/* Scenario 3: Logout required */}
                    {config.showLogoutButton && (
                        <>
                            <button
                                onClick={handleLogoutAndRequestLink}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
                            >
                                Terminar Sessão e Pedir Link
                            </button>
                            <p className="text-xs text-slate-500 text-center">
                                Isto irá terminar a tua sessão atual.
                            </p>
                        </>
                    )}
                </div>

                <button
                    onClick={() => setDuplicateFound(null)}
                    className="text-slate-500 text-sm hover:text-white underline"
                >
                    Tentar com outro email
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
                <h2 className="text-3xl font-serif font-bold text-white mb-3">Vamos começar!</h2>
                <p className="text-slate-400 text-lg">Indica os teus contactos.</p>
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
                            placeholder="tu@email.com"
                        />
                    </div>
                    {user && (
                        <div className="mt-2 px-2 flex items-start gap-2 text-sm">
                            <p className="text-slate-400 flex-1">
                                🔒 A reserva será feita com o email da tua conta.{' '}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await signOut();
                                        setEmail('');
                                    }}
                                    className="text-yellow-500 hover:text-yellow-400 underline"
                                >
                                    Não é você? Termine a sessão
                                </button>
                            </p>
                        </div>
                    )}

                </div>
                <div>
                    <label className="text-lg uppercase font-bold text-slate-300 mb-2 block pl-2 tracking-wide">WhatsApp / Telemóvel</label>
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
                    {loading ? <><Loader2 className="w-6 h-6 animate-spin" /> A verificar...</> : <>Continuar <ChevronRight className="w-6 h-6" /></>}
                </button>

                <p className="text-xs text-slate-500 text-center px-4 mt-2">
                    Usamos estes dados para enviar os bilhetes e informações importantes da viagem.
                </p>
            </form>
        </div>
    );
}

// Helper for Pilgrim Card to manage reactivity independently if needed, or straight in map
// We will use standard map but boost Field Labels
const PilgrimCard = ({ index, remove, control, register, errors, memberStatus, isLeader, leaderEmail, allEmails }: any) => {
    // Watch Country for Postal Code Helper
    const country = useWatch({
        control,
        name: `pilgrims.${index}.country`,
        defaultValue: 'Portugal'
    });

    const selectedCountry = COUNTRIES.find(c => c.name === country) || COUNTRIES[0];
    const postalPlaceholder = selectedCountry.postalPlaceholder || '0000-000';

    return (
        <div className="bg-slate-950/50 p-6 md:p-8 rounded-3xl border border-white/5 relative group space-y-6">
            <div className="flex justify-between items-center mb-4">
                <span className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">Pessoa {index + 1}</span>
                {index > 0 && <button type="button" onClick={() => remove(index)} className="text-red-500 text-sm font-bold opacity-70 hover:opacity-100 transition-opacity p-2">Remover</button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal */}
                <div className="md:col-span-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Nome Completo (Conforme Cartão Cidadão)</label>
                    <input
                        {...register(`pilgrims.${index}.full_name`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none focus:ring-0 shadow-inner ${errors.pilgrims?.[index]?.full_name ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                        placeholder="Ex: Maria dos Anjos Silva"
                    />
                    {errors.pilgrims?.[index]?.full_name && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.full_name?.message}</span>}
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">
                        Email {isLeader ? <span className="text-slate-500 text-xs normal-case ml-2">(Obrigatório)</span> : <span className="text-slate-500 text-xs normal-case ml-2">(Opcional - Para desconto Membro)</span>}
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
                                    placeholder="email@exemplo.com"
                                />
                            )}
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />

                        {/* Member Status Badge */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {(() => {
                                const emailValue = useWatch({ control, name: `pilgrims.${index}.email` });
                                if (!emailValue || !emailValue.includes('@')) return null;

                                // Real-time Duplicate Check
                                const emailLower = emailValue.toLowerCase().trim();
                                const isDuplicate = allEmails?.filter((e: string) => e?.toLowerCase().trim() === emailLower).length > 1;

                                if (isDuplicate) {
                                    return (
                                        <div className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/50 text-xs font-bold animate-in slide-in-from-right-2">
                                            <AlertCircle className="w-3 h-3" /> Email em uso
                                        </div>
                                    );
                                }

                                const isMember = memberStatus[emailLower];

                                if (isMember) {
                                    return (
                                        <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/50 text-xs font-bold animate-in zoom-in">
                                            <Check className="w-3 h-3" /> Membro (-50€)
                                        </div>
                                    );
                                } else if (emailValue.length > 5) {
                                    // Non-member upsell
                                    return (
                                        <div className="hidden md:flex items-center gap-2 text-yellow-500/80 text-xs font-bold animate-in fade-in">
                                            💡 Poupava 50€ se fosse membro
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Data Nascimento</label>
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
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Sexo</label>
                    <select
                        {...register(`pilgrims.${index}.sex`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.sex ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                    >
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">NIF / CPF (Opcional)</label>
                    <input {...register(`pilgrims.${index}.cpf_nif`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" />
                </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5">
                <div className="md:col-span-2">
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Morada Completa</label>
                    <input
                        {...register(`pilgrims.${index}.address`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.address ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                        placeholder="Rua..."
                    />
                    {errors.pilgrims?.[index]?.address && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.address?.message}</span>}
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">País</label>
                        <select {...register(`pilgrims.${index}.country`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner">
                            {COUNTRIES.map(c => (
                                <option key={c.code} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Código Postal / CEP</label>
                        <div className="relative">
                            <input
                                {...register(`pilgrims.${index}.postal_code`)}
                                className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.postal_code ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                                placeholder={postalPlaceholder}
                            />
                            {selectedCountry.code === 'PT' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none font-bold opacity-50">ex: 2495-000</span>}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Cidade</label>
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
                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Opção de Aéreo</label>
                    <select
                        {...register(`pilgrims.${index}.flight_option`)}
                        className={`w-full bg-slate-800 border-2 rounded-xl px-6 py-5 text-white text-xl focus:outline-none shadow-inner ${errors.pilgrims?.[index]?.flight_option ? 'border-red-500 error-ring' : 'border-slate-700 focus:border-yellow-500'}`}
                    >
                        <option value="" disabled>Selecione uma opção...</option>
                        <option value="none">1. Não preciso (Vivo na Europa/Outro)</option>
                        <option value="own">2. Eu compro as minhas passagens</option>
                        <option value="agency">3. Quero comprar pela Agência</option>
                    </select>
                    {errors.pilgrims?.[index]?.flight_option && <span className="text-red-500 text-base font-bold mt-2 block flex items-center gap-2 animate-pulse"><AlertCircle className="w-5 h-5" /> {errors.pilgrims[index]?.flight_option?.message}</span>}
                </div>
                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Alergias Alimentares?</label>
                    <input {...register(`pilgrims.${index}.allergies`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" placeholder="Escreve 'Não' ou descreve a alergia..." />
                </div>
                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Notas / Observações</label>
                    <textarea {...register(`pilgrims.${index}.notes`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none h-32 shadow-inner" placeholder="Algo mais que devamos saber?" />
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
    const slug = params.slug as string;

    // State
    const [step, setStep] = useState(1);
    const [pilgrimage, setPilgrimage] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [installmentCount, setInstallmentCount] = useState<number | null>(null);

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
            const { data: pData, error } = await supabaseBrowser.from('pilgrimages').select('*').eq('slug', slug).single();
            if (error || !pData) return;
            setPilgrimage(pData);

            const { data: { user } } = await supabaseBrowser.auth.getUser();
            if (user) {
                setUserEmail(user.email || '');
            }
            setLoading(false);
        };
        init();
    }, [slug]);

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

    // Handlers
    const handleIdentitySubmit = (email: string, phone: string) => {
        setUserEmail(email);
        setUserPhone(phone);
        if (fields.length === 0) {
            append({
                full_name: '', email: email, phone: '', birth_date: '', sex: 'M', // Phone will be overwritten on Submit for leader
                address: '', postal_code: '', city: '', country: 'Portugal',
                flight_option: 'none' as any, allergies: '', notes: '', cpf_nif: '' // Default to something safe or empty string if allowed? Enums need value.
            });
        }
        setStep(2);
        window.scrollTo(0, 0);
    };

    const nextStep = async () => {
        if (step === 2) {
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
                alert("É necessário pelo menos um adulto (maior de 18 anos) responsável pela inscrição.");
                return;
            }
        }
        if (step === 3) {
            const assignedCount = rooms.reduce((acc, r) => acc + r.occupantIndexes.length, 0);
            if (assignedCount < fields.length) {
                Swal.fire({
                    title: 'Quartos por atribuir!',
                    text: 'Por favor, coloca todos os peregrinos num quarto antes de continuar.',
                    icon: 'warning',
                    confirmButtonColor: '#eab308'
                });
                return;
            }
        }
        setStep(s => s + 1);
        window.scrollTo(0, 0);
    };

    const handleValidationErrors = () => {
        // 1. Show Global Alert
        Swal.fire({
            title: 'Faltam dados obrigatórios!',
            text: 'Existem campos por preencher ou incorretos. Por favor verifica os campos assinalados a vermelho.',
            icon: 'error',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Verificar Campos'
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
        setSubmitting(true);
        try {
            const pilgrimsPayload = data.pilgrims.map((p, idx) => {
                const room = rooms.find(r => r.occupantIndexes.includes(idx));
                const finalPhone = (idx === 0) ? userPhone : (p.phone || '');

                // Append Room Details to Notes
                let extraNotes = '';
                if (room) {
                    if (room.bed_type) extraNotes += `\n[Pref. Cama: ${room.bed_type === 'big_bed' ? 'Casal' : 'Twin'}]`;
                    if (room.sharing_mode) extraNotes += `\n[Modo Partilha: ${room.sharing_mode === 'random' ? 'Aleatório' : 'Com Amigo'}]`;
                    if (room.sharing_with_names && room.sharing_with_names.length > 0) {
                        const names = room.sharing_with_names.filter(Boolean).join(', ');
                        if (names) extraNotes += `\n[Com Quem: ${names}]`;
                    }
                }

                return {
                    ...p,
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
                installmentCount || getMaxInstallments(pilgrimage.start_date)
            ) : null;

            console.log("📞 [Frontend] Calling handleBookingWithAutoLogin...");

            const result = await handleBookingWithAutoLogin({
                email: userEmail,
                pilgrimage_id: pilgrimage.id,
                payment_method: data.payment_method,
                installment_count: installmentCount || getMaxInstallments(pilgrimage.start_date),
                payment_plan: paymentPlan ? JSON.stringify(paymentPlan) : undefined,
                pilgrim_data: pilgrimsPayload,
                terms_accepted: data.terms_accepted
            }, setSession);

            console.log("✅ [Frontend] handleBookingWithAutoLogin completed");
            console.log("📦 [Frontend] Result:", result);
            console.log("🔑 [Frontend] View token:", result.view_token);

            // [UX IMPROVEMENT] Show Success Modal before redirecting
            // This prevents "disappearing" feeling
            await Swal.fire({
                title: 'Inscrição Confirmada! 🎉',
                html: `
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
                confirmButtonText: 'Ir para Pagamentos',
                confirmButtonColor: '#eab308',
                timer: 5000,
                timerProgressBar: true,
                allowOutsideClick: false
            });

            // Always go directly to the booking payment page.
            // Keep viewToken to guarantee immediate access even without active session.
            const encodedViewToken = encodeURIComponent(result.view_token || '');
            const redirectUrl = `/peregrinacoes/inscricao/${result.booking_id}?viewToken=${encodedViewToken}&token=${encodedViewToken}${result.new_account ? '&first_time=true' : ''}`;
            console.log("🔄 [Frontend] Redirecting to:", redirectUrl);
            window.location.href = redirectUrl;

        } catch (err: any) {
            console.error("🚨 [Frontend] Booking error:", err);

            // [SENIOR UX] User exists logic
            if (err.message && (err.message.includes('already registered') || err.message.includes('User already registered') || err.code === 'user_already_exists')) {
                setSubmitting(false);

                // 1. Show Friendly Modal
                const { isConfirmed } = await Swal.fire({
                    title: 'Já tem conta ativa!',
                    html: `
                        <p class="mb-4">O email <strong>${userEmail}</strong> já está registado na nossa plataforma.</p>
                        <p class="mb-4 text-sm text-slate-400">Para sua segurança, precisamos que confirme a sua identidade.</p>
                        <p class="font-bold text-yellow-500">Quer receber um link no email para entrar sem password?</p>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonColor: '#eab308',
                    cancelButtonColor: '#334155',
                    confirmButtonText: 'Sim, enviar Link',
                    cancelButtonText: 'Não, vou tentar outra vez'
                });

                // 2. Send Magic Link if requested
                if (isConfirmed) {
                    Swal.fire({
                        title: 'A enviar...',
                        didOpen: () => Swal.showLoading()
                    });

                    try {
                        if (!supabaseBrowser) throw new Error("Cliente Supabase não inicializado");

                        const { error } = await supabaseBrowser.auth.signInWithOtp({
                            email: userEmail,
                            options: {
                                emailRedirectTo: `${window.location.origin}/auth-callback?next=/peregrinacoes/${slug}/inscrever`,
                                // Store current form data in localStorage? For now, let's just get them logged in.
                            }
                        });

                        if (error) throw error;

                        Swal.fire({
                            title: 'Verifique o seu email',
                            text: 'Enviámos um link mágico! Clique nele para entrar e finalizar a inscrição.',
                            icon: 'success',
                            confirmButtonText: 'Entendido'
                        });

                    } catch (magicErr: any) {
                        Swal.fire('Erro', 'Não foi possível enviar o link: ' + magicErr.message, 'error');
                    }
                }
                return;
            }

            console.error("🚨 [Frontend] Error stack:", err.stack);
            alert("Erro: " + err.message);
            setSubmitting(false);
        }
    };


    if (loading || authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-10 h-10" /></div>;
    if (!pilgrimage) return <div className="text-white text-center pt-20">Peregrinação não encontrada.</div>;

    return (
        <VIPLayout allowPublic={true}>
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5 h-20">
                <div className="container mx-auto px-4 h-full flex items-center justify-between">
                    <span className="font-serif font-bold text-white text-lg tracking-wider">APP GAR</span>
                    <button onClick={() => window.history.back()} className="text-slate-400 text-sm font-bold hover:text-white transition-colors">Cancelar</button>
                </div>
            </header>

            <main className="pt-32 pb-20 container mx-auto px-4 max-w-4xl">
                <div className="flex justify-between mb-8 px-4 md:px-12 relative">
                    <div className="absolute top-1/2 left-12 right-12 h-0.5 bg-slate-800 -z-10 -translate-y-1/2" />
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'bg-yellow-500 text-black scale-110 shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-500 border-2 border-slate-700'}`}>
                            {step > s ? <Check className="w-5 h-5" /> : s}
                        </div>
                    ))}
                </div>

                <h1 className="text-center text-3xl md:text-4xl font-serif font-bold text-white mb-2">{pilgrimage.title}</h1>
                <p className="text-center text-slate-400 mb-12">Passo {step}: {step === 1 ? 'Identificação' : step === 2 ? 'Dados das Pessoas' : step === 3 ? 'Alojamento' : 'Doação'}</p>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden min-h-[400px]">
                    {step === 1 && <StepIdentification onNext={handleIdentitySubmit} initialEmail={userEmail} pilgrimageId={pilgrimage.id} />}

                    {step > 1 && (
                        <div id="booking-form-start">
                            <FormProvider {...methods}>
                                <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                    {step === 2 && (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                                <h3 className="text-xl font-bold text-white">Quem vai viajar?</h3>
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
                                                />
                                            ))}
                                            <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-3xl p-6 text-center space-y-4">
                                                <div className="flex justify-center"><AlertCircle className="w-10 h-10 text-yellow-500" /></div>
                                                <div className="space-y-1">
                                                    <h4 className="text-xl font-bold text-white">Adicionar Familiar</h4>
                                                    <p className="text-sm text-yellow-200/80 max-w-lg mx-auto leading-relaxed">
                                                        ATENÇÃO: Só deves adicionar pessoas do teu <span className="font-bold text-yellow-500 uppercase">Agregado Familiar</span> (Pai, Mãe, Filhos) que vivam contigo.
                                                        <br />Para amigos ou conhecidos, cada uno deve fazer a sua própria inscrição separadamente.
                                                    </p>
                                                </div>
                                                <button type="button" onClick={() => append({ full_name: '', email: '', phone: '', birth_date: '', sex: 'M', address: '', postal_code: '', city: '', country: 'Portugal', flight_option: '' as any, allergies: 'Não', notes: '', cpf_nif: '' })} className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/20 active:scale-95">
                                                    Entendido, adicionar familiar
                                                </button>
                                            </div>
                                            <div className="pt-8">
                                                <button
                                                    type="button"
                                                    onClick={nextStep}
                                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-6 rounded-2xl shadow-xl shadow-yellow-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 text-xl uppercase tracking-wider"
                                                >
                                                    Passo Seguinte <ChevronRight className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center pb-4 border-b border-white/5"><h3 className="text-xl font-bold text-white">Distribuição de Quartos</h3></div>
                                            <RoomOrganizer
                                                pilgrims={watch('pilgrims')}
                                                onUpdate={setRooms}
                                                pricing={pilgrimage?.pricing_config?.room_supplements}
                                            />
                                            <div className="flex justify-between pt-8"><button type="button" onClick={() => setStep(2)} className="text-slate-400 font-bold hover:text-white">Voltar</button><button type="button" onClick={nextStep} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">Rever Doação <ChevronRight className="w-5 h-5" /></button></div>
                                        </div>
                                    )}

                                    {step === 4 && (
                                        <div className="space-y-8">
                                            <div className="text-center"><h2 className="text-3xl font-bold text-white mb-2">Quase lá!</h2><p className="text-slate-400">Verifica o resumo final antes de confirmar.</p></div>

                                            <div className="bg-slate-950 p-6 rounded-3xl space-y-4 border border-white/5">
                                                {pricedPilgrims.map(({ pilgrim: f, index: i, price: pPrice }) => {
                                                    return (
                                                        <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                                            <div>
                                                                <p className="font-bold text-white">{f.full_name || 'Pessoa ' + (i + 1)}</p>
                                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                                                    {pPrice.roomType === 'single' ? 'Quarto Individual' :
                                                                        pPrice.roomType === 'double' ? 'Quarto Duplo (Partilhado)' :
                                                                            pPrice.roomType === 'triple' ? 'Quarto Triplo' : 'Quarto Familiar'}
                                                                </p>
                                                                {pPrice.isMember && <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Membro (-50,00€)</p>}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-white font-mono font-bold">{formatMoney(pPrice.finalPrice)}</p>
                                                                {pPrice.isChild && <p className="text-[10px] text-emerald-400 font-bold">Dsc. Criança (20%)</p>}
                                                                {pPrice.isInfant && <p className="text-[10px] text-emerald-400 font-bold">Isenção Bebé</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                <div className="pt-4 space-y-2 border-t border-white/10">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">Donativos Base</span>
                                                        <span className="text-slate-300 font-mono">{formatMoney(baseTotal)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">Taxas de Inscrição</span>
                                                        <span className="text-slate-300 font-mono">{formatMoney(depositTotal)}</span>
                                                    </div>
                                                    {supplementsTotal > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Suplementos de Alojamento</span>
                                                            <span className="text-slate-300 font-mono">+{formatMoney(supplementsTotal)}</span>
                                                        </div>
                                                    )}
                                                    {ageDiscountTotal > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Desconto Criança/Bebé</span>
                                                            <span className="text-emerald-400 font-mono">-{formatMoney(ageDiscountTotal)}</span>
                                                        </div>
                                                    )}
                                                    {memberDiscountTotal > 0 && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Desconto de Membro</span>
                                                            <span className="text-emerald-400 font-mono">-{formatMoney(memberDiscountTotal)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center pt-2">
                                                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Total da Reserva</span>
                                                        <span className="text-3xl font-bold text-white font-mono">{formatMoney(totalBookingAmount)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-sm font-bold text-slate-400 uppercase tracking-tight text-center">Escolhe o método de doação</p>

                                                <div className="grid gap-3">
                                                    <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${watch('payment_method') === 'installments' ? 'bg-yellow-500/10 border-yellow-500 shadow-lg shadow-yellow-500/10' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                                        <input type="radio" value="installments" {...methods.register('payment_method')} className="w-6 h-6 text-yellow-500 accent-yellow-500" />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-white text-lg">Quero fazer doação em várias parcelas mensais</div>
                                                            <div className="text-sm text-slate-400">Doa o sinal agora (<span className="text-white font-bold">{formatMoney(depositTotal)}</span>) e o resto depois.</div>
                                                        </div>
                                                    </label>

                                                    <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${watch('payment_method') === 'full' ? 'bg-yellow-500/10 border-yellow-500 shadow-lg shadow-yellow-500/10' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                                        <input type="radio" value="full" {...methods.register('payment_method')} className="w-6 h-6 text-yellow-500 accent-yellow-500" />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-white text-lg">Quero fazer doação total</div>
                                                            <div className="text-sm text-slate-400">Doa já o valor total (<span className="text-white font-bold">{formatMoney(totalBookingAmount)}</span>).</div>
                                                        </div>
                                                    </label>
                                                </div>

                                                {watch('payment_method') === 'installments' && (
                                                    <div className="mt-4 bg-slate-900/50 rounded-2xl p-6 border-2 border-yellow-500/20 animate-in fade-in slide-in-from-top-2">
                                                        <div className="text-center mb-6">
                                                            <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-2">Plano de Doações Personalizado</p>
                                                            <h4 className="text-white font-bold text-lg">Em quantas prestações quer doar?</h4>
                                                        </div>

                                                        {getMaxInstallments(pilgrimage.start_date) > 1 ? (
                                                            <div className="flex flex-wrap justify-center gap-2 mb-8">
                                                                {[...Array(getMaxInstallments(pilgrimage.start_date))].map((_, i) => {
                                                                    const count = i + 1;
                                                                    const isSelected = (installmentCount || getMaxInstallments(pilgrimage.start_date)) === count;
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
                                                                <p className="text-sm text-slate-400">Devido à proximidade da data, apenas 1 prestação é possível.</p>
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                                                <span className="text-slate-400 italic">Hoje (Inscrição)</span>
                                                                <span className="text-white font-bold">{formatMoney(depositTotal)}</span>
                                                            </div>
                                                            {calculateInstallments(
                                                                totalBookingAmount - depositTotal,
                                                                pilgrimage.start_date,
                                                                installmentCount || getMaxInstallments(pilgrimage.start_date)
                                                            ).map((inst, idx) => (
                                                                <div key={idx} className="flex justify-between text-sm py-2 border-b border-white/5 last:border-0">
                                                                    <span className="text-slate-300">
                                                                        Mensalidade {idx + 1} - {inst.date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                                                                    </span>
                                                                    <span className="text-white font-bold">{formatMoney(inst.amount)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-6 leading-relaxed italic text-center px-4">
                                                            * O valor em falta de {formatMoney(totalBookingAmount - depositTotal)} será dividido em {installmentCount || getMaxInstallments(pilgrimage.start_date)} mensalidades pagas via Transferência Bancária ou MBWAY.
                                                            Enviaremos os lembretes por WhatsApp/Email todos os meses.
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
                                                        Confirmo que li e aceito os <a href="/termos#peregrinacoes" target="_blank" className="underline font-bold text-slate-200">Termos e Condições</a> e a política de cancelamento das peregrinações.
                                                    </span>
                                                </label>
                                                {errors.terms_accepted && <p className="text-red-500 text-xs font-bold animate-bounce tracking-wide">{errors.terms_accepted.message}</p>}
                                            </div>

                                            <div className="flex justify-between items-center pt-4">
                                                <button type="button" onClick={() => setStep(3)} className="text-slate-500 font-bold hover:text-white transition-colors">Voltar</button>
                                                <button
                                                    type="submit"
                                                    disabled={submitting}
                                                    className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-10 py-5 rounded-2xl font-bold transition-all shadow-xl shadow-yellow-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-3 text-lg"
                                                >
                                                    {submitting ? <><Loader2 className="animate-spin" /> A processar inscrição...</> : 'Confirmar Inscrição'}
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
        </VIPLayout>
    );
}
