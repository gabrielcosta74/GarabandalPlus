"use client";

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  Mail,
  RotateCcw,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';

import { supabaseBrowser } from '../../../lib/supabase-browser';
import styles from './factpt-dashboard.module.css';
import type { FactptDocument, FactptStatus } from './types';

const STATUS_LABELS: Record<FactptStatus, string> = {
  awaiting_approval: 'Por aprovar',
  pending: 'Na fila',
  needs_data: 'Requer dados',
  processing: 'A processar',
  issued: 'Emitida',
  failed: 'Erro na emissão',
  email_failed: 'Email por enviar',
};

const SOURCE_LABELS = {
  pilgrimage: 'Peregrinação',
  donation: 'Donativo',
  quota: 'Quota',
  store: 'Loja',
} as const;

type ClientResolution = {
  action: 'reused' | 'created' | 'final_consumer';
  factptClientId: string | null;
  matchReason:
    | 'exact_tin'
    | 'exact_email_and_compatible_name'
    | 'new_client'
    | 'simplified_final_consumer';
};

const CLIENT_RESOLUTION_LABELS: Record<ClientResolution['matchReason'], string> = {
  exact_tin: 'NIF exato',
  exact_email_and_compatible_name: 'Email exato + nome compatível',
  new_client: 'Novo cliente',
  simplified_final_consumer: 'Consumidor final',
};

function clientMatchLabel(value: string | null) {
  if (!value) return null;
  const labels: Record<string, string> = {
    ...CLIENT_RESOLUTION_LABELS,
    existing_client: 'Cliente FACT.pt já associado',
  };
  return labels[value] || value;
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function formatMoney(value: number | null, currency = 'EUR') {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);
}

function isSafeUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function FactptDocumentDrawer({
  document,
  open,
  onClose,
  onChanged,
}: {
  document: FactptDocument | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [productionConfirmed, setProductionConfirmed] = useState(false);
  const [preparedResolution, setPreparedResolution] = useState<ClientResolution | null>(null);
  const [customerDraft, setCustomerDraft] = useState({
    name: '',
    email: '',
    nif: '',
    address: '',
    postalCode: '',
    city: '',
    country: '',
    phone: '',
  });

  useEffect(() => {
    setFeedback(null);
    setActiveAction(null);
    setProductionConfirmed(false);
    setPreparedResolution(null);
  }, [document?.id]);

  useEffect(() => {
    setCustomerDraft({
      name: document?.customer.name || '',
      email: document?.customer.email || document?.emailTo || '',
      nif: document?.customer.nif || '',
      address: document?.customer.address || '',
      postalCode: document?.customer.postalCode || '',
      city: document?.customer.city || '',
      country: document?.customer.country || '',
      phone: document?.customer.phone || '',
    });
  }, [
    document?.customer.address,
    document?.customer.city,
    document?.customer.country,
    document?.customer.email,
    document?.customer.name,
    document?.customer.nif,
    document?.customer.phone,
    document?.customer.postalCode,
    document?.emailTo,
  ]);

  if (!document) return null;

  const canPrepare =
    document.status === 'awaiting_approval' && !document.reviewPreparedAt;
  const canApprove =
    document.status === 'awaiting_approval' && Boolean(document.reviewPreparedAt);
  const canRetry =
    document.status === 'failed' || document.status === 'needs_data';
  const canUseIssued =
    document.status === 'issued' || document.status === 'email_failed';
  const canEditCustomer =
    document.status === 'awaiting_approval' || document.status === 'needs_data';
  const amountMatches =
    document.amount !== null
    && document.fiscalTotal !== null
    && Math.abs(document.amount - document.fiscalTotal) < 0.005;

  const postAction = async (action: 'prepare' | 'approve' | 'retry' | 'resend') => {
    if (!supabaseBrowser) return;
    setActiveAction(action);
    setFeedback(null);

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error('A sessão de administrador expirou.');

      const response = await fetch(
        `/api/admin/factpt/documents/${document.id}/${action}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            confirmProduction:
              action === 'approve' && document.environment === 'production',
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || body?.message || 'Não foi possível concluir a ação.');
      }

      const messages = {
        prepare: 'Dados preparados. Confirma o resumo antes de aprovar.',
        approve: 'Fatura aprovada e colocada na fila de emissão.',
        retry: 'Documento novamente colocado na fila.',
        resend: 'Email reenviado com sucesso.',
      };
      if (action === 'prepare' && body?.preview?.clientResolution) {
        setPreparedResolution(body.preview.clientResolution as ClientResolution);
      }
      setFeedback({ type: 'success', message: messages[action] });
      await onChanged();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível concluir a ação.',
      });
    } finally {
      setActiveAction(null);
    }
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabaseBrowser) return;
    setActiveAction('draft');
    setFeedback(null);

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error('A sessão de administrador expirou.');

      const response = await fetch(
        `/api/admin/factpt/documents/${document.id}/draft`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expectedUpdatedAt: document.updatedAt,
            customer: Object.fromEntries(
              Object.entries(customerDraft).map(([key, value]) => [
                key,
                value.trim() || null,
              ]),
            ),
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            'A fatura foi atualizada noutra sessão; atualiza antes de continuar.',
          );
        }
        throw new Error(body?.error || body?.message || 'Não foi possível guardar os dados.');
      }

      setFeedback({
        type: 'success',
        message: 'Dados guardados. Prepara agora a validação final.',
      });
      setPreparedResolution(null);
      await onChanged();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível guardar os dados.',
      });
    } finally {
      setActiveAction(null);
    }
  };

  const download = async () => {
    if (!supabaseBrowser) return;
    setActiveAction('download');
    setFeedback(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error('A sessão de administrador expirou.');

      const response = await fetch(
        `/api/admin/factpt/documents/${document.id}/download`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível descarregar o PDF.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `${document.factptNumber || document.id}.pdf`.replace(/[^\w.-]+/g, '_');
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível descarregar o PDF.',
      });
    } finally {
      setActiveAction(null);
    }
  };

  const fiscalAddress = [
    document.customer.address,
    [document.customer.postalCode, document.customer.city].filter(Boolean).join(' '),
    document.customer.country?.toUpperCase(),
  ].filter(Boolean).join(' · ');

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className={styles.drawerRoot} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter={styles.overlayEnter}
          enterFrom={styles.overlayFrom}
          enterTo={styles.overlayTo}
          leave={styles.overlayLeave}
          leaveFrom={styles.overlayTo}
          leaveTo={styles.overlayFrom}
        >
          <div className={styles.drawerOverlay} />
        </Transition.Child>

        <div className={styles.drawerViewport}>
          <Transition.Child
            as={Fragment}
            enter={styles.drawerEnter}
            enterFrom={styles.drawerFrom}
            enterTo={styles.drawerTo}
            leave={styles.drawerLeave}
            leaveFrom={styles.drawerTo}
            leaveTo={styles.drawerFrom}
          >
            <Dialog.Panel className={styles.drawerPanel}>
              <header className={styles.drawerHeader}>
                <div>
                  <span className={styles.drawerEyebrow}>
                    {SOURCE_LABELS[document.sourceType]} · {document.seriesCode || 'FACT.pt'}
                  </span>
                  <Dialog.Title>{document.factptNumber || 'Documento por emitir'}</Dialog.Title>
                  <p>{STATUS_LABELS[document.status]} · {document.environment === 'production' ? 'Produção' : 'Sandbox'}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Fechar detalhe">
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className={styles.drawerBody}>
                <section className={styles.drawerSummary}>
                  <div>
                    <span>Pagamento confirmado</span>
                    <strong>{formatMoney(document.amount, document.currency)}</strong>
                    <small>{formatDate(document.paymentConfirmedAt)}</small>
                  </div>
                  <div>
                    <span>Total fiscal</span>
                    <strong>{formatMoney(document.fiscalTotal, document.fiscalCurrency)}</strong>
                    <small className={amountMatches ? styles.matchGood : styles.matchBad}>
                      {amountMatches ? (
                        <><CheckCircle2 aria-hidden="true" /> Valor confirmado</>
                      ) : (
                        <><AlertTriangle aria-hidden="true" /> Verificar diferença</>
                      )}
                    </small>
                  </div>
                </section>

                {feedback ? (
                  <div
                    className={feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}
                    role="status"
                  >
                    {feedback.type === 'success'
                      ? <CheckCircle2 aria-hidden="true" />
                      : <AlertTriangle aria-hidden="true" />}
                    {feedback.message}
                  </div>
                ) : null}

                {canEditCustomer ? (
                  <section className={styles.drawerSection}>
                    <div className={styles.drawerSectionTitle}>
                      <UserRound aria-hidden="true" />
                      <div>
                        <h3>Dados do cliente</h3>
                        <p>Confirma apenas os dados que identificam o titular da fatura.</p>
                      </div>
                    </div>
                    <form className={styles.customerForm} onSubmit={saveDraft}>
                      <DraftField
                        label="Nome"
                        value={customerDraft.name}
                        onChange={(name) => setCustomerDraft((current) => ({ ...current, name }))}
                        required
                        wide
                      />
                      <DraftField
                        label="Email"
                        type="email"
                        value={customerDraft.email}
                        onChange={(email) => setCustomerDraft((current) => ({ ...current, email }))}
                        required
                        wide
                      />
                      <DraftField
                        label="NIF"
                        value={customerDraft.nif}
                        onChange={(nif) => setCustomerDraft((current) => ({ ...current, nif }))}
                        placeholder="Consumidor final se vazio"
                      />
                      <DraftField
                        label="Telefone"
                        value={customerDraft.phone}
                        onChange={(phone) => setCustomerDraft((current) => ({ ...current, phone }))}
                      />
                      <DraftField
                        label="Morada"
                        value={customerDraft.address}
                        onChange={(address) => setCustomerDraft((current) => ({ ...current, address }))}
                        wide
                      />
                      <DraftField
                        label="Código postal"
                        value={customerDraft.postalCode}
                        onChange={(postalCode) => setCustomerDraft((current) => ({ ...current, postalCode }))}
                      />
                      <DraftField
                        label="Cidade"
                        value={customerDraft.city}
                        onChange={(city) => setCustomerDraft((current) => ({ ...current, city }))}
                      />
                      <DraftField
                        label="País"
                        value={customerDraft.country}
                        onChange={(country) => setCustomerDraft((current) => ({ ...current, country }))}
                        placeholder="PT"
                      />
                      <div className={styles.formAction}>
                        <button
                          type="submit"
                          className={styles.saveDraftButton}
                          disabled={activeAction !== null}
                        >
                          {activeAction === 'draft'
                            ? <LoaderCircle className={styles.spinning} aria-hidden="true" />
                            : <Check aria-hidden="true" />}
                          Guardar dados
                        </button>
                        <span>Guardar invalida uma preparação anterior.</span>
                      </div>
                    </form>
                  </section>
                ) : (
                  <DrawerSection title="Cliente" icon={UserRound}>
                    <DetailRow label="Nome" value={document.customer.name} />
                    <DetailRow label="Email" value={document.customer.email || document.emailTo} />
                    <DetailRow label="NIF" value={document.customer.nif || 'Consumidor final'} />
                    <DetailRow label="Morada" value={fiscalAddress || 'Não indicada'} />
                    {document.clientAction ? (
                      <DetailRow
                        label="Cliente FACT.pt"
                        value={{
                          reused: 'Reutilizado',
                          created: 'Criado',
                          updated: 'Reutilizado e atualizado',
                          final_consumer: 'Consumidor final',
                        }[document.clientAction] || document.clientAction}
                      />
                    ) : null}
                    {document.clientMatchReason ? (
                      <p className={styles.matchReason}>
                        Correspondência: {clientMatchLabel(document.clientMatchReason)}
                      </p>
                    ) : null}
                  </DrawerSection>
                )}

                <DrawerSection title="Documento fiscal" icon={FileText}>
                  <DetailRow
                    label="Tipo"
                    value={
                      document.documentType === 'invoice_receipt'
                        ? 'Fatura-Recibo'
                        : document.documentType === 'simplified_invoice'
                          ? 'Fatura Simplificada'
                          : 'Por determinar'
                    }
                  />
                  <DetailRow label="Série" value={document.seriesCode} />
                  <DetailRow label="Referência" value={document.fiscalReference || document.sourceReference} />
                  <DetailRow label="Meio de pagamento" value={document.paymentMethod} />
                  <DetailRow label="Observações" value={document.comments} />

                  {canApprove ? (
                    <div className={styles.preparedResolution}>
                      <CheckCircle2 aria-hidden="true" />
                      <div>
                        <strong>Validação preparada</strong>
                        <span>
                          {preparedResolution
                            ? CLIENT_RESOLUTION_LABELS[preparedResolution.matchReason]
                            : clientMatchLabel(document.clientMatchReason)
                              || 'Dados fiscais prontos para aprovação'}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {document.fiscalLines.length > 0 ? (
                    <div className={styles.lines}>
                      {document.fiscalLines.map((line, index) => (
                        <div className={styles.line} key={`${line.reference || 'linha'}-${index}`}>
                          <div>
                            <strong>{line.description || `Linha ${index + 1}`}</strong>
                            <span>{line.reference || 'Sem referência'} · IVA {line.taxRate ?? 0}%</span>
                          </div>
                          <span>
                            {line.quantity ?? 1} × {formatMoney(line.unitPriceNet ?? null, document.fiscalCurrency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </DrawerSection>

                <DrawerSection title="Processamento" icon={WalletCards}>
                  <DetailRow label="Aprovada" value={formatDate(document.approvedAt)} />
                  <DetailRow label="Emitida" value={formatDate(document.issuedAt)} />
                  <DetailRow label="Email enviado" value={formatDate(document.emailSentAt)} />
                  <DetailRow label="Referência de origem" value={document.sourceReference || document.sourceId} mono />
                </DrawerSection>

                {document.lastError || document.emailLastError ? (
                  <section className={styles.documentError}>
                    <AlertTriangle aria-hidden="true" />
                    <div>
                      <strong>Último erro</strong>
                      <p>{document.emailLastError || document.lastError}</p>
                    </div>
                  </section>
                ) : null}

                {canApprove && document.environment === 'production' ? (
                  <label className={styles.productionConfirmation}>
                    <input
                      type="checkbox"
                      checked={productionConfirmed}
                      onChange={(event) => setProductionConfirmed(event.target.checked)}
                    />
                    <span>
                      <strong>Confirmo a emissão em produção</strong>
                      <small>
                        Será emitido um documento real de {formatMoney(document.fiscalTotal, document.fiscalCurrency)}
                        {' '}e enviado para {document.customer.email || document.emailTo || 'o cliente'}.
                      </small>
                    </span>
                  </label>
                ) : null}
              </div>

              <footer className={styles.drawerFooter}>
                <div className={styles.drawerActions}>
                  {canPrepare ? (
                    <ActionButton
                      label="Preparar validação"
                      icon={FileCheck2}
                      active={activeAction === 'prepare'}
                      disabled={activeAction !== null}
                      onClick={() => void postAction('prepare')}
                      primary
                    />
                  ) : null}
                  {canApprove ? (
                    <ActionButton
                      label="Aprovar e emitir"
                      icon={Check}
                      active={activeAction === 'approve'}
                      disabled={
                        activeAction !== null
                        || !amountMatches
                        || (document.environment === 'production' && !productionConfirmed)
                      }
                      onClick={() => void postAction('approve')}
                      primary
                    />
                  ) : null}
                  {canRetry ? (
                    <ActionButton
                      label={document.status === 'needs_data' ? 'Validar novamente' : 'Repetir emissão'}
                      icon={RotateCcw}
                      active={activeAction === 'retry'}
                      disabled={activeAction !== null}
                      onClick={() => void postAction('retry')}
                      primary
                    />
                  ) : null}
                  {canUseIssued ? (
                    <>
                      <ActionButton
                        label="Descarregar PDF"
                        icon={Download}
                        active={activeAction === 'download'}
                        disabled={activeAction !== null}
                        onClick={() => void download()}
                      />
                      <ActionButton
                        label="Reenviar email"
                        icon={Mail}
                        active={activeAction === 'resend'}
                        disabled={activeAction !== null}
                        onClick={() => void postAction('resend')}
                      />
                    </>
                  ) : null}
                  {isSafeUrl(document.permanentUrl) ? (
                    <a
                      href={document.permanentUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.drawerLink}
                    >
                      <ExternalLink aria-hidden="true" />
                      Abrir na FACT.pt
                    </a>
                  ) : null}
                </div>
                {document.detailsLink ? (
                  <a href={document.detailsLink} className={styles.originLink}>
                    Abrir pagamento de origem
                    <ExternalLink aria-hidden="true" />
                  </a>
                ) : null}
              </footer>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

function DrawerSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.drawerSection}>
      <div className={styles.drawerSectionTitle}>
        <Icon aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <div className={styles.detailRows}>{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <strong className={mono ? styles.mono : ''}>{value || '—'}</strong>
    </div>
  );
}

function DraftField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email';
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={wide ? styles.fieldWide : styles.field}>
      <span>{label}{required ? ' *' : ''}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ActionButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
  primary = false,
}: {
  label: string;
  icon: typeof Check;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={primary ? styles.drawerPrimaryButton : styles.drawerSecondaryButton}
      disabled={disabled}
      onClick={onClick}
    >
      {active
        ? <LoaderCircle className={styles.spinning} aria-hidden="true" />
        : <Icon aria-hidden="true" />}
      {label}
    </button>
  );
}
