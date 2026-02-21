"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import {
  Gift,
  Share2,
  Copy,
  CheckCircle2,
  Wallet,
  Info,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "../providers/CurrencyProvider";

type ReferralWidgetProps = {
  userId: string;
  nome: string | null;
  initialCode: string | null;
  initialCredits: number | null;
  initialCount: number | null;
};

export default function ReferralWidget({
  userId,
  nome,
  initialCode,
  initialCredits,
  initialCount,
}: ReferralWidgetProps) {
  const [referralCode, setReferralCode] = useState<string | null>(initialCode);
  const [storeCredits] = useState<number>(initialCredits || 0);
  const [referralsCount] = useState<number>(initialCount || 0);
  const [isGenerating, setIsGenerating] = useState(!initialCode);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWidgetCode, setCopiedWidgetCode] = useState(false);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const ensureReferralCode = async () => {
      if (initialCode || !userId) {
        setIsGenerating(false);
        return;
      }

      try {
        const firstName = nome
          ? nome
            .split(" ")[0]
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
          : "MEMBRO";
        const randomStr = Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase();
        const newCode = `${firstName}-${randomStr}`;

        const { error } = await supabaseBrowser
          .from("membros")
          .update({ referral_code: newCode })
          .eq("id", userId);

        if (!error) {
          setReferralCode(newCode);
        }
      } catch (err) {
        console.error("Failed to generate referral code", err);
      } finally {
        setIsGenerating(false);
      }
    };

    ensureReferralCode();
  }, [initialCode, userId, nome]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/convite/${referralCode}`
      : "";
  const shareText = `Olá! 👋 Faço parte do *Apostolado de Garabandal* e convido-te a conhecer a nossa missão. 🕊️✨\n\nAo registares-te como Membro através do meu convite, ajudas a apoiar a missão e as obras da nova Casa de Acolhimento do Apostolado. 🙏\n\nComo agradecimento, ganhas de imediato *${formatPrice(2.50)} de saldo de boas-vindas* para usares na nossa Loja Online. 🎁\n\nJunta-te a nós aqui:`;

  const handleShare = async () => {
    if (!referralCode) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Apostolado de Garabandal",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fallback to modal
      }
    }

    // Fallback: Open explicit desktop share modal
    setIsShareModalOpen(true);
  };

  return (
    <>
      <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden group">
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Left side: Balance & Stats */}
        <div className="flex items-center gap-4 w-full sm:w-auto relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-full flex items-center justify-center border border-yellow-500/30 shrink-0 shadow-inner">
            <Wallet className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Saldo da Loja
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 text-[10px] text-yellow-500 hover:text-yellow-400 transition-colors bg-yellow-500/10 px-1.5 py-0.5 rounded cursor-pointer"
              >
                <Info className="w-3 h-3" />
                <span>Como funciona?</span>
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {formatPrice(storeCredits)}
              </span>
              {referralsCount > 0 && (
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  ({referralsCount} amigos)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Referral Code Display */}
        {!isGenerating && referralCode && (
          <div className="flex flex-col items-center sm:items-start w-full sm:w-auto relative z-10 border-y sm:border-y-0 sm:border-x border-white/5 py-4 sm:py-0 sm:px-8">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">O Teu Código</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralCode);
                setCopiedWidgetCode(true);
                setTimeout(() => setCopiedWidgetCode(false), 3000);
              }}
              className="group/code flex items-center bg-slate-950/50 hover:bg-slate-900 border border-white/10 hover:border-yellow-500/30 rounded-lg p-1 pr-3 transition-colors text-left"
              title="Copiar Código"
            >
              <div className="bg-slate-800 text-white font-mono text-sm px-3 py-1.5 rounded-md font-bold tracking-widest mr-3">
                {referralCode}
              </div>
              <div className="text-slate-400 group-hover/code:text-yellow-500 transition-colors">
                {copiedWidgetCode ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </div>
            </button>
          </div>
        )}

        {/* Right side: Action Button */}
        <div className="w-full sm:w-auto flex flex-col items-center sm:items-end relative z-10">
          <button
            onClick={handleShare}
            disabled={isGenerating || !referralCode}
            className="w-full sm:w-auto px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <span className="animate-pulse flex items-center gap-2">
                <Share2 className="w-4 h-4 opacity-50" />A gerar...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Convidar Amigos
              </span>
            )}
          </button>
        </div>
      </div >

      {/* How it Works Modal */}
      <AnimatePresence>
        {
          isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl max-w-sm w-full relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 to-orange-500" />
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-2xl flex items-center justify-center mb-5">
                  <Gift className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold text-white mb-4">
                  Como funciona o Saldo?
                </h3>
                <div className="space-y-4 mb-6">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                    <p className="text-sm text-slate-300">Partilhas o teu código ou link exclusivo com um amigo.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                    <p className="text-sm text-slate-300">O teu amigo regista-se e finaliza o seu primeiro donativo para apoiar a Missão.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                    <p className="text-sm text-slate-300">
                      <strong>Ganham ambos {formatPrice(2.50)}</strong> creditados na hora nesta carteira virtual!
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10 mt-2">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Podes acumular saldo consoante o número de pessoas que convidares. Todo o valor pode (e deve) ser trocado por artigos, livros ou doações na nossa <strong>Loja Online</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    handleShare();
                  }}
                  className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-yellow-500/20"
                >
                  <Share2 className="w-4 h-4" /> Convidar Amigos Agora
                </button>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* Explicit Share Modal for Desktop/Fallback */}
      <AnimatePresence>
        {
          isShareModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setIsShareModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl max-w-lg w-full relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <h3 className="text-xl font-bold text-white mb-2">
                  Partilhar Convite
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Copia a mensagem abaixo e envia aos teus amigos pelo WhatsApp
                  Web, Email ou Redes Sociais.
                </p>

                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4 mb-6 relative group">
                  <p className="text-sm text-slate-300 font-medium whitespace-pre-wrap">
                    {shareText}\n\n{shareUrl}
                  </p>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${shareText}\n\n${shareUrl}`,
                      );
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 3000);
                    }}
                    className="absolute top-4 right-4 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-2 shadow-lg"
                  >
                    {copiedText ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="text-xs font-bold">
                      {copiedText ? "Copiado!" : "Copiar Texto"}
                    </span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider pl-1">
                    Apenas o Link de Convite
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 3000);
                      }}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 font-bold transition-colors"
                    >
                      {copiedLink ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                      <span className="hidden sm:inline">
                        {copiedLink ? "Copiado" : "Copiar"}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >
    </>
  );
}
