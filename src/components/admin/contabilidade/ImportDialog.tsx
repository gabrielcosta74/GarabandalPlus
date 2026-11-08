"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useRef, useState, type DragEvent } from 'react';
import { Check, FileSpreadsheet, LoaderCircle, TriangleAlert, Upload, X } from 'lucide-react';

import { formatDay } from '../../../lib/ledger/format';
import { previewRowToMovement, type StatementPreview } from './types';
import { adminFetch, clearStoredPreview, storePreview, type StoredPreview } from './useLedger';
import { Card as Panel, cx } from './ui';

const buttonPrimary = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-600/40';
const buttonSecondary = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50';

type Phase =
  | { name: 'idle' }
  | { name: 'reading'; fileName: string }
  | { name: 'ready'; file: File; preview: StatementPreview; dbReady: boolean; alreadyImportedAt: string | null }
  | { name: 'saving'; file: File; preview: StatementPreview }
  | { name: 'saved'; rowsNew: number; rowsDuplicate: number; periodTo: string | null }
  | { name: 'error'; message: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Preview mode: show the statement in the page without saving it. */
  onPreview: (preview: StoredPreview) => void;
  /** The statement was saved; reload the page data. */
  onImported: () => void;
};

export default function ImportDialog({ open, onClose, onPreview, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dragging, setDragging] = useState(false);

  const readFile = async (file: File) => {
    setPhase({ name: 'reading', fileName: file.name });
    try {
      const form = new FormData();
      form.append('file', file);
      const body = await adminFetch('/api/admin/contabilidade/importar/pre-visualizar', { method: 'POST', body: form });
      setPhase({ name: 'ready', file, preview: body.preview, dbReady: !!body.dbReady, alreadyImportedAt: body.alreadyImportedAt });
    } catch (error) {
      setPhase({ name: 'error', message: error instanceof Error ? error.message : 'Não foi possível ler o ficheiro.' });
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const openPreview = (preview: StatementPreview) => {
    const stored: StoredPreview = {
      fileName: preview.fileName,
      createdAt: new Date().toISOString(),
      balanceOk: preview.balanceOk,
      movements: preview.rows.map(previewRowToMovement),
    };
    storePreview(stored);
    onPreview(stored);
    close();
  };

  const confirmImport = async (file: File, preview: StatementPreview) => {
    setPhase({ name: 'saving', file, preview });
    try {
      const form = new FormData();
      form.append('file', file);
      const body = await adminFetch('/api/admin/contabilidade/importar', { method: 'POST', body: form });
      clearStoredPreview();
      setPhase({ name: 'saved', rowsNew: body.rows_new, rowsDuplicate: body.rows_duplicate, periodTo: body.periodTo });
      onImported();
    } catch (error) {
      setPhase({ name: 'error', message: error instanceof Error ? error.message : 'Não foi possível importar.' });
    }
  };

  const reset = () => {
    setPhase({ name: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (phase.name === 'reading' || phase.name === 'saving') return;
    onClose();
    // Let the closing transition finish before clearing the content.
    window.setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-zinc-950/25 backdrop-blur-[3px] transition-opacity duration-300 ease-out data-[closed]:opacity-0" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center px-4 py-10 sm:py-16">
          <DialogPanel transition className="w-full max-w-xl rounded-3xl bg-zinc-50 p-6 shadow-2xl shadow-zinc-900/10 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[closed]:translate-y-4 data-[closed]:scale-[0.98] data-[closed]:opacity-0">
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-zinc-900">Importar extrato</DialogTitle>
              <button type="button" onClick={close} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
        }}
      />

      {(phase.name === 'idle' || phase.name === 'error') && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={event => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center transition-colors',
              dragging ? 'border-zinc-500 bg-zinc-50' : 'border-zinc-300 bg-white hover:border-zinc-400',
            )}
          >
            <Upload className="h-6 w-6 text-zinc-400" aria-hidden />
            <span className="text-base font-medium text-zinc-900">Arraste o extrato do Montepio para aqui</span>
            <span className="text-sm text-zinc-500">ou clique para escolher · Excel (.xlsx) ou CSV · até 10 MB</span>
          </button>
          {phase.name === 'error' && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{phase.message}</span>
            </div>
          )}
          <Panel className="px-5 py-4">
            <p className="text-sm font-medium text-zinc-900">Como exportar do Montepio Net</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
              <li>Entre na conta da associação e abra os movimentos da conta à ordem.</li>
              <li>Escolha o período (por exemplo, desde o último extrato importado até hoje).</li>
              <li>Exporte em Excel ou CSV e carregue o ficheiro aqui.</li>
            </ol>
            <p className="mt-2 text-sm text-zinc-500">
              Pode repetir dias já importados: as linhas que já existem são reconhecidas e não entram duas vezes.
            </p>
          </Panel>
        </>
      )}

      {phase.name === 'reading' && (
        <Panel className="flex items-center gap-3 px-5 py-6 text-sm text-zinc-600">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          A ler «{phase.fileName}»…
        </Panel>
      )}

      {(phase.name === 'ready' || phase.name === 'saving') && (
        <PreviewReceipt
          preview={phase.preview}
          dbReady={phase.name === 'ready' ? phase.dbReady : true}
          alreadyImportedAt={phase.name === 'ready' ? phase.alreadyImportedAt : null}
          saving={phase.name === 'saving'}
          onCancel={reset}
          onOpenPreview={() => openPreview(phase.preview)}
          onConfirm={() => void confirmImport(phase.file, phase.preview)}
        />
      )}

      {phase.name === 'saved' && (
        <Panel className="px-5 py-6">
          <p className="flex items-center gap-2 text-base font-medium text-zinc-900">
            <Check className="h-5 w-5 text-emerald-600" aria-hidden />
            Extrato importado
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {phase.rowsNew} movimentos novos
            {phase.rowsDuplicate > 0 ? ` · ${phase.rowsDuplicate} já existiam e não foram duplicados` : ''}.
          </p>
          <div className="mt-5 flex gap-2">
            <button type="button" className={buttonPrimary} onClick={close}>
              Ver movimentos
            </button>
            <button type="button" className={buttonSecondary} onClick={reset}>Importar outro</button>
          </div>
        </Panel>
      )}
    </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function PreviewReceipt({
  preview,
  dbReady,
  alreadyImportedAt,
  saving,
  onCancel,
  onOpenPreview,
  onConfirm,
}: {
  preview: StatementPreview;
  dbReady: boolean;
  alreadyImportedAt: string | null;
  saving: boolean;
  onCancel: () => void;
  onOpenPreview: () => void;
  onConfirm: () => void;
}) {
  const gaps = preview.warnings.filter(warning => warning.code === 'balance_gap');
  const skipped = preview.warnings.filter(warning => warning.code !== 'balance_gap');
  const confident = preview.rows.filter(row => row.categoryCode).length;
  const guessed = preview.rows.length - confident;

  const lines: { label: string; value: string; tone?: 'ok' | 'bad' | 'muted' }[] = [
    { label: 'Período', value: `${formatDay(preview.periodFrom, true)} a ${formatDay(preview.periodTo, true)}` },
    { label: 'Movimentos no ficheiro', value: String(preview.counts.total) },
    { label: 'Novos', value: String(preview.counts.new) },
    { label: 'Já importados', value: String(preview.counts.duplicate), tone: 'muted' },
    {
      label: 'Saldo encadeado',
      value: preview.balanceOk === null ? 'Sem saldos no ficheiro' : preview.balanceOk ? 'Confere' : `Não confere em ${gaps.length} ${gaps.length === 1 ? 'linha' : 'linhas'}`,
      tone: preview.balanceOk === false ? 'bad' : preview.balanceOk ? 'ok' : 'muted',
    },
    { label: 'Categoria certa', value: String(confident) },
    { label: 'Com sugestão para confirmar', value: String(guessed) },
  ];
  if (skipped.length) lines.push({ label: 'Linhas ignoradas', value: String(skipped.length), tone: 'muted' });

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-zinc-400" aria-hidden />
          <div>
            <p className="text-base font-medium text-zinc-900">{preview.fileName}</p>
            <p className="text-sm text-zinc-500">
              {preview.source === 'xlsx' ? 'Excel' : 'CSV'}
              {preview.sheetName ? ` · folha «${preview.sheetName}»` : ''}
            </p>
          </div>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="divide-y divide-zinc-100 px-5">
        {lines.map(line => (
          <div key={line.label} className="flex items-center justify-between py-2.5 text-sm">
            <dt className="text-zinc-600">{line.label}</dt>
            <dd
              className={cx(
                'font-medium tabular-nums',
                line.tone === 'bad' ? 'text-rose-700' : line.tone === 'ok' ? 'text-emerald-700' : line.tone === 'muted' ? 'text-zinc-500' : 'text-zinc-900',
              )}
            >
              {line.value}
            </dd>
          </div>
        ))}
      </dl>

      {alreadyImportedAt && (
        <p className="mx-5 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Este mesmo ficheiro já foi importado a {formatDay(alreadyImportedAt.slice(0, 10), true)}.
        </p>
      )}

      {gaps.length > 0 && (
        <div className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <p className="font-medium">O saldo não encadeia — pode faltar ou estar alterada alguma linha.</p>
          <ul className="mt-1 space-y-0.5">
            {gaps.slice(0, 8).map(gap => <li key={gap.sourceRow}>{gap.message}</li>)}
          </ul>
          {gaps.length > 8 && <p className="mt-1">… e mais {gaps.length - 8}.</p>}
        </div>
      )}

      {skipped.length > 0 && (
        <details className="mx-5 mb-3 text-sm text-zinc-600">
          <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-700">
            Ver {skipped.length} {skipped.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}
          </summary>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {skipped.map(warning => <li key={`${warning.code}-${warning.sourceRow}`}>{warning.message}</li>)}
          </ul>
        </details>
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {dbReady ? (
          <>
            <p className="text-sm text-zinc-500">Nada é alterado no site nem na faturação ao importar.</p>
            <button type="button" className={buttonPrimary} disabled={saving || preview.counts.new === 0} onClick={onConfirm}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {preview.counts.new === 0 ? 'Nada de novo para importar' : `Confirmar importação (${preview.counts.new})`}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500">A importação fica disponível quando as tabelas forem criadas.</p>
            <button type="button" className={buttonPrimary} onClick={onOpenPreview}>
              Ver como fica
            </button>
          </>
        )}
      </div>
    </Panel>
  );
}
