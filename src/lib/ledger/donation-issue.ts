import 'server-only';

import { factptReadClient, mirrorFreshness, loadManualInvoices } from './factpt-mirror';
import { matchManualInvoice, type DonorIdentity } from './factpt-mirror-rules';
import { assessInvoice } from './invoice-assessment';
import { addDays, samePerson } from './invoice-safety';
import { db } from './server';

type Movement = { id: string; amount: number; booking_date: string; counterparty_name: string | null; account_id: string };

export type DonationGate = {
  /** False: the "Emitir pela app" option is not offered, and the route refuses. */
  available: boolean;
  /** Null while the feature is simply off: there is nothing for the admin to act on. */
  blockedReason: string | null;
  /** Hand-issued FRs with this amount and date but another name: the admin must rule them out. */
  nearbyManual: string[];
};

const blocked = (blockedReason: string | null): DonationGate => ({ available: false, blockedReason, nearbyManual: [] });

/**
 * Everything that must be true before the app may issue a donation FR. The
 * order matters only for the message: any single failure means no FR.
 */
export async function donationGate(movement: Movement): Promise<DonationGate> {
  const [{ data: account, error: accountError }, { data: settings, error: settingsError }] = await Promise.all([
    db().from('bank_accounts').select('app_donation_fr_from').eq('id', movement.account_id).maybeSingle(),
    db().from('factpt_settings')
      .select('auto_enabled, production_donations_enabled, donations_go_live_at')
      .eq('environment', 'production').maybeSingle(),
  ]);
  // Before the migration the column does not exist: the feature simply stays off.
  if (accountError) return blocked(null);
  if (settingsError) throw settingsError;

  const from = account?.app_donation_fr_from as string | null | undefined;
  if (!from) return blocked(null);
  if (movement.booking_date < from) return blocked('Movimento anterior ao início da emissão pela app. A FR é emitida na FACT.pt.');
  if (!settings?.auto_enabled || !settings.production_donations_enabled || !settings.donations_go_live_at
      || Date.parse(settings.donations_go_live_at) > Date.now()) {
    return blocked('A emissão automática de doações não está ativa na FACT.pt.');
  }

  const freshness = await mirrorFreshness();
  if (!freshness?.fresh) return blocked('A cópia da FACT.pt não está atualizada, por isso não é possível garantir que esta FR não existe.');

  const assessment = await assessInvoice(movement, 'doacao');
  if (assessment.issued || assessment.pending || assessment.ambiguous) {
    return blocked('Já existe uma FR ou um pagamento do site para esta transferência.');
  }

  const taken = await takenInvoiceRefs();
  const invoices = await loadManualInvoices(addDays(movement.booking_date, -2), taken);
  const manual = matchManualInvoice(
    { amount: movement.amount, bookingDate: movement.booking_date, counterpartyName: movement.counterparty_name },
    invoices,
  );
  if (manual?.confidence === 'manual') return blocked(`A ${manual.invoiceRefs[0]} já foi emitida à mão para esta pessoa. Associe-a em vez de emitir outra.`);
  const namedMany = manual?.confidence === 'ambiguous' && invoices.some(invoice =>
    manual.invoiceRefs.includes(invoice.number) && samePerson(movement.counterparty_name, invoice.customer));
  if (namedMany) return blocked('Há várias FRs manuais para esta pessoa com este valor. Associe a certa em vez de emitir outra.');

  return { available: true, blockedReason: null, nearbyManual: manual?.invoiceRefs || [] };
}

export type ClientConflict = Pick<DonorIdentity, 'name' | 'email' | 'address' | 'zip' | 'city' | 'country'>;

/**
 * Read only. With no tax number, FACT.pt refuses a second final consumer with
 * the same name. Finding it now lets the admin use the existing details instead
 * of the FR failing after the donation is registered.
 */
export async function clientConflict(donor: Partial<DonorIdentity>): Promise<ClientConflict | null> {
  if (String(donor.nif || '').replace(/\D/g, '')) return null;
  const remote = await factptReadClient().findFinalConsumerConflict({
    name: String(donor.name), email: String(donor.email), address: String(donor.address),
    zip: String(donor.zip), city: String(donor.city), country: String(donor.country).toLowerCase(),
    finalConsumer: true,
  });
  if (!remote) return null;
  return {
    name: remote.name || String(donor.name), email: remote.email || '', address: remote.address || '',
    zip: remote.zip || '', city: remote.city || '', country: (remote.country || '').toUpperCase(),
  };
}

async function takenInvoiceRefs(): Promise<Set<string>> {
  const { data, error } = await db().from('bank_transaction_links').select('target_id').eq('target_type', 'factpt_document');
  if (error) throw error;
  return new Set((data || []).map(link => String(link.target_id)));
}

type Prefill = Partial<DonorIdentity> & { source: 'donation' | 'factpt' | null };

/** The person's data from a past donation or a past FACT.pt client, for the admin to confirm. */
export async function donorPrefill(payer: string | null): Promise<Prefill> {
  const empty: Prefill = { name: payer || '', source: null };
  if (!payer) return empty;

  const { data: donations, error } = await db().from('donations')
    .select('donor_name, donor_email, donor_nif, donor_address, donor_zip, donor_city, donor_country')
    .not('donor_name', 'is', null).not('donor_address', 'is', null)
    .order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  const past = (donations || []).find(row => samePerson(payer, row.donor_name));
  if (past) {
    return {
      name: past.donor_name, email: past.donor_email || '', nif: past.donor_nif || null, address: past.donor_address || '',
      zip: past.donor_zip || '', city: past.donor_city || '', country: past.donor_country || 'PT', source: 'donation',
    };
  }

  const { data: remote, error: remoteError } = await db().from('factpt_remote_documents')
    .select('client_name, client_snapshot').not('client_snapshot', 'is', null)
    .order('doc_date', { ascending: false }).limit(1000);
  if (remoteError) return empty;
  const client = (remote || []).find(row => samePerson(payer, row.client_name))?.client_snapshot as Partial<DonorIdentity> | undefined;
  if (!client) return empty;
  return {
    name: client.name || payer, email: client.email || '', nif: client.nif || null, address: client.address || '',
    zip: client.zip || '', city: client.city || '', country: (client.country || 'PT').toUpperCase(), source: 'factpt',
  };
}
