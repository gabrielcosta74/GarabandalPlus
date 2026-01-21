import { FileText, Image as ImageIcon, Link as LinkIcon, Calendar, Euro, Users, AlertCircle, CheckCircle } from 'lucide-react';
import ImageUpload from '../../../../../components/admin/ImageUpload';

interface GeneralInfoTabProps {
    form: any;
    setForm: (form: any) => void;
}

export default function GeneralInfoTab({ form, setForm }: GeneralInfoTabProps) {
    const statusOptions = [
        { value: 'open', label: 'Abertas', description: 'Aceitar inscrições', color: 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-emerald-500' },
        { value: 'waitlist', label: 'Lista de Espera', description: 'Sem vagas imediatas', color: 'bg-amber-50 border-amber-200 text-amber-700 ring-amber-500' },
        { value: 'closed', label: 'Encerradas', description: 'Não aceitar mais', color: 'bg-slate-50 border-slate-200 text-slate-700 ring-slate-500' },
        { value: 'draft', label: 'Rascunho', description: 'Invisível ao público', color: 'bg-purple-50 border-purple-200 text-purple-700 ring-purple-500' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Main Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        Detalhes Principais
                    </h3>
                </div>
                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Title & Slug */}
                    <div className="lg:col-span-2 space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Título da Viagem</label>
                            <input
                                type="text"
                                className="w-full text-xl p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-serif font-medium text-slate-900 placeholder:text-slate-300 shadow-sm"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Ex: Peregrinação a Garabandal 2024"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <LinkIcon className="w-3 h-3" /> Slug (URL Amigável)
                            </label>
                            <div className="flex items-center">
                                <span className="bg-slate-50 border border-r-0 border-slate-200 text-slate-400 px-4 py-3 rounded-l-xl text-sm font-mono leading-none h-[46px] flex items-center">
                                    /peregrinacoes/
                                </span>
                                <input
                                    type="text"
                                    className="flex-1 p-3 bg-white border border-slate-200 rounded-r-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono text-sm text-indigo-600 h-[46px]"
                                    value={form.slug}
                                    onChange={e => setForm({ ...form, slug: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resumo de Itinerário</label>
                            <input
                                type="text"
                                className="w-full text-base p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-300 shadow-sm"
                                value={form.itinerary_summary || ''}
                                onChange={e => setForm({ ...form, itinerary_summary: e.target.value })}
                                placeholder="Ex: Lisboa - Fátima - Garabandal - Bilbao"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descrição Completa</label>
                            <textarea
                                className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all h-40 resize-none text-slate-600 leading-relaxed"
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder="Descreva os pontos altos da viagem, o tema espiritual e o que os peregrinos podem esperar..."
                            />
                        </div>
                    </div>

                    {/* Right Column: Status & Dates */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Estado da Peregrinação</label>
                            <div className="grid grid-cols-1 gap-3">
                                {statusOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setForm({ ...form, status: opt.value })}
                                        className={`relative flex items-center p-3 rounded-xl border transition-all text-left group ${form.status === opt.value
                                            ? `${opt.color} bg-opacity-100 border-current shadow-sm ring-1`
                                            : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${form.status === opt.value ? 'border-current' : 'border-slate-300'}`}>
                                            {form.status === opt.value && <div className="w-2 h-2 rounded-full bg-current" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">{opt.label}</div>
                                            <div className="text-[10px] opacity-70">{opt.description}</div>
                                        </div>
                                        {form.status === opt.value && <CheckCircle className="w-4 h-4 ml-auto opacity-50" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> Datas
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Início</span>
                                    <input
                                        type="date"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none"
                                        value={form.start_date ? new Date(form.start_date).toISOString().split('T')[0] : ''}
                                        onChange={e => setForm({ ...form, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <input
                                        type="date"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none"
                                        value={form.end_date ? new Date(form.end_date).toISOString().split('T')[0] : ''}
                                        onChange={e => setForm({ ...form, end_date: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2 pt-2 border-t border-slate-100 mt-1">
                                    <span className="text-[10px] text-red-400 font-bold uppercase mb-1 block">Limite de Inscrição</span>
                                    <input
                                        type="date"
                                        className="w-full p-2 bg-red-50/50 border border-red-100 text-red-800 rounded-lg text-sm font-medium focus:border-red-500 outline-none"
                                        value={form.registration_deadline ? new Date(form.registration_deadline).toISOString().split('T')[0] : ''}
                                        onChange={e => setForm({ ...form, registration_deadline: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Second Row: Pricing & Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Financials */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Euro className="w-4 h-4 text-emerald-600" />
                            Valores Base
                        </h3>
                    </div>
                    <div className="p-8 grid grid-cols-2 gap-6 flex-1">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preço Base / Pessoa</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-serif italic text-lg">€</span>
                                <input
                                    type="number"
                                    className="w-full pl-8 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-xl font-bold text-slate-900"
                                    value={form.base_price}
                                    onChange={e => setForm({ ...form, base_price: parseFloat(e.target.value) })}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Valor base em quarto duplo.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sinal de Reserva</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-serif italic text-lg">€</span>
                                <input
                                    type="number"
                                    className="w-full pl-8 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-xl font-bold text-slate-900"
                                    value={form.deposit_value}
                                    onChange={e => setForm({ ...form, deposit_value: parseFloat(e.target.value) })}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Mínimo para garantir lugar.</p>
                        </div>

                        <div className="col-span-2 pt-4 border-t border-slate-50">
                            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Capacidade Total</label>
                                    <p className="text-xs text-blue-600">Lotação máx. do autocarro/hotel</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-blue-100 shadow-sm">
                                    <Users className="w-4 h-4 text-blue-500" />
                                    <input
                                        type="number"
                                        className="w-16 text-right font-bold text-blue-900 outline-none"
                                        value={form.total_vacancies}
                                        onChange={e => setForm({ ...form, total_vacancies: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Media */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-pink-500" />
                            Imagem de Capa
                        </h3>
                    </div>
                    <div className="p-8 flex-1 flex flex-col gap-6">
                        <div className="flex-1">
                            <ImageUpload
                                label="Imagem de Capa"
                                bucket="site-content"
                                path="pilgrimages/covers"
                                value={form.cover_image}
                                onChange={(url: string) => setForm({ ...form, cover_image: url })}
                            />
                            <p className="text-[10px] text-slate-400 mt-2">
                                Formatos aceites: JPG, PNG, WEBP. A imagem será otimizada automaticamente.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
