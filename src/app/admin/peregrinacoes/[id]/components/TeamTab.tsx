import { Trash2, Crown } from 'lucide-react';
import BilingualField from '../../../../../components/admin/BilingualField';
import AdminImageUpload from '../../../../../components/admin/AdminImageUpload';

interface TeamMember {
    id?: string;
    pilgrimage_id?: string;
    name: string;
    role: string;
    role_en?: string | null;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    description_en?: string | null;
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
            role_en: '',
            country: 'PT',
            image_url: '',
            is_special_guest: false,
            description: '',
            description_en: '',
            display_order: teamMembers.length + 1
        }]);
    };

    const removeTeamMember = (index: number) => {
        const newMembers = [...teamMembers];
        newMembers.splice(index, 1);
        setTeamMembers(newMembers);
    };

    const updateTeamMember = <K extends keyof TeamMember,>(index: number, field: K, value: TeamMember[K]) => {
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

                        <div className="mb-4">
                            <div className="space-y-2">
                                <input
                                    value={member.name}
                                    onChange={e => updateTeamMember(idx, 'name', e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-lg"
                                    placeholder="Nome..."
                                />
                                <BilingualField
                                    label="Cargo"
                                    ptValue={member.role}
                                    enValue={member.role_en || ''}
                                    onChangePt={value => updateTeamMember(idx, 'role', value)}
                                    onChangeEn={value => updateTeamMember(idx, 'role_en', value)}
                                    placeholder="Cargo (ex: Guia)"
                                    placeholderEn="Role (ex: Guide)"
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

                            <BilingualField
                                label="Descrição / Biografia"
                                ptValue={member.description}
                                enValue={member.description_en || ''}
                                onChangePt={value => updateTeamMember(idx, 'description', value)}
                                onChangeEn={value => updateTeamMember(idx, 'description_en', value)}
                                type="textarea"
                                rows={4}
                                placeholder="Pequena biografia..."
                                placeholderEn="Short biography..."
                            />

                            <AdminImageUpload
                                value={member.image_url}
                                onChange={url => updateTeamMember(idx, 'image_url', url)}
                                label="Fotografia"
                                alt={member.name ? `Fotografia de ${member.name}` : 'Fotografia do membro da equipa'}
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
