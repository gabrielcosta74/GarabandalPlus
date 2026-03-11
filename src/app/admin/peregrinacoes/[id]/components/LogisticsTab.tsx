import { Hotel, Users, Bus, Train, Info } from 'lucide-react';

interface LogisticsTabProps {
    form: any;
    setForm: (form: any) => void;
}

export default function LogisticsTab({ form, setForm }: LogisticsTabProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Accommodation and Transport */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Accommodation Config */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-2">
                        <Hotel className="w-4 h-4 text-amber-600" />
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Alojamento</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Classificação / Estrelas</label>
                            <input
                                type="text"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all"
                                value={form.accommodation_rating || ''}
                                onChange={e => setForm({ ...form, accommodation_rating: e.target.value })}
                                placeholder="Ex: Hotéis 4* ou 3* Superior"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descrição / Notas</label>
                            <textarea
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all h-24 resize-none"
                                value={form.accommodation_description || ''}
                                onChange={e => setForm({ ...form, accommodation_description: e.target.value })}
                                placeholder="Detalhes sobre o alojamento..."
                            />
                        </div>
                    </div>
                </div>

                {/* Transport Config */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-blue-600" />
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Transporte Terrestre</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo de Transporte</label>
                            <input
                                type="text"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all"
                                value={form.transport_type || ''}
                                onChange={e => setForm({ ...form, transport_type: e.target.value })}
                                placeholder="Ex: Autocarro Grande Turismo"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descrição / Notas</label>
                            <textarea
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all h-24 resize-none"
                                value={form.transport_description || ''}
                                onChange={e => setForm({ ...form, transport_description: e.target.value })}
                                placeholder="Detalhes sobre transfers, autocarros no local..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                {/* Logistics Details */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Meeting Points */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Ponto de Encontro</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Início (Local e Hora)</label>
                                <textarea
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all h-20 resize-none"
                                    value={form.meeting_point_text || ''}
                                    onChange={e => setForm({ ...form, meeting_point_text: e.target.value })}
                                    placeholder="Ex: Aeroporto de Lisboa, dia 11 de Outubro às 09:00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fim (Local e Hora)</label>
                                <textarea
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all h-20 resize-none"
                                    value={form.meeting_end_text || ''}
                                    onChange={e => setForm({ ...form, meeting_end_text: e.target.value })}
                                    placeholder="Ex: Paris, dia 24 de Outubro às 16:00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flight Info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Informação de Voos</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preço de Voo (Estimativa)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">€</span>
                                    <input
                                        type="number"
                                        className="w-full pl-7 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-slate-500 outline-none"
                                        value={form.flight_price_from || ''}
                                        onChange={e => setForm({ ...form, flight_price_from: parseFloat(e.target.value) })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 mb-3">
                                    Preencha para <strong>ativar a Opção B (Voo de Grupo)</strong> na página pública.
                                </p>

                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Detalhes Voo de Grupo (Opção B)</label>
                                <textarea
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all h-24 resize-none"
                                    value={form.group_flight_details || ''}
                                    onChange={e => setForm({ ...form, group_flight_details: e.target.value })}
                                    placeholder="Ex: Ida: TP123 Lisboa-Madrid 08:00... Volta: ..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Opção A (Voo Próprio) / Avisos</label>
                                <textarea
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all h-32 resize-none"
                                    value={form.flight_info_text || ''}
                                    onChange={e => setForm({ ...form, flight_info_text: e.target.value })}
                                    placeholder="Ex: Não inclui voos. Recomendamos voo TP123..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-blue-800">Informação Importante</p>
                    <p className="text-sm text-blue-600">Estes detalhes serão apresentados no <strong>Voucher</strong> digital do peregrino após a confirmação da inscrição.</p>
                </div>
            </div>
        </div>
    );
}
