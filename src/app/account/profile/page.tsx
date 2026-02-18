"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import MemberProfileModal from '../../../components/member-profile/MemberProfileModal';
import ChangePasswordModal from '../../../components/auth/ChangePasswordModal';
import ChangeEmailModal from '../../../components/auth/ChangeEmailModal';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useAuth } from '../../../contexts/AuthContext';
import { User, MapPin, Shield, Edit2, KeyRound, LogOut, CheckCircle2, Mail } from 'lucide-react';

export default function AccountProfilePage() {
  // Use centralized AuthContext for data to ensure synchronization
  const { memberData, user, refreshMemberData } = useAuth();

  const [showProfile, setShowProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Security states
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<'success' | 'error' | null>(null);
  const router = useRouter();

  // Refresh data on mount to ensure freshness
  useEffect(() => {
    refreshMemberData();
  }, [refreshMemberData]);

  // Derived state for display
  const profileDisplay = memberData || ({} as any);
  const currentEmail = user?.email || '';

  // Legacy password reset replaced by ChangePasswordModal

  const handleLogoutAll = async () => {
    if (!supabaseBrowser) return;
    setSecurityLoading(true);
    setSecurityMessage('');
    try {
      await supabaseBrowser.auth.signOut({ scope: 'global' });
      router.replace('/login');
    } catch (err) {
      console.warn('Erro ao terminar sessoes.', err);
      setSecurityMessage('Não foi possível terminar todas as sessões.');
      setSecurityStatus('error');
      setSecurityLoading(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle: string }) => (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-garabandal-gold/10 flex items-center justify-center flex-shrink-0 text-garabandal-dark">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-serif text-lg font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );

  const Field = ({ label, value }: { label: string, value?: string | null }) => (
    <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</label>
      <div className="text-sm font-medium text-gray-900 truncate">{value || '—'}</div>
    </div>
  );

  const HeroSection = () => (
    <div className="relative w-full h-80 rounded-3xl overflow-hidden mb-8 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-garabandal-dark via-slate-900 to-garabandal-gold/20">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="relative group">
          <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-garabandal-gold to-yellow-600 shadow-2xl">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border-4 border-slate-900">
              {profileDisplay.avatar_url ? (
                <img src={profileDisplay.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-4xl text-garabandal-gold">{profileDisplay.nome?.charAt(0) || currentEmail.charAt(0)}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="absolute bottom-0 right-0 p-2.5 bg-white text-garabandal-dark rounded-full shadow-lg hover:bg-gray-100 transition-transform hover:scale-110 active:scale-95"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h2 className="font-serif text-3xl font-bold text-white mb-1">{profileDisplay.nome || 'Utilizador'}</h2>
          {profileDisplay.is_membro ? (
            <p className="text-garabandal-gold font-medium tracking-wide uppercase text-xs">
              Membro • Nº {profileDisplay.numero_socio || '---'}
            </p>
          ) : (
            <p className="text-slate-400 font-medium tracking-wide uppercase text-xs">
              Utilizador Registado
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardShell
      title="O Meu Perfil"
      subtitle="Gere a tua identidade e preferências na comunidade."
    >


      <ChangePasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      <ChangeEmailModal
        visible={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        currentEmail={currentEmail}
        onRequested={refreshMemberData}
      />

      <MemberProfileModal
        visible={showProfile}
        userId={user?.id || ''}
        initialData={profileDisplay}
        currentEmail={currentEmail}
        onClose={() => setShowProfile(false)}
        onSaved={async () => {
          await refreshMemberData();
          setShowProfile(false);
        }}
        onAvatarUpdated={refreshMemberData}
      />

      <HeroSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Personal Data */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Desktop edit button hidden for standard users, visible on hover */}
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-garabandal-gold/10 flex items-center justify-center flex-shrink-0 text-garabandal-dark">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-gray-900">Dados Pessoais</h3>
                  <p className="text-sm text-gray-500">A tua identificação na plataforma.</p>
                </div>
              </div>

              <button
                onClick={() => setShowProfile(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <Field label="Nome" value={profileDisplay.nome} />
              <Field label="Email" value={currentEmail || profileDisplay.email} />
              <Field label="Telefone" value={profileDisplay.telefone} />
              <Field label="NIF / CPF" value={profileDisplay.nif} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-garabandal-gold/10 flex items-center justify-center flex-shrink-0 text-garabandal-dark">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-gray-900">Morada de Envio</h3>
                  <p className="text-sm text-gray-500">Para onde enviamos as encomendas.</p>
                </div>
              </div>

              <button
                onClick={() => setShowProfile(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="sm:col-span-2">
                <Field label="Endereço" value={profileDisplay.address} />
              </div>
              <Field label="Código Postal / CEP" value={profileDisplay.postal_code} />
              <Field label="País" value={profileDisplay.country} />
            </div>
          </div>
        </div >

        {/* Right Column - Security & Actions */}
        < div className="space-y-6" >
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <SectionHeader icon={Shield} title="Segurança" subtitle="Protege a tua conta." />

            <div className="space-y-3 mt-6">
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={securityLoading}
                className="w-full flex items-center justify-between px-4 py-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-sm font-bold text-gray-800 group border border-gray-200"
              >
                <span className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-500 group-hover:text-garabandal-gold" /> Alterar Email</span>
              </button>

              <button
                onClick={() => setShowPasswordModal(true)}
                disabled={securityLoading}
                className="w-full flex items-center justify-between px-4 py-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-sm font-bold text-gray-800 group border border-gray-200"
              >
                <span className="flex items-center gap-3"><KeyRound className="w-5 h-5 text-gray-500 group-hover:text-garabandal-gold" /> Alterar Password</span>
              </button>

              <button
                onClick={handleLogoutAll}
                disabled={securityLoading}
                className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-sm font-medium text-red-600 group"
              >
                <span className="flex items-center gap-3"><LogOut className="w-4 h-4" /> Terminar Sessões</span>
              </button>
            </div>

            {securityMessage && (
              <div className={`mt-4 p-3 rounded-lg text-xs font-bold flex items-start gap-2 ${securityStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {securityStatus === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Shield className="w-4 h-4 shrink-0" />}
                {securityMessage}
              </div>
            )}
          </div>
        </div >
      </div >
    </DashboardShell >
  );

}
