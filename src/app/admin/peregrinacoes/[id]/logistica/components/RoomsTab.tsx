"use client";

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BedDouble, AlertTriangle, Plus, Clock, Award, Search, Utensils, X, Users, TriangleAlert, Trash2, Wand2,
} from 'lucide-react';
import type { LogisticsAccounts, LogisticsPerson } from '../../../../../../lib/logistics-accounts';
import { supabaseBrowser } from '../../../../../../lib/supabase-browser';
import StatCard from '../../../../../../components/admin/ui/StatCard';
import { TONE_BADGE, TONE_CHIP, TONE_DOT, type Tone } from '../../../../../../components/admin/ui/tones';
import { Surface, Button, EmptyState, TextField, PillSelect, type PillOption } from './kit';

/** Tipologias que a planta de quartos usa, com a capacidade de cada uma. */
const ROOM_TYPES = [
    { key: 'double_bed', label: 'Duplo casal', capacity: 2, tone: 'rose' as Tone },
    { key: 'twin', label: 'Duplo twin', capacity: 2, tone: 'sky' as Tone },
    { key: 'triple', label: 'Triplo', capacity: 3, tone: 'amber' as Tone },
    { key: 'family', label: 'Familiar', capacity: 4, tone: 'teal' as Tone },
    { key: 'single', label: 'Individual', capacity: 1, tone: 'slate' as Tone },
];
const typeInfo = (key: string) => ROOM_TYPES.find(t => t.key === key) ?? ROOM_TYPES[0];

/** O que a inscrição pede vs. o que a planta oferece. `double` cabe em ambos. */
const requestFits = (requested: string | null, roomType: string) => {
    if (!requested) return true;
    if (requested === 'double') return roomType === 'double_bed' || roomType === 'twin';
    return requested === roomType;
};

const AVATAR_TONES: Tone[] = ['sky', 'emerald', 'violet', 'amber', 'teal', 'rose'];
function avatarTone(person: LogisticsPerson): Tone {
    if (person.kind === 'courtesy') return 'violet';
    if (person.kind === 'held') return 'amber';
    let h = 0;
    for (const c of person.id) h = (h * 31 + c.charCodeAt(0)) % 997;
    return AVATAR_TONES[h % AVATAR_TONES.length];
}

const initials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(p => p.length > 2);
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const shortName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length <= 2 ? name : `${parts[0]} ${parts[parts.length - 1]}`;
};

const SEAT_KIND_OPTIONS: PillOption<string>[] = [
    { value: 'courtesy', label: 'Cortesia', role: 'special' },
    { value: 'held', label: 'Lugar guardado', role: 'waiting' },
];

export default function RoomsTab({
    accounts, pilgrimageId, onChanged, error,
}: {
    accounts: LogisticsAccounts | null;
    pilgrimageId: string;
    onChanged: () => void;
    error?: string | null;
}) {
    const [dragging, setDragging] = useState<string | null>(null);
    const [hoverRoom, setHoverRoom] = useState<string | null>(null);
    const [hoverPool, setHoverPool] = useState(false);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [showSeats, setShowSeats] = useState(false);

    const rooms = accounts?.rooms ?? [];
    const people = accounts?.people ?? [];
    const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

    const assigned = useMemo(() => new Set(rooms.flatMap(r => r.memberIds)), [rooms]);
    const pool = people.filter(p => !assigned.has(p.id));

    const stats = useMemo(() => {
        const beds = rooms.reduce((a, r) => a + r.capacity, 0);
        const occupied = rooms.reduce((a, r) => a + r.memberIds.length, 0);
        const conflicts = rooms.filter(r =>
            r.memberIds.length > r.capacity
            || r.memberIds.some(id => {
                const p = personById.get(id);
                return p && !requestFits(p.roomType, r.roomType);
            }),
        ).length;
        return { beds, occupied, conflicts, free: Math.max(0, beds - occupied) };
    }, [rooms, personById]);

    const authed = async (path: string, init: RequestInit) => {
        setBusy(true);
        try {
            const { data } = await supabaseBrowser!.auth.getSession();
            const token = data.session?.access_token;
            const res = await fetch(path, {
                ...init,
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error || 'Erro ao gravar');
            onChanged();
        } catch (err: any) {
            window.alert(err?.message || 'Erro ao gravar');
        } finally {
            setBusy(false);
        }
    };

    const ROOMS_API = `/api/admin/logistics/${pilgrimageId}/rooms`;
    const SEATS_API = `/api/admin/logistics/${pilgrimageId}/seats`;

    const move = (personId: string, roomId: string | null) => {
        const person = personById.get(personId);
        return authed(`${ROOMS_API}/members`, {
            method: 'PUT',
            body: JSON.stringify({ personId, kind: person?.kind === 'pilgrim' ? 'pilgrim' : 'seat', roomId }),
        });
    };

    const generate = () => {
        const has = rooms.length > 0;
        if (has && !window.confirm(
            'Refazer a planta apaga os quartos actuais e volta a distribuir toda a gente a partir das inscrições. Continuar?',
        )) return;
        return authed(`${ROOMS_API}/generate`, {
            method: 'POST',
            body: JSON.stringify({ replace: has }),
        });
    };

    const addRoom = (type: typeof ROOM_TYPES[number]) => {
        const count = rooms.filter(r => r.roomType === type.key).length + 1;
        return authed(ROOMS_API, {
            method: 'POST',
            body: JSON.stringify({
                label: `${type.label} ${count}`,
                room_type: type.key,
                capacity: type.capacity,
                display_order: rooms.length + 1,
            }),
        });
    };

    const removeRoom = (id: string) => {
        const room = rooms.find(r => r.id === id);
        if (!room) return;
        if (room.memberIds.length > 0
            && !window.confirm(`Apagar "${room.label}"? As ${room.memberIds.length} pessoas voltam para "Por atribuir".`)) return;
        return authed(`${ROOMS_API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    };

    if (error) {
        return <Surface><EmptyState icon={BedDouble} title="Não foi possível carregar os quartos" detail={error} /></Surface>;
    }
    if (!accounts) {
        return <Surface><EmptyState icon={BedDouble} title="A carregar..." detail="A ler inscrições e planta de quartos." /></Surface>;
    }

    const filteredPool = pool.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    const seats = people.filter(p => p.kind !== 'pilgrim');

    return (
        <div className={`space-y-6 transition-opacity ${busy ? 'pointer-events-none opacity-60' : ''}`}>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Quartos" value={String(rooms.length)} detail={`${stats.beds} camas na planta`} icon={BedDouble} tone="slate" />
                <StatCard label="Alojados" value={String(stats.occupied)} detail={`${stats.free} camas por ocupar`} icon={Users} tone="emerald" />
                <StatCard label="Por atribuir" value={String(pool.length)} detail={pool.length === 0 ? 'Ninguém à espera' : 'Pessoas sem quarto'} icon={Clock} tone={pool.length > 0 ? 'amber' : 'slate'} />
                <StatCard label="Conflitos" value={String(stats.conflicts)} detail={stats.conflicts === 0 ? 'Tudo em ordem' : 'Quartos por resolver'} icon={TriangleAlert} tone={stats.conflicts > 0 ? 'rose' : 'slate'} />
            </div>

            {rooms.length === 0 && (
                <Surface>
                    <EmptyState
                        icon={BedDouble}
                        title="A planta de quartos está vazia"
                        detail={`Há ${people.length} pessoas para alojar. Crie os quartos e arraste as pessoas para dentro.`}
                        action={
                            <div className="flex flex-col items-center gap-3">
                                <Button variant="primary" onClick={generate}>
                                    <Wand2 className="h-4 w-4" /> Gerar planta a partir das inscrições
                                </Button>
                                <p className="max-w-md text-[12.5px] leading-relaxed text-slate-500">
                                    Junta quem se inscreveu na mesma reserva, respeita quem indicou com quem quer ficar,
                                    e usa a tipologia pedida por cada pessoa. Depois é só corrigir o que fizer falta.
                                </p>
                            </div>
                        }
                    />
                </Surface>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">

                <div className="space-y-8">
                    {ROOM_TYPES.map(type => {
                        const group = rooms.filter(r => r.roomType === type.key);
                        if (group.length === 0 && rooms.length > 0) return null;
                        if (group.length === 0) return null;
                        const occupied = group.reduce((a, r) => a + r.memberIds.length, 0);
                        const beds = group.reduce((a, r) => a + r.capacity, 0);

                        return (
                            <section key={type.key}>
                                <header className="mb-3.5 flex items-center justify-between gap-4 px-0.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`h-2 w-2 rounded-full ${TONE_DOT[type.tone]}`} />
                                        <h3 className="text-[17px] font-bold tracking-tight text-slate-900">{type.label}</h3>
                                        <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${TONE_BADGE[type.tone]}`}>
                                            {group.length} {group.length === 1 ? 'quarto' : 'quartos'} · {occupied}/{beds}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => addRoom(type)}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                    >
                                        <Plus className="h-4 w-4" /> Quarto
                                    </button>
                                </header>

                                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
                                    <AnimatePresence mode="popLayout">
                                        {group.map(room => (
                                            <RoomCard
                                                key={room.id}
                                                room={room}
                                                members={room.memberIds.map(id => personById.get(id)).filter(Boolean) as LogisticsPerson[]}
                                                isHovered={hoverRoom === room.id}
                                                draggedPerson={dragging ? personById.get(dragging) ?? null : null}
                                                onDragOver={e => { e.preventDefault(); setHoverRoom(room.id); }}
                                                onDragLeave={() => setHoverRoom(null)}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    const id = e.dataTransfer.getData('text/plain');
                                                    if (id) move(id, room.id);
                                                    setHoverRoom(null);
                                                    setDragging(null);
                                                }}
                                                onDragStartPerson={setDragging}
                                                onDragEndPerson={() => setDragging(null)}
                                                onRemoveMember={id => move(id, null)}
                                                onRemoveRoom={() => removeRoom(room.id)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </section>
                        );
                    })}

                    {rooms.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-5">
                            <span className="self-center text-[13px] text-slate-500">Criar quarto:</span>
                            {ROOM_TYPES.map(type => (
                                <Button key={type.key} size="sm" onClick={() => addRoom(type)}>
                                    <Plus className="h-3.5 w-3.5" /> {type.label}
                                </Button>
                            ))}
                            <Button size="sm" className="ml-auto" onClick={generate}>
                                <Wand2 className="h-3.5 w-3.5" /> Refazer planta
                            </Button>
                        </div>
                    )}
                </div>

                {/* Por atribuir */}
                <div className="space-y-4 xl:sticky xl:top-4">
                    <div
                        onDragOver={e => { e.preventDefault(); setHoverPool(true); }}
                        onDragLeave={() => setHoverPool(false)}
                        onDrop={e => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/plain');
                            if (id) move(id, null);
                            setHoverPool(false);
                            setDragging(null);
                        }}
                        className={`rounded-2xl border bg-white transition-all duration-200 ${hoverPool
                            ? 'border-slate-400 shadow-[0_10px_28px_rgba(15,23,42,0.07)]'
                            : 'border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                            }`}
                    >
                        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
                            <h3 className="text-[15px] font-bold tracking-tight text-slate-900">Por atribuir</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-inset ${pool.length > 0 ? TONE_BADGE.amber : TONE_BADGE.slate}`}>
                                {pool.length}
                            </span>
                        </div>

                        <div className="px-5 pb-4">
                            <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 transition-colors focus-within:border-slate-400 focus-within:bg-white">
                                <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Procurar pessoa..."
                                    className="w-full bg-transparent text-[14px] outline-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="max-h-[440px] overflow-y-auto px-3 pb-3">
                            {filteredPool.length === 0 ? (
                                <p className="py-10 text-center text-[13.5px] text-slate-400">
                                    {pool.length === 0 ? 'Toda a gente tem quarto.' : 'Ninguém com esse nome.'}
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    <AnimatePresence mode="popLayout">
                                        {filteredPool.map(person => (
                                            <PersonCard
                                                key={person.id}
                                                person={person}
                                                showRequest
                                                onDragStart={() => setDragging(person.id)}
                                                onDragEnd={() => setDragging(null)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] leading-relaxed text-slate-400">
                            Arraste uma pessoa para um quarto. Para a tirar, arraste de volta para aqui ou use o ×.
                        </p>
                    </div>

                    {/* Cortesias e lugares guardados */}
                    <Surface
                        title="Lugares especiais"
                        subtitle={`${seats.length} · ocupam cama, fora das inscrições`}
                        action={
                            <button
                                onClick={() => setShowSeats(v => !v)}
                                className="text-[13px] font-semibold text-slate-500 transition-colors hover:text-slate-900"
                            >
                                {showSeats ? 'Fechar' : 'Gerir'}
                            </button>
                        }
                    >
                        {showSeats && (
                            <div className="space-y-3 px-4 py-4">
                                {seats.map(seat => (
                                    <div key={seat.id} className="rounded-xl border border-slate-200/70 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1 space-y-2.5">
                                                <TextField
                                                    value={seat.name}
                                                    onCommit={v => authed(SEATS_API, { method: 'PATCH', body: JSON.stringify({ id: seat.id, full_name: v }) })}
                                                    placeholder="Nome"
                                                />
                                                <TextField
                                                    value={seat.role || ''}
                                                    onCommit={v => authed(SEATS_API, { method: 'PATCH', body: JSON.stringify({ id: seat.id, role: v }) })}
                                                    placeholder="Função"
                                                />
                                                <PillSelect
                                                    value={seat.kind}
                                                    options={SEAT_KIND_OPTIONS}
                                                    onChange={kind => authed(SEATS_API, { method: 'PATCH', body: JSON.stringify({ id: seat.id, kind }) })}
                                                    width="w-full max-w-[170px]"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (!window.confirm(`Apagar "${seat.name}"?`)) return;
                                                    authed(`${SEATS_API}?id=${encodeURIComponent(seat.id)}`, { method: 'DELETE' });
                                                }}
                                                className="rounded-lg p-1.5 text-slate-400 opacity-60 transition-all hover:bg-rose-50 hover:text-rose-600 hover:opacity-100"
                                                aria-label={`Apagar ${seat.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    className="w-full"
                                    onClick={() => authed(SEATS_API, {
                                        method: 'POST',
                                        body: JSON.stringify({ kind: 'courtesy', full_name: 'Nova cortesia', room_type: 'single', amount_due: 0, display_order: seats.length + 1 }),
                                    })}
                                >
                                    <Plus className="h-4 w-4" /> Adicionar lugar
                                </Button>
                            </div>
                        )}
                    </Surface>

                    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <h3 className="mb-3.5 text-[15px] font-bold tracking-tight text-slate-900">Legenda</h3>
                        <div className="space-y-2.5">
                            <Legend tone="violet" icon={Award} label="Cortesia" detail="Ocupa cama, não paga" />
                            <Legend tone="amber" icon={Clock} label="Lugar guardado" detail="A aguardar resposta" />
                            <Legend tone="teal" icon={Utensils} label="Restrição alimentar" detail="Avisar o hotel" />
                            <Legend tone="rose" icon={AlertTriangle} label="Conflito" detail="Excesso ou tipologia errada" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------

function Legend({ tone, icon: Icon, label, detail }: {
    tone: Tone;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    detail: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${TONE_CHIP[tone]}`}>
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-slate-800">{label}</div>
                <div className="text-[12.5px] text-slate-500">{detail}</div>
            </div>
        </div>
    );
}

function RoomCard({
    room, members, isHovered, draggedPerson, onDragOver, onDragLeave, onDrop,
    onDragStartPerson, onDragEndPerson, onRemoveMember, onRemoveRoom,
}: {
    room: { id: string; label: string; roomType: string; capacity: number };
    members: LogisticsPerson[];
    isHovered: boolean;
    draggedPerson: LogisticsPerson | null;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragStartPerson: (id: string) => void;
    onDragEndPerson: () => void;
    onRemoveMember: (id: string) => void;
    onRemoveRoom: () => void;
}) {
    const over = members.length > room.capacity;
    const mismatch = members.filter(p => !requestFits(p.roomType, room.roomType));
    const emptyBeds = Math.max(0, room.capacity - members.length);
    const full = members.length === room.capacity;
    const wouldMismatch = Boolean(draggedPerson && !requestFits(draggedPerson.roomType, room.roomType));
    const occupancyTone: Tone = over ? 'rose' : full ? 'emerald' : members.length === 0 ? 'slate' : 'amber';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`group/room flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${over
                ? 'border-rose-200'
                : isHovered
                    ? wouldMismatch
                        ? 'border-amber-400 shadow-[0_10px_28px_rgba(180,83,9,0.12)]'
                        : 'border-slate-400 shadow-[0_10px_28px_rgba(15,23,42,0.09)]'
                    : 'border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                }`}
        >
            <header className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-3.5">
                <span className="truncate text-[15px] font-bold tracking-tight text-slate-900">{room.label}</span>
                <div className="flex flex-shrink-0 items-center gap-1">
                    <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums ring-1 ring-inset ${TONE_BADGE[occupancyTone]}`}>
                        {members.length}/{room.capacity}
                    </span>
                    <button
                        onClick={onRemoveRoom}
                        className="rounded-lg p-1.5 text-slate-400 opacity-45 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover/room:opacity-100"
                        aria-label={`Apagar ${room.label}`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 space-y-1.5 px-3 pb-3">
                <AnimatePresence mode="popLayout">
                    {members.map(person => (
                        <PersonCard
                            key={person.id}
                            person={person}
                            flagged={mismatch.includes(person)}
                            onDragStart={() => onDragStartPerson(person.id)}
                            onDragEnd={onDragEndPerson}
                            onRemove={() => onRemoveMember(person.id)}
                        />
                    ))}
                </AnimatePresence>

                {Array.from({ length: emptyBeds }).map((_, i) => (
                    <div
                        key={`bed-${i}`}
                        className={`flex h-[52px] items-center justify-center gap-2 rounded-xl border border-dashed text-[13px] font-medium transition-colors ${isHovered && !wouldMismatch
                            ? 'border-slate-400 bg-slate-50 text-slate-500'
                            : 'border-slate-200 text-slate-300'
                            }`}
                    >
                        <BedDouble className="h-4 w-4" />
                        Cama livre
                    </div>
                ))}
            </div>

            {(over || mismatch.length > 0) && (
                <div className="flex items-start gap-2 border-t border-rose-100 bg-rose-50/70 px-4 py-2.5 text-[12.5px] leading-relaxed text-rose-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                        {over && `${members.length - room.capacity} a mais para a capacidade. `}
                        {mismatch.length > 0 && `${mismatch.map(p => p.name.split(' ')[0]).join(', ')} pediu outra tipologia.`}
                    </span>
                </div>
            )}
        </motion.div>
    );
}

function PersonCard({
    person, flagged = false, showRequest = false, onDragStart, onDragEnd, onRemove,
}: {
    person: LogisticsPerson;
    flagged?: boolean;
    showRequest?: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onRemove?: () => void;
}) {
    const tone = avatarTone(person);
    const requested = person.roomType ? ROOM_TYPES.find(t => t.key === person.roomType)?.label ?? person.roomType : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
        >
            <div
                draggable
                onDragStart={e => { e.dataTransfer.setData('text/plain', person.id); onDragStart(); }}
                onDragEnd={onDragEnd}
                title={person.name}
                className={`group/person flex h-[52px] cursor-grab items-center gap-2.5 rounded-xl border px-2.5 transition-all duration-200 active:cursor-grabbing ${flagged
                    ? 'border-rose-200 bg-rose-50/60'
                    : 'border-slate-200/70 bg-white hover:border-slate-300 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]'
                    }`}
            >
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ring-1 ring-inset ${TONE_CHIP[tone]}`}>
                    {initials(person.name)}
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14.5px] font-semibold leading-tight text-slate-900">
                            {shortName(person.name)}
                        </span>
                        {person.kind === 'courtesy' && <Award className="h-3.5 w-3.5 flex-shrink-0 text-violet-500" />}
                        {person.kind === 'held' && <Clock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
                        {person.dietary && <Utensils className="h-3.5 w-3.5 flex-shrink-0 text-teal-600" />}
                    </div>
                    <div className="truncate text-[12.5px] leading-tight text-slate-500">
                        {person.kind === 'courtesy'
                            ? person.role
                            : person.kind === 'held'
                                ? 'Lugar guardado'
                                : showRequest && requested
                                    ? `Pediu ${requested.toLowerCase()}`
                                    : person.country || '—'}
                    </div>
                </div>

                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 opacity-45 transition-all hover:bg-slate-100 hover:text-rose-600 group-hover/person:opacity-100"
                        aria-label={`Retirar ${person.name} do quarto`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}
