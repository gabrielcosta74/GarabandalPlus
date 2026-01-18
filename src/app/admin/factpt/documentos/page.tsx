"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../AdminShell';
import styles from '../../factpt.module.css';
import { supabaseBrowser } from '../../../../lib/supabase-browser';

type FactPtDoc = {
  id: string;
  source_type: 'store' | 'donation' | 'membership';
  source_ref: string;
  status: 'issued' | 'pending' | 'failed';
  factpt_document_id: string | null;
  factpt_url: string | null;
  created_at: string;
  error: string | null;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');

const typeLabels: Record<string, string> = {
  store: 'Venda',
  donation: 'Doacao',
  membership: 'Quota',
};

const statusLabels: Record<string, string> = {
  issued: 'Emitido',
  pending: 'Pendente',
  failed: 'Erro',
};

export default function FactPtDocumentosPage() {
  const [documents, setDocuments] = useState<FactPtDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ type: 'all', status: 'all' });

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const params = new URLSearchParams();
      params.set('type', filters.type);
      params.set('status', filters.status);

      const res = await fetch(`/api/admin/factpt/documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar documentos.');
      }
      const payload = await res.json();
      setDocuments(payload.documents || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar documentos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: FactPtDoc) => {
    if (!doc.factpt_document_id) {
      setError('Documento sem ID fact.pt.');
      return;
    }
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      setDownloadingId(doc.id);
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch(`/api/admin/factpt/documents/${doc.factpt_document_id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao descarregar documento.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `documento-${doc.factpt_document_id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Erro ao descarregar documento.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleResend = async (doc: FactPtDoc) => {
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      setResendingId(doc.id);
      setError(null);
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch(`/api/admin/factpt/documents/${doc.id}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao reenviar email.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao reenviar email.');
    } finally {
      setResendingId(null);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [filters.type, filters.status]);

  const documentsView = useMemo(() => {
    return documents.map((doc) => ({
      ...doc,
      labelType: typeLabels[doc.source_type] || doc.source_type,
      labelStatus: statusLabels[doc.status] || doc.status,
    }));
  }, [documents]);

  return (
    <AdminShell
      title="Documentos fiscais"
      description="Lista de documentos emitidos e pendentes."
      toolbar={
        <div className={styles.actions}>
          <label className={styles.field}>
            Tipo
            <select
              className={styles.select}
              value={filters.type}
              onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="all">Todos</option>
              <option value="store">Venda</option>
              <option value="donation">Doacao</option>
              <option value="membership">Quota</option>
            </select>
          </label>
          <label className={styles.field}>
            Estado
            <select
              className={styles.select}
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="all">Todos</option>
              <option value="issued">Emitido</option>
              <option value="pending">Pendente</option>
              <option value="failed">Erro</option>
            </select>
          </label>
          <button className={styles.buttonGhost} type="button" onClick={loadDocuments}>
            Atualizar
          </button>
        </div>
      }
    >
      <section className={styles.panel}>
        {error && <p className={styles.error}>{error}</p>}
        {loading ? <p className={styles.hint}>A carregar...</p> : null}
        {!loading && documentsView.length === 0 ? (
          <p className={styles.hint}>Sem documentos registados.</p>
        ) : null}
        {documentsView.length ? (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>ID</span>
              <span>Data</span>
              <span>Tipo</span>
              <span>Referencia</span>
              <span>Estado</span>
              <span>Acao</span>
            </div>
            {documentsView.map((doc) => (
              <div className={styles.tableRow} key={doc.id}>
                <div data-label="ID">
                  <strong>{doc.factpt_document_id || doc.id}</strong>
                </div>
                <div data-label="Data">{formatDate(doc.created_at)}</div>
                <div data-label="Tipo">{doc.labelType}</div>
                <div data-label="Referencia">{doc.source_ref}</div>
                <div data-label="Estado">
                  <span
                    className={`${styles.badge} ${
                      doc.status === 'issued'
                        ? styles.badgeSuccess
                        : doc.status === 'failed'
                        ? styles.badgeWarning
                        : ''
                    }`}
                  >
                    {doc.labelStatus}
                  </span>
                  {doc.status === 'failed' && doc.error ? (
                    <span className={styles.hint}>{doc.error}</span>
                  ) : null}
                </div>
                <div data-label="Acao" className={styles.rowActions}>
                  {doc.factpt_url ? (
                    <a className={styles.buttonTiny} href={doc.factpt_url} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  ) : (
                    <span className={styles.hint}>Sem link</span>
                  )}
                  {doc.factpt_document_id ? (
                    <button
                      type="button"
                      className={`${styles.buttonTiny} ${styles.buttonTinyPrimary}`}
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                    >
                      {downloadingId === doc.id ? 'A baixar...' : 'Baixar PDF'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.buttonTiny}
                    onClick={() => handleResend(doc)}
                    disabled={resendingId === doc.id}
                  >
                    {resendingId === doc.id ? 'A reenviar...' : 'Reenviar email'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
