"use client";

import { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import MemberProfileModal from '../../../components/member-profile/MemberProfileModal';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { ShieldCheck, CreditCard, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

type PaymentOption = {
  id: string;
  label: string;
  description: string;
  provider: 'stripe' | 'reduniq';
  solution?: number;
  iconSrc?: string;
  iconAlt: string;
};

const paymentOptions: PaymentOption[] = [
  {
    id: 'stripe',
    label: 'Cartão / Apple Pay',
    description: 'Pagamento imediato e seguro.',
    provider: 'stripe',
    iconSrc: '/payment-icons/stripe.svg',
    iconAlt: 'Stripe',
  },
  {
    id: 'reduniq-mbway',
    label: 'MB WAY',
    description: 'Paga via telemóvel.',
    provider: 'reduniq',
    solution: 107,
    iconSrc: '/payment-icons/mbway.svg',
    iconAlt: 'MB WAY',
  },
  {
    id: 'reduniq-mb',
    label: 'Multibanco',
    description: 'Pagamento de Serviços (Entidade/Ref).',
    provider: 'reduniq',
    solution: 108,
    iconSrc: '/payment-icons/multibanco.svg',
    iconAlt: 'Multibanco',
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const QUOTA_AMOUNT = 25;

export default function MemberQuotaPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState(paymentOptions[0].id);
  const [userId, setUserId] = useState('');
  const [profileData, setProfileData] = useState<Record<string, any> | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<string>('indefinido');
  const [nextQuota, setNextQuota] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [payments, setPayments] = useState<Array<Record<string, any>>>([]);
  const [loadingData, setLoadingData] = useState(true);

  const selectedPayment = useMemo(
    () => paymentOptions.find((option) => option.id === selectedPaymentId) ?? paymentOptions[0],
    [selectedPaymentId],
  );

  useEffect(() => {
    const loadUser = async () => {
      if (!supabaseBrowser) return;
      const { data } = await supabaseBrowser.auth.getUser();
      if (!data.user?.id) return;
      setUserId(data.user.id);
      setLoadingData(true);
      const { data: member } = await supabaseBrowser
        .from('membros')
        .select('nome, email, telefone, address, postal_code, country, nif, numero_socio, estado_quota, proxima_quota, is_membro, tipo_subscricao')
        .eq('id', data.user.id)
        .maybeSingle();
      setProfileData(member ?? {});
      setShowProfile(false);
      const status = (member?.estado_quota || 'indefinido').toLowerCase();
      setQuotaStatus(status);
      setNextQuota(member?.proxima_quota ?? null);
      setIsMember(!!member?.is_membro);
      setIsFounder((member?.tipo_subscricao || '').toLowerCase().includes('fundador'));
      const { data: paymentRows } = await supabaseBrowser
        .from('pagamentos_quotas')
        .select('*')
        .eq('user_id', data.user.id)
        .order('data_pagamento', { ascending: false })
        .limit(5);
      setPayments(paymentRows ?? []);
      setLoadingData(false);
    };
    loadUser();
  }, []);

  const handleCheckout = async () => {
    if (!userId) {
      setError('Sessão inválida. Faz login novamente.');
      return;
    }
    if (showProfile) {
      setShowProfile(false);
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: QUOTA_AMOUNT,
          type: 'membership',
          userId,
          provider: selectedPayment.provider,
          reduniqSolution: selectedPayment.solution,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Não foi possível iniciar o pagamento.');
      }
      const { url, token } = await res.json();
      if (!url) throw new Error('Resposta inesperada do servidor de pagamentos.');
      if (selectedPayment.provider === 'reduniq' && token) {
        try {
          localStorage.setItem(
            'reduniq:lastPayment',
            JSON.stringify({ token, type: 'membership', amount: QUOTA_AMOUNT, userId }),
          );
        } catch (storageError) {
          console.warn('Não foi possível guardar token Reduniq.', storageError);
        }
      }
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Erro ao iniciar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedStatus = quotaStatus === 'paid' ? 'pago' : quotaStatus;
  const statusPaid = normalizedStatus === 'pago';
  const quotaStatusLabel = isFounder
    ? 'fundador'
    : statusPaid
      ? 'pago'
      : normalizedStatus.includes('atras')
        ? 'em atraso'
        : normalizedStatus === 'pendente'
          ? 'pendente'
          : 'indefinido';

  const nextQuotaPretty = nextQuota
    ? new Date(nextQuota).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Sem data';

  const renewWindowDays = 30;
  const canRenew = nextQuota
    ? (() => {
      const due = new Date(nextQuota);
      const windowStart = new Date(due);
      windowStart.setDate(due.getDate() - renewWindowDays);
      return new Date() >= windowStart;
    })()
    : false;
  const canPay = !isFounder && (
    !isMember ||
    !statusPaid ||
    !!canRenew ||
    quotaStatus === 'expirado' ||
    (!isMember && !!profileData?.numero_socio) // Suspended check
  );

  return (
    <DashboardShell
      title="Quota Anual"
      subtitle="Verifica o estado da tua subscrição ou renova a quota."
    >
      <MemberProfileModal
        visible={showProfile}
        userId={userId}
        initialData={profileData ?? {}}
        onClose={() => setShowProfile(false)}
        onSaved={() => setShowProfile(false)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Status Card */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6 text-garabandal-gold" />
              <h3 className="font-serif text-xl font-bold text-garabandal-dark">Estado Atual</h3>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-xl p-4">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Estado</span>
                <div className={`text-lg font-bold flex items-center gap-2 ${statusPaid ? 'text-green-600' : 'text-amber-600'}`}>
                  {statusPaid ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span className="first-letter:uppercase">{quotaStatusLabel}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Próxima Quota</span>
                <div className="text-lg font-bold text-gray-900">{nextQuotaPretty}</div>
              </div>
            </div>
          </div>

          {canPay ? (
            <div className={`rounded-2xl p-4 flex items-start gap-3 border ${quotaStatus === 'expirado' || (!isMember && !!profileData?.numero_socio)
              ? 'bg-red-50 border-red-100'
              : 'bg-blue-50 border-blue-100'
              }`}>
              <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${quotaStatus === 'expirado' || (!isMember && !!profileData?.numero_socio)
                ? 'text-red-600'
                : 'text-blue-600'
                }`} />
              <div>
                <p className={`font-bold text-sm ${quotaStatus === 'expirado' || (!isMember && !!profileData?.numero_socio)
                  ? 'text-red-800'
                  : 'text-blue-800'
                  }`}>
                  {quotaStatus === 'expirado' || (!isMember && !!profileData?.numero_socio)
                    ? 'Conta Suspensa'
                    : 'Renovação Necessária'}
                </p>
                <p className={`text-xs mt-1 ${quotaStatus === 'expirado' || (!isMember && !!profileData?.numero_socio)
                  ? 'text-red-600'
                  : 'text-blue-600'
                  }`}>
                  {quotaStatus === 'expirado' || (!isMember && !!profileData?.numero_socio)
                    ? 'A sua conta está suspensa devido a quotas em atraso. Regularize agora para reativar o acesso imediato.'
                    : 'A tua quota expira em breve ou está em atraso. Renova agora para manteres os teus benefícios.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-green-800 text-sm">Quota em Dia</p>
                <p className="text-green-600 text-xs mt-1">A tua subscrição está ativa. Próxima renovação apenas em {nextQuotaPretty}.</p>
              </div>
            </div>
          )}
        </div>

        {/* Payment Card */}
        {canPay && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-garabandal-gold" />
              <h3 className="font-serif text-xl font-bold text-garabandal-dark">Pagamento</h3>
            </div>

            <p className="text-sm text-gray-500 mb-6">Seleciona o método de pagamento preferido.</p>

            <div className="space-y-3 mb-8">
              {paymentOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedPaymentId(option.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${selectedPaymentId === option.id ? 'border-garabandal-gold bg-garabandal-gold/5' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center p-2 shrink-0">
                    {option.iconSrc && <img src={option.iconSrc} alt={option.iconAlt} className="w-full h-full object-contain" />}
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-900 text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPaymentId === option.id ? 'border-garabandal-gold' : 'border-gray-200'}`}>
                    {selectedPaymentId === option.id && <div className="w-2.5 h-2.5 bg-garabandal-gold rounded-full" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm py-4 border-t border-gray-100 mb-4">
              <span className="text-gray-500">Valor da Quota</span>
              <span className="font-bold text-xl text-garabandal-dark">{formatCurrency(QUOTA_AMOUNT)}</span>
            </div>

            {error && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full btn-primary h-12 text-sm font-bold shadow-lg shadow-garabandal-gold/20"
            >
              {loading ? 'A processar...' : 'Pagar Agora'}
            </button>
          </div>
        )}

        {/* History Section */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-garabandal-gold" />
            <h3 className="font-serif text-xl font-bold text-garabandal-dark">Histórico de Quotas</h3>
          </div>

          {loadingData ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-garabandal-gold border-t-transparent rounded-full" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">Ainda não tens pagamentos registados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase tracking-wider font-bold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((item) => (
                    <tr key={item.id || item.external_reference} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 text-gray-900 font-medium">{item.data_pagamento || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{formatCurrency(item.valor || 0)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${item.estado === 'pago' || item.estado === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {item.estado || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
