import { Trash2, Crown } from 'lucide-react';

interface TeamMember {
    id?: string;
    pilgrimage_id?: string;
    name: string;
    role: string;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    display_order: number;
}

interface TeamTabProps {
    teamMembers: TeamMember[];
    setTeamMembers: (members: TeamMember[]) => void;
}

export default function TeamTab({ teamMembers, setTeamMembers }: TeamTabProps) {
    const addTeamMember = () => {
        setTeamMembers([...teamMembers, {
            id: `temp-${Date.now()}`,
            name: '',
            role: 'Guia Espiritual',
            country: 'PT',
            image_url: '',
            is_special_guest: false,
            description: '',
            display_order: teamMembers.length + 1
        }]);
    };

    const removeTeamMember = (index: number) => {
        const newMembers = [...teamMembers];
        newMembers.splice(index, 1);
        setTeamMembers(newMembers);
    };

    const updateTeamMember = (index: number, field: keyof TeamMember, value: any) => {
        const newMembers = [...teamMembers];
        newMembers[index] = { ...newMembers[index], [field]: value };
        setTeamMembers(newMembers);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg mb-2">Equipa & Convidados</h3>
                    <p className="text-slate-400 text-sm">Adicione quem vai acompanhar esta peregrinação (Guias, Padres, Convidados).</p>
                </div>
                <button
                    onClick={addTeamMember}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    + Adicionar Membro
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teamMembers.map((member, idx) => (
                    <div key={member.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button onClick={() => removeTeamMember(idx)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        <div className="flex gap-4 mb-4">
                            <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-100 flex-shrink-0">
                                {member.image_url ? (
                                    <img src={member.image_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-2xl">?</div>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <input
                                    value={member.name}
                                    onChange={e => updateTeamMember(idx, 'name', e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-lg"
                                    placeholder="Nome..."
                                />
                                <input
                                    value={member.role}
                                    onChange={e => updateTeamMember(idx, 'role', e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-600 uppercase tracking-wider"
                                    placeholder="Cargo (ex: Guia)"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateTeamMember(idx, 'is_special_guest', !member.is_special_guest)}
                                    className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold border transition-colors ${member.is_special_guest ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                >
                                    <Crown className="w-3 h-3" />
                                    {member.is_special_guest ? 'Convidado Especial' : 'Membro Normal'}
                                </button>
                                <input
                                    value={member.country}
                                    onChange={e => updateTeamMember(idx, 'country', e.target.value)}
                                    className="w-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono text-sm uppercase"
                                    placeholder="PT"
                                    maxLength={2}
                                />
                            </div>

                            <textarea
                                value={member.description}
                                onChange={e => updateTeamMember(idx, 'description', e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-20 resize-none"
                                placeholder="Pequena biografia..."
                            />

                            <input
                                value={member.image_url || ''}
                                onChange={e => updateTeamMember(idx, 'image_url', e.target.value)}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400"
                                placeholder="URL da Foto"
                            />
                        </div>
                    </div>
                ))}
            </div>

            {teamMembers.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-200 w-full">
                    <p className="text-slate-400">Ainda sem equipa definida.</p>
                </div>
            )}
        </div>
    );
}
