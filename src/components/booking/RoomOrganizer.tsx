"use client";

import { useState, useEffect } from 'react';
import { User, Users, Plus, X, ArrowRight, BedDouble, BedSingle, CheckCircle2, AlertCircle, HelpCircle, MousePointer2 } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type RoomType = 'single' | 'double' | 'triple' | 'quadruple';

export interface Room {
    id: string;
    type: RoomType;
    occupantIndexes: number[];
    // New Fields
    bed_type?: 'big_bed' | 'twin_beds'; // For Double Rooms
    sharing_mode?: 'random' | 'specific_friend' | 'specific_friends_triple';
    sharing_with_names?: string[]; // Names of friends
}

interface RoomOrganizerProps {
    pilgrims: any[];
    onUpdate: (rooms: Room[]) => void;
    pricing?: {
        single?: number;
        double?: number;
        triple?: number;
        quadruple?: number;
    };
}

export default function RoomOrganizer({ pilgrims, onUpdate, pricing }: RoomOrganizerProps) {
    const [rooms, setRooms] = useState<Room[]>([]);

    // Sync parent
    useEffect(() => {
        onUpdate(rooms);
    }, [rooms, onUpdate]);

    // UI Helpers
    // UI Helpers
    const getRoomLabel = (type: RoomType) => {
        const price = pricing?.[type] || 0;
        const priceStr = price > 0 ? ` (+${price}€)` : ' (Standard)';

        switch (type) {
            case 'single': return `Quarto Individual${price > 0 ? ` (+${price}€)` : ''}`;
            case 'double': return `Quarto Duplo${priceStr}`;
            case 'triple': return `Quarto Triplo${priceStr}`;
            case 'quadruple': return `Quarto Familiar (4)${priceStr}`;
        }
    };

    const getRoomIcon = (type: RoomType) => {
        switch (type) {
            case 'single': return <User className="w-5 h-5" />;
            case 'double': return <Users className="w-5 h-5" />;
            case 'triple': return <Users className="w-5 h-5" />;
            case 'quadruple': return <Users className="w-5 h-5" />;
        }
    };

    // --- LOGIC ---
    useEffect(() => {
        if (pilgrims.length === 0) return;

        // 1 Person: Don't overwrite if user has already made a specific choice.
        // But if the type is invalid (e.g. was Quad but now 1 person), reset.
        if (pilgrims.length === 1) {
            if (rooms.length === 0) return; // Wait for user choice
            // If we have a room that doesn't make sense for 1 person (like a family room with 4 people), reset
            if (rooms[0].occupantIndexes.length > 1) setRooms([]);
            return;
        }

        // Automatic Assignment for Groups > 1
        let newRooms: Room[] = [];
        const pCount = pilgrims.length;

        if (pCount === 2) {
            // Case 2: 1 Double Room. Preserve existing bed preference if it exists.
            const existingBedType = rooms.find(r => r.type === 'double')?.bed_type || 'big_bed';
            newRooms = [{ id: 'auto-double', type: 'double', occupantIndexes: [0, 1], bed_type: existingBedType }];
        } else if (pCount === 3) {
            // Case 3: 1 Triple Room
            newRooms = [{ id: 'auto-triple', type: 'triple', occupantIndexes: [0, 1, 2] }];
        } else if (pCount === 4) {
            // Case 4: 1 Family Room
            newRooms = [{ id: 'auto-family', type: 'quadruple', occupantIndexes: [0, 1, 2, 3] }];
        } else if (pCount === 5) {
            // Case 5: 1 Double + 1 Triple (Standardize: First 2 in Double, Next 3 in Triple)
            const existingBedType = rooms.find(r => r.type === 'double')?.bed_type || 'big_bed';
            newRooms = [
                { id: 'auto-double-5', type: 'double', occupantIndexes: [0, 1], bed_type: existingBedType },
                { id: 'auto-triple-5', type: 'triple', occupantIndexes: [2, 3, 4] }
            ];
        } else {
            // Fallback for 6+
            let pIndex = 0;
            while (pIndex < pCount) {
                const remaining = pCount - pIndex;
                if (remaining >= 2) {
                    newRooms.push({ id: `auto-d-${pIndex}`, type: 'double', occupantIndexes: [pIndex, pIndex + 1], bed_type: 'big_bed' });
                    pIndex += 2;
                } else {
                    newRooms.push({ id: `auto-s-${pIndex}`, type: 'single', occupantIndexes: [pIndex] });
                    pIndex++;
                }
            }
        }

        // Deep Compare to avoid loops
        const currentSig = JSON.stringify(rooms);
        const newSig = JSON.stringify(newRooms);
        if (currentSig !== newSig) {
            setRooms(newRooms);
        }

    }, [pilgrims.length]); // Dependency on count mainly.


    // --- HANDLERS ---
    const updateBedType = (roomId: string, type: 'big_bed' | 'twin_beds') => {
        const updated = rooms.map(r => r.id === roomId ? { ...r, bed_type: type } : r);
        setRooms(updated);
    };

    const handleSingleChoice = (type: RoomType, mode?: 'random' | 'specific_friend' | 'specific_friends_triple') => {
        setRooms([{
            id: 'single-user-choice',
            type,
            occupantIndexes: [0],
            sharing_mode: mode,
            sharing_with_names: mode === 'specific_friend' ? [''] : mode === 'specific_friends_triple' ? ['', ''] : undefined
        }]);
    };

    const updateFriendName = (index: number, name: string) => {
        const updated = rooms.map(r => {
            const newNames = [...(r.sharing_with_names || [])];
            newNames[index] = name;
            return { ...r, sharing_with_names: newNames };
        });
        setRooms(updated);
    };


    // --- RENDER FOR 1 PERSON (WIZARD) ---
    if (pilgrims.length === 1) {
        const current = rooms[0];
        const priceTag = (price?: number, fallback = 'Sem custo extra') => (
            <span className={`reg-badge ${price && price > 0 ? 'is-gold' : 'is-ok'}`}>{price && price > 0 ? `+${price}€` : fallback}</span>
        );

        return (
            <div className="reg-stack" style={{ gap: 12 }} role="radiogroup" aria-label="Tipo de quarto">

                {/* OPTION 1: SINGLE */}
                <button
                    type="button"
                    role="radio"
                    aria-checked={current?.type === 'single'}
                    onClick={() => handleSingleChoice('single')}
                    className={`reg-choice ${current?.type === 'single' ? 'is-selected' : ''}`}
                    style={{ width: '100%', textAlign: 'left', padding: 20, font: 'inherit' }}
                >
                    <span className="reg-choice-mark" aria-hidden="true" />
                    <span className="reg-choice-body">
                        <span className="reg-choice-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <BedSingle className="w-5 h-5" style={{ color: 'var(--reg-gold)' }} aria-hidden="true" /> Quarto individual {priceTag(pricing?.single, 'S/ suplemento')}
                        </span>
                        <span className="reg-choice-desc" style={{ display: 'block' }}>Privacidade total, só para si.</span>
                    </span>
                </button>

                {/* OPTION 2: DOUBLE (SHARED) */}
                <div className={`reg-choice ${current?.type === 'double' ? 'is-selected' : ''}`} style={{ display: 'block', padding: 0, cursor: 'default' }}>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={current?.type === 'double'}
                        onClick={() => handleSingleChoice('double', 'random')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: 20, border: 0, background: 'none', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
                    >
                        <span className="reg-choice-mark" aria-hidden="true" />
                        <span className="reg-choice-body">
                            <span className="reg-choice-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <BedDouble className="w-5 h-5" style={{ color: 'var(--reg-gold)' }} aria-hidden="true" /> Partilhar quarto duplo {priceTag(pricing?.double)}
                            </span>
                            <span className="reg-choice-desc" style={{ display: 'block' }}>Fica num quarto com outro peregrino.</span>
                        </span>
                    </button>

                    {/* Sub Options for Double */}
                    {current?.type === 'double' && (
                        <div className="reg-stack reg-step" style={{ gap: 10, padding: '0 20px 20px 56px' }}>
                            <label className="reg-choice" style={{ padding: '12px 14px', background: '#fff' }}>
                                <input
                                    type="radio"
                                    checked={current.sharing_mode === 'random'}
                                    onChange={() => handleSingleChoice('double', 'random')}
                                />
                                <span className="reg-choice-mark" aria-hidden="true" />
                                <span className="reg-choice-desc" style={{ marginTop: 0, color: 'var(--reg-ink)' }}>O Apostolado escolhe o meu companheiro(a)</span>
                            </label>
                            <label className="reg-choice" style={{ padding: '12px 14px', background: '#fff' }}>
                                <input
                                    type="radio"
                                    checked={current.sharing_mode === 'specific_friend'}
                                    onChange={() => handleSingleChoice('double', 'specific_friend')}
                                />
                                <span className="reg-choice-mark" aria-hidden="true" />
                                <span className="reg-choice-desc" style={{ marginTop: 0, color: 'var(--reg-ink)' }}>Já tenho alguém com quem ficar</span>
                            </label>

                            {current.sharing_mode === 'specific_friend' && (
                                <label className="reg-field">
                                    <span className="reg-field-label">Nome da pessoa</span>
                                    <input
                                        type="text"
                                        autoFocus
                                        autoCapitalize="words"
                                        value={current.sharing_with_names?.[0] || ''}
                                        onChange={(e) => updateFriendName(0, e.target.value)}
                                        placeholder="Ex.: Ana Costa"
                                    />
                                </label>
                            )}
                        </div>
                    )}
                </div>

                {/* OPTION 3: TRIPLE (FRIENDS) */}
                <div className={`reg-choice ${current?.type === 'triple' ? 'is-selected' : ''}`} style={{ display: 'block', padding: 0, cursor: 'default' }}>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={current?.type === 'triple'}
                        onClick={() => handleSingleChoice('triple', 'specific_friends_triple')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: 20, border: 0, background: 'none', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
                    >
                        <span className="reg-choice-mark" aria-hidden="true" />
                        <span className="reg-choice-body">
                            <span className="reg-choice-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Users className="w-5 h-5" style={{ color: 'var(--reg-gold)' }} aria-hidden="true" /> Partilhar quarto triplo <span className="reg-badge is-gold">Amigos</span>
                            </span>
                            <span className="reg-choice-desc" style={{ display: 'block' }}>Só se já tiver 2 conhecidos para ficar consigo.</span>
                        </span>
                    </button>

                    {/* Inputs for Triple */}
                    {current?.type === 'triple' && (
                        <div className="reg-stack reg-step" style={{ gap: 10, padding: '0 20px 20px 56px' }}>
                            <p className="reg-choice-desc" style={{ marginTop: 0 }}>Indique o nome das 2 pessoas que vão ficar consigo:</p>
                            <label className="reg-field">
                                <span className="reg-field-label">Pessoa 1</span>
                                <input
                                    type="text"
                                    autoFocus
                                    autoCapitalize="words"
                                    value={current.sharing_with_names?.[0] || ''}
                                    onChange={(e) => updateFriendName(0, e.target.value)}
                                    placeholder="Nome completo"
                                />
                            </label>
                            <label className="reg-field">
                                <span className="reg-field-label">Pessoa 2</span>
                                <input
                                    type="text"
                                    autoCapitalize="words"
                                    value={current.sharing_with_names?.[1] || ''}
                                    onChange={(e) => updateFriendName(1, e.target.value)}
                                    placeholder="Nome completo"
                                />
                            </label>
                        </div>
                    )}
                </div>

            </div>
        );
    }

    const updateOccupant = (currentRoomIndex: number, slotIndex: number, newPilgrimIndex: number) => {
        // Deep copy to avoid direct state mutation
        const newRooms = rooms.map(r => ({ ...r, occupantIndexes: [...r.occupantIndexes] }));

        // Find who is currently in the target slot
        const targetOldOccupant = newRooms[currentRoomIndex].occupantIndexes[slotIndex];

        // Find where the new pilgrim is currently located (to swap)
        let sourceRoomIndex = -1;
        let sourceSlotIndex = -1;

        newRooms.forEach((r, rIdx) => {
            r.occupantIndexes.forEach((idx, sIdx) => {
                if (idx === newPilgrimIndex) {
                    sourceRoomIndex = rIdx;
                    sourceSlotIndex = sIdx;
                }
            });
        });

        if (sourceRoomIndex !== -1 && sourceSlotIndex !== -1) {
            // SWAP LOGIC
            // 1. Put the target's old occupant into the source's slot
            newRooms[sourceRoomIndex].occupantIndexes[sourceSlotIndex] = targetOldOccupant;
            // 2. Put the new pilgrim into the target slot
            newRooms[currentRoomIndex].occupantIndexes[slotIndex] = newPilgrimIndex;

            setRooms(newRooms);
        }
    };

    // RENDER FOR GROUPS (2, 3, 4+)
    return (
        <div className="reg-stack" style={{ gap: 14 }}>
            <p className="reg-help" style={{ margin: 0 }}>Organizámos os quartos automaticamente. Pode trocar quem fica em cada um, se precisar.</p>

            {rooms.map((room, roomIndex) => (
                <div key={room.id || roomIndex} className="reg-plan" style={{ marginTop: 0, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="reg-family-icon" style={{ width: 38, height: 38 }} aria-hidden="true">{getRoomIcon(room.type)}</span>
                            <p className="reg-choice-title">{getRoomLabel(room.type)}</p>
                        </div>

                        {/* Bed Preference (Only for Double) */}
                        {room.type === 'double' && (
                            <div className="reg-segment" style={{ gap: 6 }} role="radiogroup" aria-label="Tipo de cama">
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={room.bed_type === 'big_bed'}
                                    onClick={() => updateBedType(room.id, 'big_bed')}
                                    className={`reg-choice ${room.bed_type === 'big_bed' ? 'is-selected' : ''}`}
                                    style={{ padding: '8px 14px', fontSize: 14, borderRadius: 12, font: 'inherit' }}
                                >
                                    Cama de casal
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={room.bed_type === 'twin_beds'}
                                    onClick={() => updateBedType(room.id, 'twin_beds')}
                                    className={`reg-choice ${room.bed_type === 'twin_beds' ? 'is-selected' : ''}`}
                                    style={{ padding: '8px 14px', fontSize: 14, borderRadius: 12, font: 'inherit' }}
                                >
                                    Camas separadas
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Occupant Slots */}
                    <div className="reg-row" style={{ gap: 10 }}>
                        {room.occupantIndexes.map((occupantIdx, slotIndex) => (
                            <label key={slotIndex} className="reg-field reg-field-select">
                                <span className="reg-field-label">Pessoa {slotIndex + 1}</span>
                                <select
                                    value={occupantIdx}
                                    onChange={(e) => updateOccupant(roomIndex, slotIndex, parseInt(e.target.value))}
                                    style={{ fontSize: 17 }}
                                >
                                    {pilgrims.map((p, pIdx) => (
                                        <option key={pIdx} value={pIdx}>
                                            {p.full_name || `Viajante ${pIdx + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
