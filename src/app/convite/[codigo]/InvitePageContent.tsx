"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Gift, Heart, UserPlus, Church, HandHeart, BookOpen } from "lucide-react";
import { DynamicReward } from "../../../components/store/DynamicReward";
import { captureAnalyticsEvent } from "../../../lib/analytics";

interface InvitePageContentProps {
  firstName: string;
  avatarUrl: string | null;
  codigo: string;
  isEn: boolean;
}

export default function InvitePageContent({
  firstName,
  avatarUrl,
  codigo,
  isEn,
}: InvitePageContentProps) {
  const becomeMemberHref = isEn
    ? `/en/become-member?ref=${codigo}`
    : `/tornar-membro?ref=${codigo}`;

  useEffect(() => {
    captureAnalyticsEvent('invite_landing_viewed', {
      area: 'referral',
      locale: isEn ? 'en' : 'pt',
      has_referral_code: Boolean(codigo),
      is_valid_invite: true,
    });
  }, [codigo, isEn]);

  const handleAcceptInvite = () => {
    captureAnalyticsEvent('invite_accept_clicked', {
      area: 'referral',
      locale: isEn ? 'en' : 'pt',
      has_referral_code: Boolean(codigo),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-20 px-4">
      <div className="max-w-xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden text-center relative">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-garabandal-dark to-slate-900" />

          <div className="relative pt-20 px-8 pb-12">
            {/* Avatar */}
            <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-white shadow-lg mx-auto mb-6 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl text-garabandal-gold font-serif">
                  {firstName.charAt(0)}
                </span>
              )}
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              <Gift className="w-4 h-4" />
              {isEn ? "Special Invitation" : "Convite Especial"}
            </div>

            <h1 className="text-4xl sm:text-5xl font-serif text-slate-900 mb-6 leading-tight">
              {isEn
                ? `${firstName} invited you to our Mission.`
                : `O ${firstName} convidou-te para a nossa Missão.`}
            </h1>

            <p className="text-slate-600 text-lg mb-8 leading-relaxed max-w-sm mx-auto">
              {isEn ? (
                <>
                  The Garabandal Apostolate welcomes you with great joy. Accept
                  this invitation to join a community that prays, learns, and
                  helps build the Welcome House for pilgrims.
                </>
              ) : (
                <>
                  O Apostolado de Garabandal acolhe-te com muita alegria.
                  Aceita este convite para entrares numa comunidade que reza,
                  se forma e ajuda a levantar a Casa de Acolhimento para
                  peregrinos.
                </>
              )}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8 text-left">
              {[
                {
                  icon: Church,
                  label: isEn ? 'Prayer' : 'Oração',
                },
                {
                  icon: BookOpen,
                  label: isEn ? 'Formation' : 'Formação',
                },
                {
                  icon: HandHeart,
                  label: isEn ? 'Mission' : 'Missão',
                },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="px-2 py-2 text-center">
                  <Icon className="w-5 h-5 mx-auto mb-2 text-garabandal-gold" />
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Link
                href={becomeMemberHref}
                onClick={handleAcceptInvite}
                className="w-full bg-yellow-500 text-slate-900 font-bold py-4 px-6 rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 text-lg"
              >
                <UserPlus className="w-5 h-5" />
                {isEn
                  ? `Accept ${firstName}'s Invitation`
                  : `Aceitar Convite do ${firstName}`}
              </Link>
            </div>
          </div>

          {/* Footnote */}
          <div className="bg-slate-50 border-t border-slate-100 py-6 px-8 text-sm text-slate-500">
            {isEn ? (
              <>
                As a welcome thank you, <DynamicReward amount={2.5} /> in store
                credit becomes available after your first membership fee is
                confirmed.
              </>
            ) : (
              <>
                Como agradecimento de boas-vindas, <DynamicReward amount={2.5} /> de
                saldo para a loja fica disponível depois da primeira quota de
                membro ser confirmada.
              </>
            )}
          </div>
        </div>

        <div className="mt-8 text-center flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Heart className="w-4 h-4" />
          {isEn ? "Made with devotion." : "Feito com devoção."}
        </div>
      </div>
    </div>
  );
}
