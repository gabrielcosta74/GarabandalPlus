"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';

import { MAX_DOCUMENT_BYTES } from '../../../lib/ledger/document-rules';
import { adminFetch } from './useLedger';
import { useToast } from './Toasts';
import { cx } from './ui';

type StoredDocument = { id: string; fileName: string | null; sizeBytes: number | null; url: string | null };

const sizeLabel = (bytes: number | null) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '');

/** The invoice behind an expense: what the accountant will read. */
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
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const result = await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos`);
    setDocuments(result.documents as StoredDocument[]);
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
      for (const file of Array.from(files)) {
        if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`${file.name} é demasiado grande (máximo 9 MB).`);
        const form = new FormData();
        form.append('file', file);
        await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos`, { method: 'POST', body: form });
        saved += 1;
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível guardar o ficheiro.');
    } finally {
      if (saved > 0) {
        await load().catch(() => undefined);
        onChanged();
        toast({ title: saved === 1 ? 'Documento guardado' : `${saved} documentos guardados` });
      }
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async (document: StoredDocument) => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/documentos/${document.id}`, { method: 'DELETE' });
      await load();
      onChanged();
      toast({ tone: 'info', title: 'Documento removido' });
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
          <span className="min-w-0 flex-1 truncate" title={document.fileName || undefined}>{document.fileName || 'Documento'}</span>
          <span className="shrink-0 text-xs text-emerald-700">{sizeLabel(document.sizeBytes)}</span>
          {document.url && (
            <a href={document.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${document.fileName || 'documento'}`} className="rounded-lg p-1 text-emerald-700 transition-colors duration-200 hover:bg-emerald-100">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <button type="button" disabled={disabled || busy} onClick={() => void remove(document)} aria-label={`Remover ${document.fileName || 'documento'}`} className="rounded-lg p-1 text-emerald-700 transition-colors duration-200 hover:bg-emerald-100 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          if (!disabled && !busy && event.dataTransfer.files.length) void upload(event.dataTransfer.files);
        }}
        className={cx(
          'flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-5 text-center transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
          dragging ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50',
        )}
      >
        {busy ? <LoaderCircle className="h-6 w-6 animate-spin text-zinc-400" aria-hidden /> : <UploadCloud className="h-6 w-6 text-zinc-400" aria-hidden />}
        <span className="text-sm font-medium text-zinc-800">{busy ? 'A guardar…' : documents?.length ? 'Anexar outro ficheiro' : 'Anexar fatura'}</span>
        <span className="text-xs text-zinc-500">Arraste para aqui. PDF ou fotografia, até 9 MB</span>
      </button>
      <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={event => { if (event.target.files?.length) void upload(event.target.files); }} />

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
