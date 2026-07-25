import { Hotel, User, Users, Bed, ShieldCheck } from 'lucide-react';
import BilingualField, {
    BilingualListField,
    TranslateAllButton,
} from '../../../../../components/admin/BilingualField';

interface PricingTabProps {
    form: any;
    setForm: (form: any) => void;
}

export default function PricingTab({ form, setForm }: PricingTabProps) {
    const updateSupplement = (type: 'single' | 'double' | 'triple' | 'quadruple', value: number) => {
        setForm({
            ...form,
            pricing_config: {
                ...form.pricing_config,
                room_supplements: {
                    ...form.pricing_config?.room_supplements,
                    [type]: value || 0
                }
            }
        });
    };

    const translatableFields = [
        { ptValue: form.payment_plan_text ?? '', onChangeEn: (v: string) => setForm({ ...form, payment_plan_text_en: v }) },
        { ptValue: form.cancellation_policy_text ?? '', onChangeEn: (v: string) => setForm({ ...form, cancellation_policy_text_en: v }) },
        {
            ptValue: (form.included_items ?? []).join('\n'),
            onChangeEn: (v: string) => setForm({ ...form, included_items_en: v.split('\n').map((item) => item.trim()).filter(Boolean) })
        },
        {
            ptValue: (form.not_included_items ?? []).join('\n'),
            onChangeEn: (v: string) => setForm({ ...form, not_included_items_en: v.split('\n').map((item) => item.trim()).filter(Boolean) })
        },
    ];

    const renderPriceCard = (type: 'single' | 'double' | 'triple' | 'quadruple', label: string, sublabel: string, icon: any) => {
        const value = form.pricing_config?.room_supplements?.[type] || 0;
        const isFree = value === 0;

        return (
            <div className={`p-6 rounded-2xl border-2 transition-all ${value > 0 ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100 bg-white'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        {icon}
                    </div>
                    {value > 0 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">Extra</span>}
                </div>

                <h4 className="font-bold text-slate-800">{label}</h4>
                <p className="text-xs text-slate-500 mb-4">{sublabel}</p>

                <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-serif text-lg ${value > 0 ? 'text-amber-600' : 'text-slate-300'}`}>€</span>
                    <input
                        type="number"
                        className={`w-full pl-8 p-3 rounded-xl border-2 outline-none font-bold text-lg transition-all ${value > 0
                            ? 'bg-white border-amber-200 focus:border-amber-400 text-amber-700'
                            : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-700'
                            }`}
                        value={value}
                        onChange={e => updateSupplement(type, parseFloat(e.target.value))}
                        placeholder="0"
                    />
                </div>
                <div className="text-center mt-2">
                    {isFree ? (
                        <span className="text-[10px] uppercase font-bold text-slate-400">Sem Suplemento</span>
                    ) : (
                        <span className="text-[10px] uppercase font-bold text-amber-600">+ {value}€ / pessoa</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end">
                <TranslateAllButton fields={translatableFields} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-amber-50/50 px-8 py-6 border-b border-amber-100">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Hotel className="w-5 h-5 text-amber-500" />
                        Matriz de Preços & Suplementos
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                        Defina o suplemento (custo extra) a cobrar por pessoa para cada tipologia de quarto.
                    </p>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {renderPriceCard('single', 'Quarto Individual', '1 Pessoa (Privado)', <User className="w-5 h-5" />)}
                    {renderPriceCard('double', 'Quarto Duplo', '2 Pessoas (Casal/Par)', <Users className="w-5 h-5" />)}
                    {renderPriceCard('triple', 'Quarto Triplo', '3 Pessoas', <Bed className="w-5 h-5" />)}
                    {renderPriceCard('quadruple', 'Quarto Quádruplo', 'Família (4+)', <Bed className="w-5 h-5" />)}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800">Informações Financeiras</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <BilingualField
                            label="Plano de Pagamento"
                            ptValue={form.payment_plan_text || ''}
                            enValue={form.payment_plan_text_en || ''}
                            onChangePt={v => setForm({ ...form, payment_plan_text: v })}
                            onChangeEn={v => setForm({ ...form, payment_plan_text_en: v })}
                            type="rich"
                            rows={5}
                            placeholder="Ex: Pode parcelar em até 8x sem juros..."
                            placeholderEn="Ex: Payment can be split into up to 8 interest-free installments..."
                        />

                        <BilingualField
                            label="Política de Cancelamento"
                            ptValue={form.cancellation_policy_text || ''}
                            enValue={form.cancellation_policy_text_en || ''}
                            onChangePt={v => setForm({ ...form, cancellation_policy_text: v })}
                            onChangeEn={v => setForm({ ...form, cancellation_policy_text_en: v })}
                            type="rich"
                            rows={6}
                            placeholder="Insira o texto da política ou HTML básico..."
                            placeholderEn="Enter the policy text or basic HTML..."
                        />
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                        <h3 className="font-bold text-slate-800">Incluído / Não Incluído</h3>
                    </div>
                    <div className="p-6 space-y-5">
                        <BilingualListField
                            label="Incluído no Valor"
                            ptValues={form.included_items ?? []}
                            enValues={form.included_items_en ?? []}
                            onChangePt={values => setForm({ ...form, included_items: values })}
                            onChangeEn={values => setForm({ ...form, included_items_en: values })}
                            rows={7}
                            placeholder="Um item por linha&#10;Ex: Hotel em quarto duplo&#10;Transfers no destino"
                            placeholderEn="One item per line&#10;Ex: Hotel in double room&#10;Transfers at destination"
                        />

                        <BilingualListField
                            label="Não Incluído"
                            ptValues={form.not_included_items ?? []}
                            enValues={form.not_included_items_en ?? []}
                            onChangePt={values => setForm({ ...form, not_included_items: values })}
                            onChangeEn={values => setForm({ ...form, not_included_items_en: values })}
                            rows={7}
                            placeholder="Um item por linha&#10;Ex: Seguros&#10;Bagagem Extra&#10;Almoços Livres"
                            placeholderEn="One item per line&#10;Ex: Insurance&#10;Extra baggage&#10;Free lunches"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
