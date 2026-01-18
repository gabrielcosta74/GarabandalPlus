"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useForm, useFieldArray, FormProvider, useWatch } from 'react-hook-form'; // Added useWatch
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChevronRight, ChevronLeft, Check, User, Users, Loader2, AlertCircle, MapPin, Globe, Mail } from 'lucide-react';
import Link from 'next/link';

// Phone Input
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';


import RoomOrganizer, { Room } from '../../../../components/booking/RoomOrganizer';
import VIPLayout from '../../../../components/member/VIPLayout';

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
    full_name: z.string().min(3, "Nome completo é obrigatório"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
    birth_date: z.string().min(1, "Data de nascimento obrigatória"),
    sex: z.enum(["M", "F"]),
    address: z.string().min(5, "Morada obrigatória"),
    postal_code: z.string().min(4, "Código Postal obrigatório"),
    city: z.string().min(2, "Cidade obrigatória"),
    country: z.string().min(2, "País obrigatório"),
    cpf_nif: z.string().optional(),
    flight_option: z.enum(["agency", "own", "none"], { required_error: "Seleção do voo obrigatória" }),
    allergies: z.string().optional(),
    notes: z.string().optional()
});

const bookingSchema = z.object({
    pilgrims: z.array(pilgrimSchema).min(1, "Necessário pelo menos 1 peregrino"),
    payment_method: z.enum(['full', 'installments']),
    terms_accepted: z.literal(true, { errorMap: () => ({ message: "Tens de aceitar as condições para continuar." }) }),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const calculatePilgrimPrice = (pilgrim: any, pilgrimage: any, rooms: Room[], pilgrimIndex: number) => {
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
    const isChild = age <= 10 && age >= 2;
    const isInfant = age < 2;

    // --- V2 PRICING ENGINE ---
    let subtotal = 0;
    const config = pilgrimage?.pricing_config || {};
    const basePrice = Number(pilgrimage?.base_price) || 0;

    if (config[roomType] && Number(config[roomType]) > 0) {
        subtotal = Number(config[roomType]);
    } else {
        subtotal = basePrice;
        if (roomType === 'single') subtotal += 250;
    }

    let discount = 0;
    if (isChild) discount = subtotal * 0.50;
    if (isInfant) discount = subtotal;

    const finalPrice = Math.max(0, subtotal - discount);

    return { finalPrice, subtotal, discount, isChild, isInfant, age, roomType };
};

// -- Step 1: Identification Component --
function StepIdentification({ onNext, initialEmail, pilgrimageId }: { onNext: (email: string, phone: string) => void, initialEmail?: string, pilgrimageId?: string }) {
    const [email, setEmail] = useState(initialEmail || '');
    const [phone, setPhone] = useState<string | undefined>(''); // PhoneInput uses undefined | string
    const [loading, setLoading] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);

    useEffect(() => {
        if (initialEmail && initialEmail.includes('@') && email !== initialEmail) {
            setEmail(initialEmail);
        }
    }, [initialEmail, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.includes('@') || !phone || phone.length < 9) return;

        setLoading(true);
        setDuplicateError(null);

        // Check for duplicates
        if (pilgrimageId) {
            try {
                const res = await fetch('/api/booking/check-duplicate', {
                    method: 'POST',
                    body: JSON.stringify({ email, pilgrimageId })
                });
                const checkData = await res.json();
                if (checkData.exists) {
                    setDuplicateError("warning");
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error("Duplicate check failed:", err);
            }
        }
        setLoading(false);
        onNext(email, phone);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-yellow-400/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto mb-6">
                    <User className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-white mb-3">Vamos começar!</h2>
                <p className="text-slate-400 text-lg">Indica os teus contactos.</p>
            </div>

            {duplicateError && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-2xl p-6 text-center animate-in zoom-in-95 duration-300">
                    <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">Já tens uma inscrição!</h3>
                    <p className="text-slate-300 text-sm mb-4">Encontrámos uma reserva ativa para este email nesta peregrinação.</p>
                    <div className="grid gap-3">
                        <Link href="/member/history" className="block w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors">
                            Gerir a minha Reserva
                        </Link>
                        <button onClick={() => onNext(email, phone || '')} className="block w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-bold py-3 rounded-xl transition-colors border border-slate-700">
                            É para outra pessoa (Continuar)
                        </button>
                    </div>
                </div>
            )}

            {!duplicateError && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="text-sm uppercase font-bold text-slate-300 mb-2 block pl-2 tracking-wide">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-6 h-6 group-focus-within:text-yellow-500 transition-colors" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={loading}
                                className="w-full bg-slate-800 border-2 border-slate-700/50 focus:border-yellow-500 rounded-2xl pl-14 pr-6 py-5 text-white placeholder:text-slate-600 focus:outline-none transition-all text-xl shadow-lg disabled:opacity-50"
                                placeholder="tu@email.com"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm uppercase font-bold text-slate-300 mb-2 block pl-2 tracking-wide">WhatsApp / Telemóvel</label>
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
                                    placeholder="+351 912 345 678"
                                    value={phone}
                                    onChange={setPhone}
                                    defaultCountry="PT"
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
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Continuar <ChevronRight className="w-6 h-6" /></>}
                    </button>

                    <p className="text-xs text-slate-500 text-center px-4 mt-2">
                        Usamos estes dados para enviar os bilhetes e informações importantes da viagem.
                    </p>
                </form>
            )}
        </div>
    );
}

// Helper for Pilgrim Card to manage reactivity independently if needed, or straight in map
// We will use standard map but boost Field Labels
const PilgrimCard = ({ index, remove, control, register, errors }: any) => {
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
                    <input {...register(`pilgrims.${index}.full_name`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none focus:ring-0 shadow-inner" placeholder="Ex: Maria dos Anjos Silva" />
                    {errors.pilgrims?.[index]?.full_name && <span className="text-red-500 text-sm mt-1 block font-medium">{errors.pilgrims[index]?.full_name?.message}</span>}
                </div>

                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Data Nascimento</label>
                    <input type="date" {...register(`pilgrims.${index}.birth_date`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" />
                    {errors.pilgrims?.[index]?.birth_date && <span className="text-red-500 text-sm mt-1 block font-medium">{errors.pilgrims[index]?.birth_date?.message}</span>}
                </div>

                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Sexo</label>
                    <select {...register(`pilgrims.${index}.sex`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner">
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
                    <input {...register(`pilgrims.${index}.address`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" placeholder="Rua..." />
                    {errors.pilgrims?.[index]?.address && <span className="text-red-500 text-sm mt-1 block font-medium">{errors.pilgrims[index]?.address?.message}</span>}
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
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Código Postal</label>
                        <div className="relative">
                            <input
                                {...register(`pilgrims.${index}.postal_code`)}
                                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner"
                                placeholder={postalPlaceholder}
                            />
                            {selectedCountry.code === 'PT' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none font-bold opacity-50">ex: 2495-000</span>}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Cidade</label>
                        <input {...register(`pilgrims.${index}.city`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner" />
                    </div>
                </div>
            </div>

            {/* Flight & Extras */}
            <div className="grid grid-cols-1 gap-8 pt-6 border-t border-white/5">
                <div>
                    <label className="text-base uppercase font-bold text-yellow-500 mb-2 block tracking-wide">Opção de Aéreo</label>
                    <select {...register(`pilgrims.${index}.flight_option`)} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-6 py-5 text-white text-xl focus:border-yellow-500 focus:outline-none shadow-inner">
                        <option value="" disabled>Selecione uma opção...</option>
                        <option value="none">1. Não preciso (Vivo na Europa/Outro)</option>
                        <option value="own">2. Eu compro as minhas passagens</option>
                        <option value="agency">3. Quero comprar pela Agência</option>
                    </select>
                    {errors.pilgrims?.[index]?.flight_option && <span className="text-red-500 text-sm mt-1 block font-medium">{errors.pilgrims[index]?.flight_option?.message}</span>}
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

    // User State
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState(''); // New State for Phone
    const [userIdHint, setUserIdHint] = useState<string | null>(null);

    // Form
    const methods = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
        defaultValues: { pilgrims: [], payment_method: 'installments' }
    });
    const { handleSubmit, watch, control, formState: { errors } } = methods;
    const { fields, append, remove } = useFieldArray({ control, name: "pilgrims" });

    // Rooms State
    const [rooms, setRooms] = useState<Room[]>([]);

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
                setUserIdHint(user.id);
            }
            setLoading(false);
        };
        init();
    }, [slug]);

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
            if (!valid) return;
        }
        if (step === 3) {
            const assignedCount = rooms.reduce((acc, r) => acc + r.occupantIndexes.length, 0);
            if (assignedCount < fields.length) {
                alert("Por favor, coloca todos os peregrinos num quarto.");
                return;
            }
        }
        setStep(s => s + 1);
        window.scrollTo(0, 0);
    };

    const onSubmit = async (data: BookingFormValues) => {
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

            const res = await fetch('/api/booking/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    user_id_hint: userIdHint,
                    pilgrimage_id: pilgrimage.id,
                    payment_method: data.payment_method,
                    pilgrim_data: pilgrimsPayload,
                    terms_accepted: data.terms_accepted
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erro desconhecido");

            window.location.href = `/peregrinacoes/inscricao/${result.booking_id}?success=true`;

        } catch (err: any) {
            console.error(err);
            alert("Erro: " + err.message);
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500 w-10 h-10" /></div>;
    if (!pilgrimage) return <div className="text-white text-center pt-20">Peregrinação não encontrada.</div>;

    const depositTotal = fields.length * (pilgrimage.deposit_value || 500);

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
                <p className="text-center text-slate-400 mb-12">Passo {step}: {step === 1 ? 'Identificação' : step === 2 ? 'Dados das Pessoas' : step === 3 ? 'Alojamento' : 'Pagamento'}</p>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden min-h-[400px]">
                    {step === 1 && <StepIdentification onNext={handleIdentitySubmit} initialEmail={userEmail} pilgrimageId={pilgrimage.id} />}

                    {step > 1 && (
                        <FormProvider {...methods}>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                {step === 2 && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                            <h3 className="text-xl font-bold text-white">Quem vai viajar?</h3>
                                            <button type="button" onClick={() => append({ full_name: '', email: '', phone: '', birth_date: '', sex: 'M', address: '', postal_code: '', city: '', country: 'Portugal', flight_option: '' as any, allergies: 'Não', notes: '', cpf_nif: '' })} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                                                <Users className="w-4 h-4" /> Adicionar Pessoa
                                            </button>
                                        </div>
                                        {fields.map((field, idx) => (
                                            <PilgrimCard
                                                key={field.id}
                                                index={idx}
                                                remove={remove}
                                                control={methods.control}
                                                register={methods.register}
                                                errors={errors}
                                            />
                                        ))}
                                        <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-3xl p-6 text-center space-y-4">
                                            <div className="flex justify-center"><AlertCircle className="w-10 h-10 text-yellow-500" /></div>
                                            <div className="space-y-1">
                                                <h4 className="text-xl font-bold text-white">Adicionar Familiar</h4>
                                                <p className="text-sm text-yellow-200/80 max-w-lg mx-auto leading-relaxed">
                                                    ATENÇÃO: Só deves adicionar pessoas do teu <span className="font-bold text-yellow-500 uppercase">Agregado Familiar</span> (Pai, Mãe, Filhos) que vivam contigo.
                                                    <br />Para amigos ou conhecidos, cada um deve fazer a sua própria inscrição separadamente.
                                                </p>
                                            </div>
                                            <button type="button" onClick={() => append({ full_name: '', email: '', phone: '', birth_date: '', sex: 'M', address: '', postal_code: '', city: '', country: 'Portugal', flight_option: '' as any, allergies: 'Não', notes: '', cpf_nif: '' })} className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/20 active:scale-95">
                                                Entendido, adicionar familiar
                                            </button>
                                        </div>
                                        <div className="flex justify-end pt-8"><button type="button" onClick={nextStep} className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-xl shadow-white/5">Escolher Quartos <ChevronRight className="w-5 h-5" /></button></div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center pb-4 border-b border-white/5"><h3 className="text-xl font-bold text-white">Distribuição de Quartos</h3></div>
                                        <RoomOrganizer pilgrims={watch('pilgrims')} onUpdate={setRooms} />
                                        <div className="flex justify-between pt-8"><button type="button" onClick={() => setStep(2)} className="text-slate-400 font-bold hover:text-white">Voltar</button><button type="button" onClick={nextStep} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">Rever Pagamento <ChevronRight className="w-5 h-5" /></button></div>
                                    </div>
                                )}

                                {step === 4 && (
                                    <div className="space-y-8">
                                        <div className="text-center"><h2 className="text-3xl font-bold text-white mb-2">Quase lá!</h2><p className="text-slate-400">Verifica o resumo final antes de confirmar.</p></div>
                                        <div className="bg-slate-950 p-6 rounded-2xl space-y-4">{fields.map((f, i) => (<div key={i} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0"><span className="text-white">{f.full_name || 'Pessoa ' + (i + 1)}</span><span className="text-slate-400">Alojamento Definido</span></div>))}<div className="pt-4 flex justify-between items-center"><span className="text-slate-400">Sinal a Pagar Hoje</span><span className="text-2xl font-bold text-yellow-500">{depositTotal}€</span></div></div>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 cursor-pointer hover:border-yellow-500 transition-colors"><input type="radio" value="installments" {...methods.register('payment_method')} className="w-5 h-5 text-yellow-500 accent-yellow-500" /><div className="flex-1"><div className="font-bold text-white">Pagamento Faseado</div><div className="text-xs text-slate-400">Paga o sinal agora ({depositTotal}€) e o resto depois.</div></div></label>
                                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 cursor-pointer hover:border-yellow-500 transition-colors"><input type="radio" value="full" {...methods.register('payment_method')} className="w-5 h-5 text-yellow-500 accent-yellow-500" /><div className="flex-1"><div className="font-bold text-white">Pagamento Total</div><div className="text-xs text-slate-400">Liquida já o valor total e fica descansado.</div></div></label>
                                        </div>
                                        <div className="flex items-center gap-3 justify-center p-4">
                                            <input type="checkbox" {...methods.register('terms_accepted')} className="w-5 h-5 text-yellow-500 rounded border-slate-700 bg-slate-800 focus:ring-yellow-500" />
                                            <span className="text-sm text-slate-400">Li e aceito os <a href="#" className="underline hover:text-white">Termos e Condições</a> da Peregrinação.</span>
                                        </div>
                                        {errors.terms_accepted && <p className="text-red-500 text-xs text-center">{errors.terms_accepted.message}</p>}

                                        <div className="flex justify-between pt-8"><button type="button" onClick={() => setStep(3)} className="text-slate-400 font-bold hover:text-white">Voltar</button><button type="submit" disabled={submitting} className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white px-8 py-4 rounded-xl font-bold hover:from-yellow-500 hover:to-yellow-600 transition-all flex items-center gap-3 shadow-lg shadow-yellow-900/40 w-full justify-center disabled:opacity-50">{submitting ? <Loader2 className="animate-spin" /> : 'Confirmar Inscrição e Receber Referência'}</button></div>
                                    </div>
                                )}
                            </form>
                        </FormProvider>
                    )}
                </div>
            </main>
        </VIPLayout>
    );
}
