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
}

export default function RoomOrganizer({ pilgrims, onUpdate }: RoomOrganizerProps) {
    const [rooms, setRooms] = useState<Room[]>([]);

    // Sync parent
    useEffect(() => {
        onUpdate(rooms);
    }, [rooms, onUpdate]);

    // UI Helpers
    const getRoomLabel = (type: RoomType) => {
        switch (type) {
            case 'single': return 'Individual (+250€)';
            case 'double': return 'Duplo (Standard)';
            case 'triple': return 'Triplo (Familiar/Amigos)';
            case 'quadruple': return 'Familiar (4 Pessoas)';
        }
    };

    const getRoomIcon = (type: RoomType) => {
        switch (type) {
            case 'single': return <User className="w-5 h-5 text-indigo-400" />;
            case 'double': return <Users className="w-5 h-5 text-emerald-400" />;
            case 'triple': return <Users className="w-5 h-5 text-blue-400" />;
            case 'quadruple': return <Users className="w-5 h-5 text-purple-400" />;
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

        return (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                <h3 className="text-xl font-bold text-white text-center">Como preferes ficar instalado?</h3>

                <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">

                    {/* OPTION 1: SINGLE */}
                    <button
                        type="button"
                        onClick={() => handleSingleChoice('single')}
                        className={`group p-6 rounded-2xl border transition-all text-left relative overflow-hidden ${current?.type === 'single' ? 'bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800 border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10'}`}
                    >
                        {current?.type === 'single' && <div className="absolute top-4 right-4 bg-indigo-500 text-white p-1 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>}
                        <div className="flex items-center gap-4">
                            <BedSingle className={`w-8 h-8 ${current?.type === 'single' ? 'text-indigo-400' : 'text-slate-500'}`} />
                            <div>
                                <h4 className="font-bold text-white text-lg">Quarto Individual</h4>
                                <p className="text-slate-400 text-sm">Privacidade total. Aplicável suplemento (+250€).</p>
                            </div>
                        </div>
                    </button>

                    {/* OPTION 2: DOUBLE (SHARED) */}
                    <div className={`rounded-2xl border transition-all overflow-hidden ${current?.type === 'double' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-800 border-slate-700'}`}>
                        <button
                            type="button"
                            onClick={() => handleSingleChoice('double', 'random')}
                            className="w-full text-left p-6 flex items-center gap-4 hover:bg-emerald-500/5 transition-colors"
                        >
                            <BedDouble className={`w-8 h-8 ${current?.type === 'double' ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-lg flex items-center gap-2">Partilhar Quarto Duplo <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Sem Custo Extra</span></h4>
                                <p className="text-slate-400 text-sm">Vais partilhar quarto com outra pessoa.</p>
                            </div>
                            {current?.type === 'double' && <div className="bg-emerald-500 text-black p-1 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>}
                        </button>

                        {/* Sub Options for Double */}
                        {current?.type === 'double' && (
                            <div className="px-6 pb-6 pt-0 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <hr className="border-white/5 mb-4" />
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={current.sharing_mode === 'random'}
                                        onChange={() => handleSingleChoice('double', 'random')}
                                        className="w-4 h-4 text-emerald-500 accent-emerald-500"
                                    />
                                    <span className="text-sm text-slate-300">O Apostolado escolhe o meu companheiro(a)</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={current.sharing_mode === 'specific_friend'}
                                        onChange={() => handleSingleChoice('double', 'specific_friend')}
                                        className="w-4 h-4 text-emerald-500 accent-emerald-500"
                                    />
                                    <span className="text-sm text-slate-300">Já tenho alguém com quem ficar</span>
                                </label>

                                {current.sharing_mode === 'specific_friend' && (
                                    <div className="pl-7">
                                        <input
                                            type="text"
                                            value={current.sharing_with_names?.[0] || ''}
                                            onChange={(e) => updateFriendName(0, e.target.value)}
                                            placeholder="Nome da pessoa..."
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* OPTION 3: TRIPLE (FRIENDS) */}
                    <div className={`rounded-2xl border transition-all overflow-hidden ${current?.type === 'triple' ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-800 border-slate-700'}`}>
                        <button
                            type="button"
                            onClick={() => handleSingleChoice('triple', 'specific_friends_triple')}
                            className="w-full text-left p-6 flex items-center gap-4 hover:bg-blue-500/5 transition-colors"
                        >
                            <Users className={`w-8 h-8 ${current?.type === 'triple' ? 'text-blue-400' : 'text-slate-500'}`} />
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-lg flex items-center gap-2">Partilhar Quarto Triplo <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Amigos</span></h4>
                                <p className="text-slate-400 text-sm">Opção apenas se já tiveres 2 conhecidos para ficar contigo.</p>
                            </div>
                            {current?.type === 'triple' && <div className="bg-blue-500 text-black p-1 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>}
                        </button>

                        {/* Inputs for Triple */}
                        {current?.type === 'triple' && (
                            <div className="px-6 pb-6 pt-0 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <hr className="border-white/5 mb-4" />
                                <p className="text-xs text-slate-400 mb-2">Indica o nome das 2 pessoas que vão ficar contigo:</p>
                                <input
                                    type="text"
                                    value={current.sharing_with_names?.[0] || ''}
                                    onChange={(e) => updateFriendName(0, e.target.value)}
                                    placeholder="Nome Amigo 1..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                />
                                <input
                                    type="text"
                                    value={current.sharing_with_names?.[1] || ''}
                                    onChange={(e) => updateFriendName(1, e.target.value)}
                                    placeholder="Nome Amigo 2..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                        )}
                    </div>

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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-yellow-500/10 rounded-full text-yellow-500"><CheckCircle2 className="w-6 h-6" /></div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Distribuição dos Quartos</h3>
                        <p className="text-slate-400 text-sm">Organiza quem fica em cada quarto se necessário.</p>
                    </div>
                </div>

                <div className="grid gap-4">
                    {rooms.map((room, roomIndex) => (
                        <div key={room.id || roomIndex} className="bg-slate-900 border border-slate-700 p-5 rounded-xl flex flex-col gap-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-800 p-2 rounded-lg">
                                        {getRoomIcon(room.type)}
                                    </div>
                                    <p className="font-bold text-white capitalize text-lg">{getRoomLabel(room.type)}</p>
                                </div>

                                {/* Bed Preference (Only for Double) */}
                                {room.type === 'double' && (
                                    <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 scale-90 origin-right">
                                        <button
                                            type="button"
                                            onClick={() => updateBedType(room.id, 'big_bed')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${room.bed_type === 'big_bed' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            Cama Casal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateBedType(room.id, 'twin_beds')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${room.bed_type === 'twin_beds' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            Twin
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Occupant Slots */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {room.occupantIndexes.map((occupantIdx, slotIndex) => (
                                    <div key={slotIndex} className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <select
                                            value={occupantIdx}
                                            onChange={(e) => updateOccupant(roomIndex, slotIndex, parseInt(e.target.value))}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white text-sm appearance-none focus:ring-1 focus:ring-yellow-500 max-w-full truncate cursor-pointer hover:border-slate-500 transition-colors"
                                        >
                                            {pilgrims.map((p, pIdx) => (
                                                <option key={pIdx} value={pIdx}>
                                                    {p.full_name || `Viajante ${pIdx + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


