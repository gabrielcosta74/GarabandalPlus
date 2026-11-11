"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ExternalLink, FileText, FolderOpen, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import ExistingFilePicker from './ExistingFilePicker';

import { DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, MAX_DOCUMENT_BYTES, type DocumentKind } from '../../../lib/ledger/document-rules';
import { shrinkPhoto } from './compress-image';
import { adminFetch } from './useLedger';
import { useToast } from './Toasts';
import { cx } from './ui';

type StoredDocument = {
  id: string; fileName: string | null; sizeBytes: number | null; url: string | null; kind: DocumentKind | null;
  /** With the folders migration: where the file lives and what else it justifies. */
  folderPath?: string[]; otherMovements?: number;
};

const sizeLabel = (bytes: number | null) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '');

/** Sends files one by one; photos are shrunk first. Shared with the quick photo mode. */
export async function uploadExpenseFiles(movementId: string, files: FileList | File[], kind: DocumentKind): Promise<number> {
  let saved = 0;
  for (const original of Array.from(files)) {
    const file = await shrinkPhoto(original);
    if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`${original.name} é demasiado grande (máximo 9 MB).`);
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos`, { method: 'POST', body: form });
    saved += 1;
  }
  return saved;
}

export function KindPicker({ value, onChange, disabled }: { value: DocumentKind; onChange: (kind: DocumentKind) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de documento">
      {DOCUMENT_KINDS.map(kind => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          disabled={disabled}
          onClick={() => onChange(kind)}
          className={cx('rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200',
            value === kind ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}
        >
          {DOCUMENT_KIND_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}

/** The documents behind an expense: what the accountant will read. */
export default function ExpenseDocumentsField({
  movementId,
  disabled,
  onChanged,
}: {
  movementId: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [documents, setDocuments] = useState<StoredDocument[] | null>(null);
  const [kind, setKind] = useState<DocumentKind>('fatura');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foldersReady, setFoldersReady] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const result = await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos`);
    setDocuments(result.documents as StoredDocument[]);
    setFoldersReady(result.ready === true);
  }, [movementId]);

  useEffect(() => {
    setDocuments(null);
    setError(null);
    load().catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Não foi possível ler os documentos.'));
  }, [load]);

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    setError(null);
    let saved = 0;
    try {
      saved = await uploadExpenseFiles(movementId, files, kind);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível guardar o ficheiro.');
    } finally {
      if (saved > 0) {
        await load().catch(() => undefined);
        onChanged();
        toast({ title: saved === 1 ? `${DOCUMENT_KIND_LABELS[kind]} guardado` : `${saved} ficheiros guardados` });
      }
      setBusy(false);
      if (picker.current) picker.current.value = '';
      if (camera.current) camera.current.value = '';
    }
  };

  const changeKind = async (document: StoredDocument, next: DocumentKind) => {
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos/${document.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: next }),
      });
      await load();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Não foi possível mudar o tipo.');
    }
  };

  const remove = async (document: StoredDocument) => {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos/${document.id}`, { method: 'DELETE' }) as { action?: string };
      await load();
      onChanged();
      toast(result.action === 'unlinked'
        ? { tone: 'info', title: 'Tirado deste movimento', description: 'O ficheiro continua guardado em Documentos.' }
        : { tone: 'info', title: 'Documento removido' });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Não foi possível remover o documento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {documents?.map(document => (
        <div key={document.id} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <FileText className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate" title={document.fileName || undefined}>{document.fileName || 'Documento'}</span>
            {(!!document.folderPath?.length || !!document.otherMovements) && (
              <span className="block truncate text-[11.5px] text-emerald-700/80">
                {[document.folderPath?.length ? `Pasta: ${document.folderPath.join(' / ')}` : '',
                  document.otherMovements ? `também noutro${document.otherMovements > 1 ? 's' : ''} ${document.otherMovements} movimento${document.otherMovements > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          <select
            value={document.kind || 'fatura'}
            disabled={disabled || busy}
            onChange={event => void changeKind(document, event.target.value as DocumentKind)}
            aria-label="Tipo de documento"
            className="shrink-0 rounded-lg bg-white/70 px-1.5 py-0.5 text-xs text-emerald-800 outline-none"
          >
            {DOCUMENT_KINDS.map(option => <option key={option} value={option}>{DOCUMENT_KIND_LABELS[option]}</option>)}
          </select>
          <span className="hidden shrink-0 text-xs text-emerald-700 sm:inline">{sizeLabel(document.sizeBytes)}</span>
          {document.url && (
            <a href={document.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${document.fileName || 'documento'}`} className="rounded-lg p-1 text-emerald-700 transition-colors duration-200 hover:bg-emerald-100">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <button type="button" disabled={disabled || busy} onClick={() => void remove(document)} aria-label={document.folderPath?.length || document.otherMovements ? `Tirar ${document.fileName || 'documento'} deste movimento` : `Remover ${document.fileName || 'documento'}`}
            title={document.folderPath?.length || document.otherMovements ? 'Tirar deste movimento (o ficheiro fica guardado)' : 'Remover'} className="rounded-lg p-1 text-emerald-700 transition-colors duration-200 hover:bg-emerald-100 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}

      <KindPicker value={kind} onChange={setKind} disabled={disabled || busy} />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => camera.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
          Tirar fotografia
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => picker.current?.click()}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            if (!disabled && !busy && event.dataTransfer.files.length) void upload(event.dataTransfer.files);
          }}
          className={cx(
            'flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-medium text-zinc-800 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
            dragging ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50',
          )}
        >
          <UploadCloud className="h-4 w-4 text-zinc-500" aria-hidden />
          Escolher ficheiro
        </button>
      </div>
      {foldersReady && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => setChoosing(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900/[0.05] px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors duration-200 hover:bg-zinc-900/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FolderOpen className="h-4 w-4 text-zinc-500" aria-hidden />
          Escolher um ficheiro que já está nas pastas
        </button>
      )}
      <p className="text-xs text-zinc-500">PDF ou fotografia, até 9 MB. Pode arrastar ficheiros para o botão.</p>
      <ExistingFilePicker
        open={choosing}
        movementId={movementId}
        onClose={() => setChoosing(false)}
        onLinked={async name => {
          setChoosing(false);
          await load().catch(() => undefined);
          onChanged();
          toast({ title: 'Ficheiro ligado', description: name });
        }}
      />
      <input ref={picker} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={event => { if (event.target.files?.length) void upload(event.target.files); }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { if (event.target.files?.length) void upload(event.target.files); }} />

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
