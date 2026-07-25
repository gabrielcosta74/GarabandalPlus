import { Hotel, Bus, Info } from 'lucide-react';
import BilingualField, { TranslateAllButton } from '../../../../../components/admin/BilingualField';
import {
    CountryBasedFlightPolicy,
    parseCountryBasedFlightPolicy,
} from '../../../../../lib/pilgrimage-flight-policy';

interface LogisticsTabProps {
    form: any;
    setForm: (form: any) => void;
}

export default function LogisticsTab({ form, setForm }: LogisticsTabProps) {
    const countryBasedFlightPolicy = parseCountryBasedFlightPolicy(
        form.pricing_config?.flight_registration_policy,
    );

    const updateFlightEstimate = (country: 'BR' | 'PT', rawValue: string) => {
        if (!countryBasedFlightPolicy) return;
        const parsed = rawValue === '' ? null : Number(rawValue);
        const nextPolicy: CountryBasedFlightPolicy = {
            ...countryBasedFlightPolicy,
            estimates_eur: {
                ...countryBasedFlightPolicy.estimates_eur,
                [country]: parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
            },
        };
        setForm({
            ...form,
            pricing_config: {
                ...(form.pricing_config || {}),
                flight_registration_policy: nextPolicy,
            },
        });
    };

    const translatableFields = [
        { ptValue: form.accommodation_description ?? '', onChangeEn: (v: string) => setForm({ ...form, accommodation_description_en: v }) },
        { ptValue: form.transport_description ?? '', onChangeEn: (v: string) => setForm({ ...form, transport_description_en: v }) },
        { ptValue: form.meeting_point_text ?? '', onChangeEn: (v: string) => setForm({ ...form, meeting_point_text_en: v }) },
        { ptValue: form.meeting_end_text ?? '', onChangeEn: (v: string) => setForm({ ...form, meeting_end_text_en: v }) },
        { ptValue: form.group_flight_details ?? '', onChangeEn: (v: string) => setForm({ ...form, group_flight_details_en: v }) },
        { ptValue: form.flight_info_text ?? '', onChangeEn: (v: string) => setForm({ ...form, flight_info_text_en: v }) },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Translate all button */}
            <div className="flex justify-end">
                <TranslateAllButton fields={translatableFields} />
            </div>

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
                        <BilingualField
                            label="Descrição / Notas"
                            ptValue={form.accommodation_description ?? ''}
                            enValue={form.accommodation_description_en ?? ''}
                            onChangePt={v => setForm({ ...form, accommodation_description: v })}
                            onChangeEn={v => setForm({ ...form, accommodation_description_en: v })}
                            type="rich"
                            rows={3}
                            placeholder="Detalhes sobre o alojamento..."
                            placeholderEn="Accommodation details..."
                        />
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
                        <BilingualField
                            label="Descrição / Notas"
                            ptValue={form.transport_description ?? ''}
                            enValue={form.transport_description_en ?? ''}
                            onChangePt={v => setForm({ ...form, transport_description: v })}
                            onChangeEn={v => setForm({ ...form, transport_description_en: v })}
                            type="rich"
                            rows={3}
                            placeholder="Detalhes sobre transfers, autocarros no local..."
                            placeholderEn="Transfer and transport details..."
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Meeting Points */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Ponto de Encontro</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <BilingualField
                                label="Início (Local e Hora)"
                                ptValue={form.meeting_point_text ?? ''}
                                enValue={form.meeting_point_text_en ?? ''}
                                onChangePt={v => setForm({ ...form, meeting_point_text: v })}
                                onChangeEn={v => setForm({ ...form, meeting_point_text_en: v })}
                                type="rich"
                                rows={3}
                                placeholder="Ex: Aeroporto de Lisboa, dia 11 de Outubro às 09:00"
                                placeholderEn="Ex: Lisbon Airport, October 11th at 09:00"
                            />
                            <BilingualField
                                label="Fim (Local e Hora)"
                                ptValue={form.meeting_end_text ?? ''}
                                enValue={form.meeting_end_text_en ?? ''}
                                onChangePt={v => setForm({ ...form, meeting_end_text: v })}
                                onChangeEn={v => setForm({ ...form, meeting_end_text_en: v })}
                                type="rich"
                                rows={3}
                                placeholder="Ex: Paris, dia 24 de Outubro às 16:00"
                                placeholderEn="Ex: Paris, October 24th at 16:00"
                            />
                        </div>
                    </div>

                    {/* Flight Info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Informação de Voos</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                {countryBasedFlightPolicy ? (
                                    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-xs font-black uppercase tracking-wider text-amber-800">
                                            Política obrigatória por país
                                        </p>
                                        <p className="mt-2 text-sm leading-relaxed text-amber-900">
                                            Portugal e Brasil contratam obrigatoriamente o pacote aéreo através da agência.
                                            Todos os restantes países compram os próprios voos.
                                        </p>
                                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            {([
                                                { country: 'BR' as const, label: 'Estimativa Brasil (€)' },
                                                { country: 'PT' as const, label: 'Estimativa Portugal (€)' },
                                            ]).map(({ country, label }) => (
                                                <div key={country}>
                                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-800">
                                                        {label}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        inputMode="decimal"
                                                        className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                                        value={countryBasedFlightPolicy.estimates_eur[country] ?? ''}
                                                        onChange={event => updateFlightEstimate(country, event.target.value)}
                                                        placeholder="A confirmar"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-3 text-xs font-semibold leading-relaxed text-amber-800">
                                            Valor meramente informativo, pago diretamente à agência parceira. Nunca é
                                            somado ao valor terrestre nem ao total da inscrição.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preço de Voo (Estimativa)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">€</span>
                                            <input
                                                type="number"
                                                className="w-full pl-7 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-slate-500 outline-none"
                                                value={form.flight_price_from || ''}
                                                onChange={e => setForm({ ...form, flight_price_from: e.target.value === '' ? null : Number(e.target.value) })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 mb-3">
                                            Preencha para <strong>ativar a Opção B (Voo de Grupo)</strong> na página pública.
                                        </p>
                                    </>
                                )}

                                <BilingualField
                                    label={countryBasedFlightPolicy ? 'Pacote obrigatório Portugal/Brasil' : 'Detalhes Voo de Grupo (Opção B)'}
                                    ptValue={form.group_flight_details ?? ''}
                                    enValue={form.group_flight_details_en ?? ''}
                                    onChangePt={v => setForm({ ...form, group_flight_details: v })}
                                    onChangeEn={v => setForm({ ...form, group_flight_details_en: v })}
                                    type="rich"
                                    rows={3}
                                    placeholder="Ex: Ida: TP123 Lisboa-Madrid 08:00... Volta: ..."
                                    placeholderEn="Ex: Outbound: TP123 Lisbon-Madrid 08:00... Return: ..."
                                />
                            </div>
                            <BilingualField
                                label={countryBasedFlightPolicy ? 'Voos próprios — restantes países' : 'Opção A (Voo Próprio) / Avisos'}
                                ptValue={form.flight_info_text ?? ''}
                                enValue={form.flight_info_text_en ?? ''}
                                onChangePt={v => setForm({ ...form, flight_info_text: v })}
                                onChangeEn={v => setForm({ ...form, flight_info_text_en: v })}
                                type="rich"
                                rows={4}
                                placeholder="Ex: Não inclui voos. Recomendamos voo TP123..."
                                placeholderEn="Ex: Flights not included. We recommend flight TP123..."
                            />
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
