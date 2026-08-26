'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';

type SignupResponse = {
  success?: boolean;
  alreadyRegistered?: boolean;
  whatsappUrl?: string | null;
  error?: string;
};

export default function EarlyAccessSignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    setError('');
    setStatus('submitting');
    const startedAt = Date.now();

    try {
      const response = await fetch('/api/early-access-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, website, locale: 'pt' }),
      });
      const data = (await response.json()) as SignupResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível concluir o registo.');
      }

      const remainingDelay = 650 - (Date.now() - startedAt);
      if (remainingDelay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
      }

      window.sessionStorage.setItem(
        'early-access-confirmation',
        JSON.stringify({
          email,
          whatsappUrl: data.whatsappUrl || null,
          alreadyRegistered: Boolean(data.alreadyRegistered),
        }),
      );
      router.push('/acesso-antecipado/confirmado');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível concluir o registo.');
      setStatus('idle');
    }
  }

  if (status === 'submitting') {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500" aria-live="polite">
        <div className="relative h-14 w-14 rounded-full border border-[#bca56b]/20">
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#f0cc70] border-r-[#c6a34b] animate-spin" />
          <span className="absolute inset-[9px] rounded-full border border-[#bca56b]/25" />
        </div>
        <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d4bc7d]">A confirmar o seu acesso</p>
        <p className="mt-3 text-sm text-white/45">Só um instante.</p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="early-email" className="mb-2.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
          O seu email
        </label>
        <input
          id="early-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-14 w-full rounded-2xl border border-white/20 bg-white/[0.055] px-5 text-center text-base text-white outline-none transition placeholder:text-white/32 hover:border-white/30 focus:border-[#bca56b]/80 focus:bg-white/[0.08] focus:ring-4 focus:ring-[#bca56b]/10"
          placeholder="nome@exemplo.com"
        />
      </div>

      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="early-website">Website</label>
        <input id="early-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>

      <label className="mx-auto flex max-w-sm cursor-pointer items-start justify-center gap-3 text-left text-[11px] leading-[1.55] text-white/45">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#bca56b]"
        />
        <span>Aceito receber informação sobre esta peregrinação e o acesso antecipado.</span>
      </label>

      {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}

        <button
          type="submit"
          className="inline-flex min-h-13 w-full items-center justify-between rounded-full bg-[#f4f1e9] px-5 py-3.5 text-sm font-semibold text-[#080808] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-wait disabled:opacity-60"
      >
        <span>Ter acesso antecipado</span>
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </button>

      <p className="text-center text-[10px] leading-4 text-white/25">Prioridade de acesso. Não garante vaga.</p>
    </form>
  );
}
