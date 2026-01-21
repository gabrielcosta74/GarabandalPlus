import { Trash2, Search } from 'lucide-react';

interface Stage {
    id?: string;
    pilgrimage_id?: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    image_url: string;
    display_order: number;
}

interface ItineraryTabProps {
    stages: Stage[];
    setStages: (stages: Stage[]) => void;
    addStage: () => void;
    removeStage: (index: number) => void;
    handleLocationSearch: (index: number, query: string) => void;
    suggestions: Record<number, any[]>;
    selectLocation: (index: number, result: any) => void;
}

export default function ItineraryTab({
    stages,
    setStages,
    addStage,
    removeStage,
    handleLocationSearch,
    suggestions,
    selectLocation
}: ItineraryTabProps) {

    const updateStage = (index: number, field: keyof Stage, value: any) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], [field]: value };
        setStages(newStages);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg mb-2">Editor de Roteiro 3D</h3>
                    <p className="text-slate-400 text-sm">Adicione aqui os pontos chave da peregrinação. Eles aparecerão no Mapa 3D interativo.</p>
                </div>
                <button
                    onClick={addStage}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    + Adicionar Paragem
                </button>
            </div>

            <div className="space-y-4">
                {stages.map((stage, idx) => (
                    <div key={stage.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => removeStage(idx)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        {/* Order Badge */}
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 flex-shrink-0">
                            {idx + 1}
                        </div>

                        {/* Fields */}
                        <div className="flex-1 space-y-4">

                            {/* Search Box (Autocomplete) */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Pesquisar Localização</label>
                                <div className="relative">
                                    <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg pr-2 focus-within:ring-2 focus-within:ring-slate-200">
                                        <Search className="w-4 h-4 text-slate-400 ml-2" />
                                        <input
                                            type="text"
                                            placeholder="Escreva para pesquisar (ex: Fátima)..."
                                            className="flex-1 p-2 outline-none text-sm bg-transparent"
                                            onChange={(e) => handleLocationSearch(idx, e.target.value)}
                                        />
                                    </div>

                                    {/* Suggestions Dropdown */}
                                    {suggestions[idx] && suggestions[idx].length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-white rounded-lg shadow-xl border border-slate-100 mt-2 z-20 max-h-60 overflow-y-auto">
                                            {suggestions[idx].map((item: any, i: number) => (
                                                <button
                                                    key={i}
                                                    onClick={() => selectLocation(idx, item)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="font-bold text-slate-700">{item.name}</div>
                                                    <div className="text-xs text-slate-400 truncate">{item.display_name}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome do Local</label>
                                    <input
                                        value={stage.title}
                                        onChange={e => updateStage(idx, 'title', e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lat</label>
                                        <input
                                            type="number"
                                            value={stage.lat}
                                            onChange={e => updateStage(idx, 'lat', parseFloat(e.target.value))}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lng</label>
                                        <input
                                            type="number"
                                            value={stage.lng}
                                            onChange={e => updateStage(idx, 'lng', parseFloat(e.target.value))}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-400"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descrição do Momento</label>
                                <textarea
                                    value={stage.description}
                                    onChange={e => updateStage(idx, 'description', e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-20 resize-none"
                                    placeholder="O que acontece aqui?"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Imagem (URL)</label>
                                <input
                                    value={stage.image_url || ''}
                                    onChange={e => updateStage(idx, 'image_url', e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {/* Image Preview */}
                        {stage.image_url && (
                            <div className="w-32 h-32 bg-slate-100 rounded-xl overflow-hidden self-start flex-shrink-0 border border-slate-200">
                                <img src={stage.image_url} className="w-full h-full object-cover" />
                            </div>
                        )}
                    </div>
                ))}

                {stages.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400">Nenhuma paragem definida.</p>
                        <button onClick={addStage} className="text-indigo-600 font-bold mt-2 hover:underline">Adicionar a primeira</button>
                    </div>
                )}
            </div>
        </div>
    );
}
