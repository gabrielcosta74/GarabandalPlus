"use client";

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900/[0.06] text-[11px] font-semibold tabular-nums text-zinc-600" aria-hidden>{n}</span>
      <div>
        <p className="text-[13px] font-semibold text-zinc-900">{title}</p>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-600">{children}</div>
      </div>
    </div>
  );
}

/** What the admin does with each kind of line. One click away, never in the way. */
export default function AdminGuide({ issuing }: { issuing: boolean }) {
  return (
    <Popover className="relative">
      <PopoverButton
        aria-label="Como tratar os movimentos"
        title="Como tratar os movimentos"
        className="lg-pill flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 outline-none transition-[color,transform] duration-150 ease-out hover:text-zinc-900 active:scale-90 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15 data-[open]:text-zinc-950"
      >
        <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor={{ to: 'bottom end', gap: 8 }}
        className="lg-float z-50 w-[min(40rem,calc(100vw-2rem))] origin-top-right rounded-[24px] p-6 transition duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">Como tratar os movimentos</p>
        <p className="mt-0.5 text-[12.5px] text-zinc-500">Cada movimento precisa de um motivo e do seu documento.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Step n="1" title="Com FR já encontrada">
            Confira o nome e o valor e aprove. Não emite nada, só associa.
          </Step>
          <Step n="2" title="Peregrinação por transferência">
            Abra o movimento e escolha a reserva, mesmo que outra pessoa tenha pago. A FR sai sozinha.
          </Step>
          <Step n="3" title="Doação por transferência">
            {issuing
              ? 'Abra o movimento e emita a FR aqui. Sem dados da pessoa, até 100 € pode sair como Consumidor final.'
              : 'Emita a FR na FACT.pt, como sempre. O sistema encontra-a e só falta aprovar.'}
          </Step>
          <Step n="4" title="Quota ou loja">
            Emita a FR na FACT.pt. Se o sistema não a encontrar, escreva o número no movimento.
          </Step>
          <Step n="5" title="Despesas">
            Anexe o PDF ou a fotografia da fatura. Se só existir em papel, marque «Fatura em papel».
          </Step>
        </div>
        <div className="mt-5 rounded-2xl bg-zinc-900/[0.05] px-4 py-3 text-[12.5px] leading-relaxed text-zinc-600">
          <span className="font-semibold text-orange-500">Regra de ouro:</span> cada pagamento tem uma só FR — nunca a emita nos dois sítios.
          «FR a ser emitida» → espere. «FR falhou» → vá a Faturação antes de emitir outra.
        </div>
      </PopoverPanel>
    </Popover>
  );
}
