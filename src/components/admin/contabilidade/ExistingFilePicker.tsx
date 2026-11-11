"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { FileText, Link2, LoaderCircle, Search, X } from 'lucide-react';

import { formatDay, formatEur } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { BADGE, IconButton, cx } from './ui';

type PickFile = {
  id: string; fileName: string; kindLabel: string; folderPath: string[];
  links: Array<{ type: string; targetId: string; movement: { date: string; who: string; amount: number } | null }>;
};

/**
 * From a movement: pick a file that is already in the folders (the imported
 * archive, an earlier upload) instead of uploading it again. Files still
 * waiting for a movement are listed first.
 */
export default function ExistingFilePicker({ open, movementId, onClose, onLinked }: {
  open: boolean; movementId: string; onClose: () => void; onLinked: (fileName: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<PickFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (open) setQuery(''); }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setFiles(null);
    const q = query.trim();
    const url = q.length >= 2
      ? `/api/admin/contabilidade/ficheiros?view=search&q=${encodeURIComponent(q)}`
      : '/api/admin/contabilidade/ficheiros?view=unlinked';
    const timer = window.setTimeout(() => {
      adminFetch(url)
        .then((result: { files: PickFile[] }) => { if (active) { setFiles(result.files.slice(0, 150)); setError(null); } })
        .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível ler os ficheiros.'); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, query]);

  const pick = async (file: PickFile) => {
    setBusy(file.id);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/ficheiros/${file.id}/ligacoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bank_transaction', targetId: movementId }),
      });
      await onLinked(file.fileName);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Não foi possível ligar o ficheiro.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <DialogBackdrop transition className="fixed inset-0 bg-zinc-950/25 transition-opacity duration-200 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel transition className="lg-float flex max-h-[85vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-[24px] transition duration-200 data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:rounded-[24px]">
          <header className="flex items-start gap-3 px-5 pb-2 pt-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold tracking-[-0.01em] text-zinc-900">Escolher um ficheiro das pastas</DialogTitle>
              <p className="mt-0.5 text-[12.5px] text-zinc-500">O ficheiro fica na pasta onde está e passa a justificar também este movimento.</p>
            </div>
            <IconButton label="Fechar" onClick={onClose} className="-mr-1.5"><X className="h-[18px] w-[18px]" aria-hidden /></IconButton>
          </header>
          <div className="px-5">
            <label className="relative block">
              <span className="sr-only">Procurar ficheiro</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Procure pelo nome do ficheiro ou do fornecedor"
                className="lg-pill h-10 w-full rounded-full pl-9 pr-3 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15"
              />
            </label>
            <p className="mb-1 mt-3 text-[12.5px] font-medium text-zinc-500">{query.trim().length >= 2 ? 'Ficheiros encontrados' : 'Ficheiros ainda por ligar'}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {error && <p className="mx-2 rounded-2xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
            {!files ? <p className="flex items-center gap-2 px-2 py-6 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A procurar…</p>
              : !files.length ? <p className="px-2 py-6 text-center text-[13px] text-zinc-500">Nenhum ficheiro encontrado.</p>
                : (
                  <ul>
                    {files.map(file => {
                      const already = file.links.some(link => link.type === 'bank_transaction' && link.targetId === movementId);
                      const first = file.links.find(link => link.movement)?.movement;
                      return (
                        <li key={file.id}>
                          <button
                            type="button"
                            disabled={already || !!busy}
                            onClick={() => void pick(file)}
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left outline-none hover:bg-zinc-900/[0.03] focus-visible:bg-zinc-900/[0.05] disabled:opacity-60"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-zinc-900">{file.fileName}</span>
                              <span className="block truncate text-[12px] text-zinc-500">{file.kindLabel} · {file.folderPath.join(' / ') || 'Sem pasta'}</span>
                            </span>
                            {already ? <span className={cx(BADGE, 'h-6 bg-emerald-50 px-2.5 text-[12px] text-emerald-800')}>Já ligado</span>
                              : first ? <span className={cx(BADGE, 'h-6 bg-zinc-900/[0.06] px-2.5 text-[12px] text-zinc-600')} title="Já justifica outro movimento"><Link2 className="h-3 w-3" aria-hidden /> {formatDay(first.date)} · {formatEur(first.amount)}</span>
                                : <span className={cx(BADGE, 'h-6 bg-amber-100 px-2.5 text-[12px] text-amber-800')}>Por ligar</span>}
                            {busy === file.id && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
