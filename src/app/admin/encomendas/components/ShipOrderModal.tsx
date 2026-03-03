"use client";

import React, { useState } from 'react';
import { X, Package, Truck, AlertCircle } from 'lucide-react';

// ─── Carriers ────────────────────────────────────────────────────────────────

export type Carrier = {
    id: string;
    name: string;
    country: string;
    trackingUrl?: (code: string) => string;
};

export const CARRIERS: Carrier[] = [
    // Portugal
    { id: 'ctt', name: 'CTT Encomendas', country: 'PT 🇵🇹', trackingUrl: (code) => `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${code}&SearchInput=${code}` },
    { id: 'ctt_registado', name: 'CTT Correio Registado', country: 'PT 🇵🇹', trackingUrl: (code) => `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${code}&SearchInput=${code}` },
    { id: 'ctt_expresso', name: 'CTT Expresso', country: 'PT 🇵🇹', trackingUrl: (code) => `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${code}&SearchInput=${code}` },
    { id: 'dpd_pt', name: 'DPD Portugal', country: 'PT 🇵🇹', trackingUrl: (code) => `https://tracking.dpd.de/status/pt_PT/parcel/${code}` },
    { id: 'gls_pt', name: 'GLS Portugal', country: 'PT 🇵🇹', trackingUrl: (code) => `https://gls-group.eu/PT/pt/seguimento-de-encomendas.html?match=${code}` },
    { id: 'seur_pt', name: 'SEUR', country: 'PT 🇵🇹', trackingUrl: (code) => `https://www.seur.com/pt/pt/ferramentas-online/track-tracing/localizacao-de-envio.shtml?ref=${code}` },
    { id: 'chronopost_pt', name: 'Chronopost Portugal', country: 'PT 🇵🇹', trackingUrl: (code) => `https://www.chronopost.pt/tracking-no-cms/suivi-page?listeNumerosLT=${code}` },
    { id: 'nacex_pt', name: 'Nacex', country: 'PT 🇵🇹', trackingUrl: (code) => `https://www.nacex.pt/seguimientoDetalle.do?agencia_origen=&numero_albaran=${code}` },
    { id: 'mrw_pt', name: 'MRW', country: 'PT 🇵🇹', trackingUrl: (code) => `https://www.mrw.pt/cliente/seguimiento_envios/resultado_resumen/?AgencyCode=&Expedicion=${code}&Action=10` },
    // Brasil
    { id: 'correios_sedex', name: 'Correios SEDEX', country: 'BR 🇧🇷', trackingUrl: (code) => `https://rastreamento.correios.com.br/app/index.php` },
    { id: 'correios_pac', name: 'Correios PAC', country: 'BR 🇧🇷', trackingUrl: (code) => `https://rastreamento.correios.com.br/app/index.php` },
    { id: 'correios_registrada', name: 'Correios Carta Registrada', country: 'BR 🇧🇷', trackingUrl: (code) => `https://rastreamento.correios.com.br/app/index.php` },
    { id: 'correios_encomenda', name: 'Correios Encomenda SEDEX', country: 'BR 🇧🇷', trackingUrl: (code) => `https://rastreamento.correios.com.br/app/index.php` },
    { id: 'jadlog_br', name: 'Jadlog', country: 'BR 🇧🇷', trackingUrl: (code) => `https://jadlog.com.br/jadlog/tracking.jad?cte=${code}` },
    { id: 'total_express_br', name: 'Total Express', country: 'BR 🇧🇷', trackingUrl: (code) => `https://totalexpress.com.br/rastrear?ids=${code}` },
    { id: 'braspress_br', name: 'Braspress', country: 'BR 🇧🇷', trackingUrl: (code) => `https://www.braspress.com/rastrear/?numeroNota=${code}` },
    { id: 'melhor_envio_br', name: 'Melhor Envio', country: 'BR 🇧🇷', trackingUrl: (code) => `https://melhorrastreio.com.br/rastreio/${code}` },
    { id: 'loggi_br', name: 'Loggi', country: 'BR 🇧🇷', trackingUrl: (code) => `https://www.loggi.com/rastreio/${code}` },
    // Internacional
    { id: 'dhl', name: 'DHL Express', country: '🌍 Internacional', trackingUrl: (code) => `https://www.dhl.com/pt-pt/home/tracking.html?tracking-id=${code}` },
    { id: 'fedex', name: 'FedEx', country: '🌍 Internacional', trackingUrl: (code) => `https://www.fedex.com/pt-pt/tracking.html?trknbr=${code}` },
    { id: 'ups', name: 'UPS', country: '🌍 Internacional', trackingUrl: (code) => `https://www.ups.com/track?tracknum=${code}` },
    { id: 'tnt', name: 'TNT', country: '🌍 Internacional', trackingUrl: (code) => `https://www.tnt.com/express/en_gc/site/shipping-tools/tracking.html?searchType=con&cons=${code}` },
    { id: 'outro', name: 'Outro', country: '', trackingUrl: undefined },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ShipOrderModalProps {
    orderRef: string;
    buyerName: string | null;
    onClose: () => void;
    onConfirm: (carrier: string, carrierId: string, trackingCode: string) => Promise<void>;
}

export default function ShipOrderModal({ orderRef, buyerName, onClose, onConfirm }: ShipOrderModalProps) {
    const [carrierId, setCarrierId] = useState<string>('');
    const [trackingCode, setTrackingCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedCarrier = CARRIERS.find(c => c.id === carrierId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!carrierId) { setError('Selecione um transportador.'); return; }
        if (!trackingCode.trim()) { setError('Introduza o código de rastreio.'); return; }

        setLoading(true);
        try {
            await onConfirm(selectedCarrier?.name || carrierId, carrierId, trackingCode.trim());
        } catch (err: any) {
            setError(err.message || 'Erro ao registar envio.');
        } finally {
            setLoading(false);
        }
    };

    // Group carriers by country for the dropdown
    const ptCarriers = CARRIERS.filter(c => c.country.includes('PT'));
    const brCarriers = CARRIERS.filter(c => c.country.includes('BR'));
    const intCarriers = CARRIERS.filter(c => c.country.includes('Internacional'));
    const otherCarriers = CARRIERS.filter(c => c.id === 'outro');

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">Confirmar Envio</h3>
                            <p className="text-sm text-gray-500">#{orderRef} · {buyerName || '—'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Carrier Select */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Truck className="w-4 h-4 inline mr-1.5 text-gray-400" />
                            Transportador
                        </label>
                        <select
                            value={carrierId}
                            onChange={e => setCarrierId(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">Selecionar transportador...</option>
                            <optgroup label="🇵🇹 Portugal">
                                {ptCarriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="🇧🇷 Brasil">
                                {brCarriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="🌍 Internacional">
                                {intCarriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="Outro">
                                {otherCarriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                        </select>
                    </div>

                    {/* Tracking Code */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Código de Rastreio
                        </label>
                        <input
                            type="text"
                            value={trackingCode}
                            onChange={e => setTrackingCode(e.target.value)}
                            placeholder={carrierId === 'ctt' ? 'ex: CT123456789PT' : carrierId === 'correios_br' ? 'ex: AA123456789BR' : 'ex: 1Z999AA10123456784'}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {selectedCarrier?.trackingUrl && trackingCode.trim() && (
                            <a
                                href={selectedCarrier.trackingUrl(trackingCode.trim())}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1.5"
                            >
                                🔍 Pré-visualizar rastreio
                            </a>
                        )}
                    </div>

                    {/* Email Notice */}
                    <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2">
                        <span className="text-lg leading-none">📧</span>
                        <p>Um email será enviado automaticamente ao cliente com o transportador, código de rastreio e link de seguimento da encomenda.</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-xl px-4 py-3 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 text-white font-bold bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {loading ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                            ) : (
                                <Package className="w-4 h-4" />
                            )}
                            {loading ? 'A registar...' : 'Confirmar Envio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
