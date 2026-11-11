"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, ExternalLink, FileWarning, LoaderCircle, Mail, X } from 'lucide-react';

import { formatDay, formatEur } from '../../../lib/ledger/format';
import { useToast } from './Toasts';
import { adminFetch } from './useLedger';
import { BADGE, Button, IconButton, cx } from './ui';

export type PreviewDoc = {
  id: string;
  kindLabel: string;
  fileName: string | null;
  mimeType: string | null;
  source: 'email' | 'upload' | 'arquivo';
  docNumber: string | null;
  /** null while the file is not linked to any movement yet. */
  movement: { id: string; date: string; period: string; who: string; amount: number; category: string } | null;
};

/** Signed links last 5 minutes on the server; ask again a little before. */
const LINK_TTL_MS = 4 * 60_000;

/** Word / Excel from the old archive: the browser can't show them, so they download. */
const isOffice = (doc: PreviewDoc) => /officedocument|msword|ms-excel/.test(doc.mimeType || '') || /\.(docx?|xlsx?)$/i.test(doc.fileName || '');

const isImage = (doc: PreviewDoc) => (doc.mimeType || '').startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(doc.fileName || '');

/**
 * The file itself, one click from the list: PDF or photo in a floating sheet,
 * ← → to walk the list, and the way out (download, new tab, the movement).
 */
export default function DocumentPreview({
  docs,
  index,
  onIndex,
  onClose,
  onOpenMovement,
}: {
  docs: PreviewDoc[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  onOpenMovement: (doc: PreviewDoc) => void;
}) {
  const doc = index !== null ? docs[index] ?? null : null;
  const [shown, setShown] = useState<PreviewDoc | null>(doc);
  const [links, setLinks] = useState<Record<string, { url: string; at: number }>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();
  useEffect(() => { if (doc) setShown(doc); }, [doc]);

  const linkFor = useCallback(async (target: PreviewDoc) => {
    const cached = links[target.id];
    if (cached && Date.now() - cached.at < LINK_TTL_MS) return cached.url;
    const { url } = await adminFetch(`/api/admin/contabilidade/documentos/${target.id}`) as { url: string };
    setLinks(prev => ({ ...prev, [target.id]: { url, at: Date.now() } }));
    return url;
  }, [links]);

  const docId = doc?.id;
  useEffect(() => {
    if (!doc) return;
    setFailed(null);
    let active = true;
    linkFor(doc).catch(error => { if (active) setFailed(error instanceof Error ? error.message : 'Não foi possível abrir o ficheiro.'); });
    return () => { active = false; };
    // Only when another document is shown; linkFor changes as links fill in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const step = useCallback((delta: number) => {
    if (index === null || !docs.length) return;
    onIndex((index + delta + docs.length) % docs.length);
  }, [index, docs.length, onIndex]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, step]);

  const view = doc ?? shown;
  const url = view ? links[view.id]?.url : undefined;

  const openOutside = async () => {
    if (!view) return;
    try {
      window.open(await linkFor(view), '_blank', 'noopener');
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível abrir', description: error instanceof Error ? error.message : undefined });
    }
  };

  const download = async () => {
    if (!view) return;
    setDownloading(true);
    try {
      const response = await fetch(await linkFor(view));
      if (!response.ok) throw new Error('O ficheiro não respondeu.');
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = view.fileName || 'documento';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível descarregar', description: error instanceof Error ? error.message : undefined });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={!!doc} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-zinc-950/25 transition-opacity duration-300 ease-out data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex justify-end p-0 sm:p-3">
        <DialogPanel
          transition
          className="lg-float flex h-full w-full max-w-[920px] flex-col overflow-hidden transition duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-[closed]:translate-x-[105%] motion-reduce:data-[closed]:translate-x-0 motion-reduce:data-[closed]:opacity-0 sm:rounded-[24px]"
        >
          {view && (
            <>
              <header className="flex items-start gap-3 px-5 pb-3 pt-4">
                <IconButton label="Fechar" onClick={onClose} className="-ml-1.5">
                  <X className="h-[18px] w-[18px]" aria-hidden />
                </IconButton>
                <div className="min-w-0 flex-1 pt-0.5">
                  <DialogTitle className="truncate text-[16px] font-semibold tracking-[-0.01em] text-zinc-900">{view.movement ? view.movement.who : view.fileName || 'Documento'}</DialogTitle>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-zinc-500">
                    {view.movement ? (
                      <>
                        <span>{formatDay(view.movement.date, true)}</span>
                        <span aria-hidden>·</span>
                        <span className="font-medium tabular-nums text-zinc-700">{formatEur(view.movement.amount)}</span>
                        <span aria-hidden>·</span>
                        <span>{view.movement.category}</span>
                      </>
                    ) : (
                      <span className="font-medium text-amber-700">Ainda não está ligado a nenhum movimento</span>
                    )}
                    <span className={cx(BADGE, 'h-5 bg-zinc-900/[0.06] px-2 text-[11.5px] text-zinc-600')}>{view.kindLabel}</span>
                    {view.source === 'email' && (
                      <span className={cx(BADGE, 'h-5 bg-zinc-900/[0.06] px-2 text-[11.5px] text-zinc-600')}><Mail className="h-3 w-3" aria-hidden /> Email</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {docs.length > 1 && (
                    <>
                      <IconButton label="Anterior (←)" onClick={() => step(-1)}><ChevronLeft className="h-[18px] w-[18px]" aria-hidden /></IconButton>
                      <span className="w-12 text-center text-[12px] tabular-nums text-zinc-400">{(index ?? 0) + 1} / {docs.length}</span>
                      <IconButton label="Seguinte (→)" onClick={() => step(1)}><ChevronRight className="h-[18px] w-[18px]" aria-hidden /></IconButton>
                    </>
                  )}
                </div>
              </header>

              <div className="relative mx-3 flex-1 overflow-hidden rounded-[18px] bg-zinc-900/[0.04] sm:mx-5">
                {failed ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <FileWarning className="h-6 w-6 text-zinc-400" strokeWidth={1.75} aria-hidden />
                    <p className="text-[13px] text-zinc-500">{failed}</p>
                    <Button size="sm" onClick={() => { setFailed(null); void linkFor(view).catch(error => setFailed(error instanceof Error ? error.message : 'Não foi possível abrir o ficheiro.')); }}>Tentar de novo</Button>
                  </div>
                ) : !url ? (
                  <div className="flex h-full items-center justify-center gap-2 text-[13px] text-zinc-500">
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A abrir…
                  </div>
                ) : isOffice(view) ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <FileWarning className="h-6 w-6 text-zinc-400" strokeWidth={1.75} aria-hidden />
                    <p className="text-[13px] text-zinc-500">Ficheiros Word e Excel não se veem aqui. Use &quot;Descarregar&quot;.</p>
                  </div>
                ) : isImage(view) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL from private storage
                  <img key={view.id} src={url} alt={view.fileName || 'Documento'} className="h-full w-full object-contain" />
                ) : (
                  <iframe key={view.id} src={`${url}#view=FitH`} title={view.fileName || 'Documento'} className="h-full w-full" />
                )}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <p className="min-w-0 truncate text-[12.5px] text-zinc-400" title={view.fileName || undefined}>
                  {view.fileName}{view.docNumber && !(view.fileName || '').includes(view.docNumber) ? ` · n.º ${view.docNumber}` : ''}
                </p>
                <div className="flex items-center gap-1.5">
                  {view.movement && (
                    <Button size="sm" variant="ghost" onClick={() => onOpenMovement(view)}>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Ver movimento
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void openOutside()}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Abrir fora
                  </Button>
                  <Button size="sm" variant="primary" disabled={downloading} onClick={() => void download()}>
                    {downloading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
                    Descarregar
                  </Button>
                </div>
              </footer>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
