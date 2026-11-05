"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';

import { Card, cx } from './ui';

const STORAGE_KEY = 'ledger:guide:closed';

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <div className="mt-1 space-y-1 text-[13px] leading-relaxed text-zinc-600">{children}</div>
    </div>
  );
}

/** What the admin does with each kind of line, in the order the page shows them. */
export default function AdminGuide({ issuing }: { issuing: boolean }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') setOpen(false);
    } catch {
      // Blocked storage: the guide just stays open.
    }
  }, []);
  const toggle = () => {
    setOpen(previous => {
      try {
        window.localStorage.setItem(STORAGE_KEY, previous ? '1' : '0');
      } catch {
        // Only a convenience.
      }
      return !previous;
    });
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-zinc-50">
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600" aria-hidden>
            <BookOpen className="h-[18px] w-[18px]" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-zinc-900">Como tratar os movimentos</span>
            <span className="block text-[13px] text-zinc-500">Cada movimento precisa de um motivo e da sua fatura ou documento. Assim o mês fecha certo.</span>
          </span>
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="overflow-hidden">
            <div className="grid gap-5 border-t border-zinc-100 px-5 py-5 sm:grid-cols-2">
              <Step title="1. Com FR já encontrada">
                <p>Confira o nome e o valor e carregue em Aprovar. Não emite nada, só associa.</p>
              </Step>
              <Step title="2. Peregrinação por transferência">
                <p>Registe o pagamento na página da peregrinação, como sempre. A app emite a FR e o movimento liga-se sozinho.</p>
                <p>Se outra pessoa pagou pelo peregrino, aparece como «Provável»: abra o movimento e escolha a reserva.</p>
              </Step>
              <Step title="3. Doação por transferência">
                {issuing
                  ? <p>Abra o movimento e use «Emitir pela app». Sem dados da pessoa, até 100 € pode sair como Consumidor final; acima disso, peça os dados à pessoa.</p>
                  : <p>Emita a FR na FACT.pt, como sempre.</p>}
                <p>Se a emitir na FACT.pt, o sistema encontra-a na atualização seguinte e só falta aprovar.</p>
              </Step>
              <Step title="4. Quota ou loja">
                <p>Emita a FR na FACT.pt, como sempre. O sistema encontra-a na atualização seguinte; se não a encontrar, escreva o número no movimento.</p>
              </Step>
              <Step title="5. Despesas">
                <p>Escolha o que é e marque a fatura em papel, se a tiver guardada no dossier.</p>
              </Step>
              <Step title="A regra mais importante">
                <p>Cada pagamento tem uma só FR: nunca a emita nos dois sítios. Se vir «FR a ser emitida», espere. Se vir «FR falhou», vá a Faturação antes de emitir outra.</p>
              </Step>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
