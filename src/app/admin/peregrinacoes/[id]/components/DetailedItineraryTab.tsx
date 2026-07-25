import { Trash2, Images } from 'lucide-react';
import BilingualField from '../../../../../components/admin/BilingualField';
import MultiImageUpload from '../../../../../components/admin/MultiImageUpload';

interface DetailedItineraryItem {
    id?: string;
    pilgrimage_id?: string;
    day_number: number | null;
    title: string | null;
    title_en?: string | null;
    description: string | null;
    description_en?: string | null;
    image_url: string | null;
    images?: string[];
    display_order: number | null;
}

interface DetailedItineraryTabProps {
    detailedItems: DetailedItineraryItem[];
    setDetailedItems: (items: DetailedItineraryItem[]) => void;
    addDetailedItem: () => void;
    removeDetailedItem: (index: number) => void;
}

export default function DetailedItineraryTab({
    detailedItems,
    setDetailedItems,
    addDetailedItem,
    removeDetailedItem
}: DetailedItineraryTabProps) {

    const updateDetailedItem = (index: number, field: keyof DetailedItineraryItem, value: any) => {
        const newItems = [...detailedItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setDetailedItems(newItems);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg mb-2">Itinerário Detalhado (Dia a Dia)</h3>
                    <p className="text-slate-400 text-sm">Este é o programa que aparece na secção "Programa" da página pública.</p>
                </div>
                <button
                    onClick={addDetailedItem}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    + Adicionar Dia
                </button>
            </div>

            <div className="space-y-4">
                {detailedItems.map((item, idx) => (
                    <div key={item.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => removeDetailedItem(idx)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Dia</span>
                            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-200">
                                {item.day_number}
                            </div>
                        </div>

                        <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <BilingualField
                                        label="Título do Dia"
                                        ptValue={item.title || ''}
                                        enValue={item.title_en || ''}
                                        onChangePt={value => updateDetailedItem(idx, 'title', value)}
                                        onChangeEn={value => updateDetailedItem(idx, 'title_en', value)}
                                        placeholder="Ex: Chegada a Santander"
                                        placeholderEn="Ex: Arrival in Santander"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dia Nº</label>
                                    <input
                                        type="number"
                                        value={item.day_number ?? idx + 1}
                                        onChange={e => updateDetailedItem(idx, 'day_number', parseInt(e.target.value))}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono"
                                    />
                                </div>
                            </div>

                            <BilingualField
                                label="Descrição das Atividades"
                                ptValue={item.description || ''}
                                enValue={item.description_en || ''}
                                onChangePt={value => updateDetailedItem(idx, 'description', value)}
                                onChangeEn={value => updateDetailedItem(idx, 'description_en', value)}
                                type="rich"
                                rows={5}
                                placeholder="Detalhe o programa para este dia..."
                                placeholderEn="Describe the plan for this day..."
                            />

                            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <Images className="h-4 w-4 text-yellow-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Fotos do dia (slideshow)</span>
                                </div>
                                <MultiImageUpload
                                    bucket="site-content"
                                    path="pilgrimages/itinerary"
                                    value={(item.images && item.images.length > 0)
                                        ? item.images
                                        : (item.image_url ? [item.image_url] : [])}
                                    onChange={(urls) => updateDetailedItem(idx, 'images', urls)}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {detailedItems.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400">Nenhum dia adicionado ao programa.</p>
                        <button onClick={addDetailedItem} className="text-indigo-600 font-bold mt-2 hover:underline">Adicionar Dia 1</button>
                    </div>
                )}
            </div>
        </div>
    );
}
