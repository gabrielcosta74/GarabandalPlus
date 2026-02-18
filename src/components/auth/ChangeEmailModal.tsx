import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentEmail?: string | null;
  onRequested?: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailModal({ visible, onClose, currentEmail, onRequested }: Props) {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setNewEmail('');
      setConfirmEmail('');
      setError(null);
      setSuccessMessage(null);
      setLoading(false);
    }
  }, [visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccessMessage(null);

    const normalizedCurrent = (currentEmail || '').trim().toLowerCase();
    const normalizedNew = newEmail.trim().toLowerCase();
    const normalizedConfirm = confirmEmail.trim().toLowerCase();

    if (!normalizedNew || !EMAIL_REGEX.test(normalizedNew)) {
      setError('Indica um novo email válido.');
      return;
    }

    if (normalizedNew !== normalizedConfirm) {
      setError('A confirmação do email não coincide.');
      return;
    }

    if (normalizedCurrent && normalizedNew === normalizedCurrent) {
      setError('O novo email é igual ao atual.');
      return;
    }

    if (!supabaseBrowser) {
      setError('Cliente de autenticação indisponível.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth-callback?next=/account/profile`;
      const { error: updateError } = await supabaseBrowser.auth.updateUser(
        { email: normalizedNew },
        { emailRedirectTo: redirectTo }
      );

      if (updateError) throw updateError;

      setSuccessMessage('Pedido enviado. Confirma o novo email no link recebido para concluir a alteração.');
      onRequested?.();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Não foi possível iniciar a alteração de email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-garabandal-mist/90 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
          >
            <div className="p-6 sm:p-8">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-full bg-garabandal-gold/10 flex items-center justify-center mb-4 text-garabandal-dark mx-auto">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-garabandal-dark text-center mb-2">Alterar Email</h2>
              <p className="text-gray-500 text-sm text-center mb-6">
                Vais receber um email de confirmação para concluir a alteração.
              </p>

              {currentEmail && (
                <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  Email atual: <span className="font-semibold text-gray-800">{currentEmail}</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}

              {successMessage ? (
                <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                      Novo Email
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full rounded-xl border-gray-200 bg-gray-50/50 py-3 px-4 text-gray-900 focus:bg-white focus:border-garabandal-gold focus:ring-garabandal-gold/20 transition-all outline-none md:text-sm"
                      placeholder="novo-email@exemplo.com"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 ml-1">
                      Confirmar Novo Email
                    </label>
                    <input
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      className="w-full rounded-xl border-gray-200 bg-gray-50/50 py-3 px-4 text-gray-900 focus:bg-white focus:border-garabandal-gold focus:ring-garabandal-gold/20 transition-all outline-none md:text-sm"
                      placeholder="novo-email@exemplo.com"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 h-12 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !newEmail || !confirmEmail}
                      className="flex-1 h-12 bg-garabandal-dark text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
