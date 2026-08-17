import {
  FACTPT_PRODUCTION_BASE_URL,
  FACTPT_SANDBOX_BASE_URL,
  type FactPtConfig,
} from './config';
import type {
  FactPtClientCreateInput,
  FactPtCreatedResource,
  FactPtErrorResponse,
  FactPtInvoiceReceiptPayload,
  FactPtPage,
  FactPtProduct,
  FactPtResponseEnvelope,
  FactPtRemoteClient,
  FactPtSimplifiedInvoicePayload,
  FactPtTax,
} from './types';

export type FactPtErrorKind =
  | 'timeout'
  | 'network'
  | 'authentication'
  | 'subscription'
  | 'balance'
  | 'account_suspended'
  | 'rate_limit'
  | 'daily_limit'
  | 'validation'
  | 'not_found'
  | 'server'
  | 'invalid_response';

export class FactPtError extends Error {
  readonly kind: FactPtErrorKind;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly appStatusCode?: number;
  readonly details?: Record<string, string | string[]>;

  constructor(params: {
    message: string;
    kind: FactPtErrorKind;
    retryable: boolean;
    httpStatus?: number;
    appStatusCode?: number;
    details?: Record<string, string | string[]>;
    cause?: unknown;
  }) {
    super(params.message);
    if (params.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
    this.name = 'FactPtError';
    this.kind = params.kind;
    this.retryable = params.retryable;
    this.httpStatus = params.httpStatus;
    this.appStatusCode = params.appStatusCode;
    this.details = params.details;
  }
}

type RateLimiterOptions = {
  minimumIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class FactPtRateLimiter {
  private readonly minimumIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private tail: Promise<void> = Promise.resolve();
  private lastStartedAt: number | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.minimumIntervalMs = options.minimumIntervalMs ?? 1_000;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => {
          setTimeout(resolve, milliseconds);
        }));
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    const runAfterPrevious = this.tail.then(async () => {
      if (this.lastStartedAt !== null) {
        const elapsed = this.now() - this.lastStartedAt;
        const waitFor = this.minimumIntervalMs - elapsed;
        if (waitFor > 0) {
          await this.sleep(waitFor);
        }
      }
      this.lastStartedAt = this.now();
      return operation();
    });

    this.tail = runAfterPrevious.then(
      () => undefined,
      () => undefined,
    );
    return runAfterPrevious;
  }
}

const globalFactPtRateLimiter = new FactPtRateLimiter();

type FactPtClientOptions = {
  fetch?: typeof fetch;
  rateLimiter?: FactPtRateLimiter;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

export type FactPtDownloadedPdf = {
  bytes: Uint8Array;
  filename: string | null;
};

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;

  const utf8Match = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, '');
    }
  }

  const filenameMatch = value.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  return (filenameMatch?.[1] || filenameMatch?.[2] || '').trim() || null;
}

function extractErrorMessage(
  payload: FactPtResponseEnvelope<FactPtErrorResponse> | null,
) {
  const errors = payload?.AppResponse?.errors;
  if (errors && Object.keys(errors).length > 0) {
    return Object.entries(errors)
      .map(([field, value]) => {
        const fieldMessage = Array.isArray(value) ? value.join(', ') : value;
        return `${field}: ${fieldMessage}`;
      })
      .join(' | ');
  }

  return (
    payload?.AppResponse?.message ||
    payload?.AppStatusMsg ||
    'Erro desconhecido na API FACT.pt.'
  );
}

function classifyFactPtError(
  httpStatus: number,
  appStatusCode?: number,
): Pick<FactPtError, 'kind' | 'retryable'> {
  const effectiveStatus =
    appStatusCode && appStatusCode >= 400 ? appStatusCode : httpStatus;

  if (effectiveStatus === 401 || effectiveStatus === 403) {
    return { kind: 'authentication', retryable: false };
  }
  if (effectiveStatus === 406) {
    return { kind: 'subscription', retryable: false };
  }
  if (effectiveStatus === 407) {
    return { kind: 'balance', retryable: false };
  }
  if (effectiveStatus === 409) {
    return { kind: 'account_suspended', retryable: false };
  }
  if (effectiveStatus === 408) {
    return { kind: 'daily_limit', retryable: false };
  }
  if (effectiveStatus === 429) {
    return { kind: 'rate_limit', retryable: true };
  }
  if (effectiveStatus === 499) {
    return { kind: 'server', retryable: true };
  }
  if (effectiveStatus === 404) {
    return { kind: 'not_found', retryable: false };
  }
  if (effectiveStatus === 400 || effectiveStatus === 409 || effectiveStatus === 422) {
    return { kind: 'validation', retryable: false };
  }
  if (effectiveStatus >= 500) {
    return { kind: 'server', retryable: true };
  }
  return { kind: 'validation', retryable: false };
}

function isDuplicateTinError(error: unknown): boolean {
  if (!(error instanceof FactPtError)) {
    return false;
  }
  const details = JSON.stringify(error.details || {}).toLowerCase();
  const message = error.message.toLowerCase();
  return (
    details.includes('tinunique') ||
    details.includes('already exists') ||
    message.includes('tinunique') ||
    message.includes('nif já existe') ||
    message.includes('nif ja existe') ||
    message.includes('tin already exists')
  );
}

function normalizedClientText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizedClientName(value: unknown): string {
  return normalizedClientText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizedClientTin(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

function normalizedClientEmail(value: unknown): string {
  const email = normalizedClientText(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function clientNamesAreCompatible(localName: string, remoteName: string): boolean {
  const local = normalizedClientName(localName);
  const remote = normalizedClientName(remoteName);
  if (!local || !remote) return false;
  if (local === remote) return true;

  const localTokens = local.split(' ').filter(Boolean);
  const remoteTokens = new Set(remote.split(' ').filter(Boolean));
  return localTokens.length >= 2
    && localTokens.every((token) => remoteTokens.has(token));
}

function clientEmailsAreCompatible(localEmail: string, remoteEmail: string): boolean {
  const local = normalizedClientEmail(localEmail);
  const remote = normalizedClientEmail(remoteEmail);
  return Boolean(local && remote && local === remote);
}

function hasCompleteRemoteBillingIdentity(client: FactPtRemoteClient): boolean {
  return Boolean(
    normalizedClientName(client.name)
      && /^\d{5,15}$/.test(normalizedClientTin(client.tin))
      && normalizedClientEmail(client.email)
      && normalizedClientText(client.address)
      && normalizedClientText(client.zip)
      && normalizedClientText(client.city)
      && /^[a-z]{2}$/i.test(String(client.country || '').trim()),
  );
}

function canonicalRemoteClientScore(
  client: FactPtRemoteClient,
  identity: { name: string; email: string },
): number {
  const rawTin = String(client.tin || '').trim();
  let score = 0;
  if (normalizedClientEmail(client.email) === normalizedClientEmail(identity.email)) {
    score += 100;
  }
  if (normalizedClientName(client.name) === normalizedClientName(identity.name)) {
    score += 50;
  }
  if (/^[\d\s.-]+$/.test(rawTin)) {
    score += 20;
  }
  return score;
}

export function selectExistingFactPtBillingClient(
  clients: FactPtRemoteClient[],
  identity: { name: string; email: string },
): FactPtRemoteClient | null {
  const uniqueById = new Map<string, FactPtRemoteClient>();
  clients.forEach((client) => {
    if (client?.id !== undefined && client?.id !== null && String(client.id)) {
      uniqueById.set(String(client.id), client);
    }
  });

  const compatible = [...uniqueById.values()].filter(
    (client) =>
      hasCompleteRemoteBillingIdentity(client)
      && clientNamesAreCompatible(identity.name, client.name || '')
      && clientEmailsAreCompatible(identity.email, client.email || ''),
  );
  if (compatible.length === 0) return null;

  const tins = new Set(
    compatible.map((client) => normalizedClientTin(client.tin)),
  );
  if (tins.size !== 1) {
    // More than one fiscal identity matched the search. Never guess between
    // homonyms or accounts that share a similar email.
    return null;
  }

  return compatible
    .sort(
      (left, right) =>
        canonicalRemoteClientScore(right, identity)
        - canonicalRemoteClientScore(left, identity),
    )[0] || null;
}

function isSameFinalConsumerIdentity(
  client: FactPtRemoteClient,
  input: FactPtClientCreateInput,
): boolean {
  return Boolean(
    client.isFinalConsumer
      && normalizedClientEmail(client.email) === normalizedClientEmail(input.email)
      && clientNamesAreCompatible(input.name, client.name || '')
      && normalizedClientText(client.country) === normalizedClientText(input.country),
  );
}

async function readJsonEnvelope<T>(
  response: Response,
): Promise<FactPtResponseEnvelope<T> | null> {
  try {
    return (await response.json()) as FactPtResponseEnvelope<T>;
  } catch {
    return null;
  }
}

export class FactPtClient {
  private readonly config: FactPtConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly rateLimiter: FactPtRateLimiter;

  constructor(config: FactPtConfig, options: FactPtClientOptions = {}) {
    const expectedBaseUrl =
      config.environment === 'production'
        ? FACTPT_PRODUCTION_BASE_URL
        : FACTPT_SANDBOX_BASE_URL;
    if (config.baseUrl !== expectedBaseUrl) {
      throw new Error(
        `FactPtClient bloqueou um URL incompatível com ${config.environment}.`,
      );
    }
    this.config = config;
    this.fetchImpl = options.fetch ?? fetch;
    this.rateLimiter = options.rateLimiter ?? globalFactPtRateLimiter;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.rateLimiter.run(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      let response: Response;
      try {
        response = await this.fetchImpl(
          `${this.config.baseUrl}${path}`,
          {
            method: options.method ?? 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': this.config.apiKey,
              'api-version': this.config.apiVersion,
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: controller.signal,
          },
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          throw new FactPtError({
            message: 'A API FACT.pt excedeu o tempo limite.',
            kind: 'timeout',
            retryable: true,
            cause: error,
          });
        }
        throw new FactPtError({
          message: 'Não foi possível comunicar com a API FACT.pt.',
          kind: 'network',
          retryable: true,
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
      }

      const payload = await readJsonEnvelope<T>(response);
      const envelopeHttpStatus = payload?.HttpStatusCode ?? response.status;
      const appStatusCode = payload?.AppStatusCode;
      const appSucceeded =
        (payload?.AppStatusMsg === undefined || payload.AppStatusMsg === 'OK') &&
        envelopeHttpStatus < 400 &&
        (appStatusCode === undefined || appStatusCode < 400);

      if (!response.ok || !appSucceeded) {
        const errorPayload = payload as FactPtResponseEnvelope<FactPtErrorResponse> | null;
        const classification = classifyFactPtError(response.status, appStatusCode);
        throw new FactPtError({
          message: extractErrorMessage(errorPayload),
          ...classification,
          httpStatus: payload?.HttpStatusCode ?? response.status,
          appStatusCode,
          details: errorPayload?.AppResponse?.errors,
        });
      }

      if (!payload || payload.AppResponse === undefined) {
        throw new FactPtError({
          message: 'A API FACT.pt devolveu uma resposta incompleta.',
          kind: 'invalid_response',
          retryable: false,
          httpStatus: response.status,
        });
      }

      return payload.AppResponse;
    });
  }

  async findClientsByTin(tin: string): Promise<FactPtRemoteClient[]> {
    const normalizedTin = tin.replace(/[\s.-]/g, '');
    if (!normalizedTin) return [];
    const result = await this.request<FactPtPage<FactPtRemoteClient>>(
      `/clients?searchTin=${encodeURIComponent(normalizedTin)}`,
    );
    return result.data ?? [];
  }

  async findClients(search: string): Promise<FactPtRemoteClient[]> {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) return [];
    const result = await this.request<FactPtPage<FactPtRemoteClient>>(
      `/clients?search=${encodeURIComponent(normalizedSearch)}`,
    );
    return result.data ?? [];
  }

  async findExistingBillingClient(identity: {
    name: string;
    email: string;
  }): Promise<FactPtRemoteClient | null> {
    const searchTerms = [identity.email.trim(), identity.name.trim()]
      .filter(Boolean);
    const results: FactPtRemoteClient[] = [];
    for (const term of searchTerms) {
      results.push(...await this.findClients(term));
    }
    return selectExistingFactPtBillingClient(results, identity);
  }

  async findExistingFinalConsumerClient(
    input: FactPtClientCreateInput,
  ): Promise<FactPtRemoteClient | null> {
    if (!input.finalConsumer) return null;
    const uniqueById = new Map<string, FactPtRemoteClient>();
    (await this.findClients(input.email)).forEach((candidate) => {
      if (
        candidate?.id !== undefined
        && candidate?.id !== null
        && isSameFinalConsumerIdentity(candidate, input)
      ) {
        uniqueById.set(String(candidate.id), candidate);
      }
    });
    const compatible = [...uniqueById.values()];
    if (compatible.length > 1) {
      throw new Error(
        'Existem vários clientes Consumidor Final com o mesmo email; é necessária revisão administrativa.',
      );
    }
    return compatible[0] || null;
  }

  async createClient(input: FactPtClientCreateInput): Promise<FactPtCreatedResource> {
    const normalizedTin = input.tin?.replace(/[\s.-]/g, '') || '';
    if (!input.finalConsumer && !/^\d{5,15}$/.test(normalizedTin)) {
      throw new Error('O NIF do cliente FACT.pt é inválido.');
    }
    if (input.finalConsumer && normalizedTin) {
      throw new Error(
        'Um cliente Consumidor Final não deve receber um NIF forçado.',
      );
    }

    return this.request<FactPtCreatedResource>('/clients', {
      method: 'POST',
      body: {
        client: {
          name: input.name,
          ...(normalizedTin ? { tin: Number(normalizedTin) } : {}),
          address: input.address,
          zip: input.zip,
          city: input.city,
          ...(input.finalConsumer ? {} : { ric: false, retention: false }),
          country: input.country,
          email: input.email,
          phone: input.phone,
          brand: input.brand,
          site: input.site,
          finalConsumer: input.finalConsumer,
        },
      },
    });
  }

  async updateClient(
    clientId: string | number,
    input: FactPtClientCreateInput,
  ): Promise<FactPtCreatedResource> {
    if (clientId === '') throw new Error('O ID do cliente FACT.pt é obrigatório.');
    if (input.finalConsumer) {
      throw new Error(
        'Perfis Consumidor Final existentes não são atualizados automaticamente.',
      );
    }
    return this.request<FactPtCreatedResource>(
      `/clients/${encodeURIComponent(String(clientId))}`,
      {
        method: 'POST',
        body: {
          client: {
            name: input.name,
            address: input.address,
            zip: input.zip,
            city: input.city,
            country: input.country,
            email: input.email,
            phone: input.phone,
          },
        },
      },
    );
  }

  async findOrCreateClient(
    input: FactPtClientCreateInput,
  ): Promise<{
    client: FactPtRemoteClient;
    created: boolean;
    updated: boolean;
  }> {
    if (input.finalConsumer) {
      const byEmail = await this.findClients(input.email);
      const byName = await this.findClients(input.name);
      const compatibleById = new Map<string, FactPtRemoteClient>();
      [...byEmail, ...byName].forEach((candidate) => {
        if (
          candidate?.id !== undefined
          && candidate?.id !== null
          && isSameFinalConsumerIdentity(candidate, input)
        ) {
          compatibleById.set(String(candidate.id), candidate);
        }
      });
      const compatibleClients = [...compatibleById.values()];
      if (compatibleClients.length > 1) {
        throw new Error(
          'Existem vários clientes Consumidor Final com o mesmo email; é necessária revisão administrativa.',
        );
      }
      const existingClient = compatibleClients[0];
      if (existingClient) {
        return { client: existingClient, created: false, updated: false };
      }

      const created = await this.createClient(input);
      return {
        client: {
          id: String(created.data.id),
          name: input.name,
          email: input.email,
          address: input.address,
          zip: input.zip,
          city: input.city,
          country: input.country,
          isFinalConsumer: true,
        },
        created: true,
        updated: false,
      };
    }

    const tin = input.tin || '';
    const existingClients = await this.findClientsByTin(tin);
    const existingClient = existingClients[0];
    if (existingClient) {
      return { client: existingClient, created: false, updated: false };
    }

    try {
      const created = await this.createClient(input);
      return {
        client: {
          id: String(created.data.id),
          name: input.name,
          tin,
          email: input.email,
        },
        created: true,
        updated: false,
      };
    } catch (error) {
      if (!isDuplicateTinError(error)) throw error;

      const reconciledClients = await this.findClientsByTin(tin);
      const reconciledClient = reconciledClients[0];
      if (!reconciledClient) throw error;
      return { client: reconciledClient, created: false, updated: false };
    }
  }

  async listTaxes(): Promise<FactPtTax[]> {
    const result = await this.request<FactPtPage<FactPtTax>>('/taxes');
    return result.data ?? [];
  }

  /**
   * FACT.pt exposes a fuzzy `search` query. Filter locally so callers only
   * reuse a product whose stable reference is an exact match.
   */
  async findProductsByReference(reference: string): Promise<FactPtProduct[]> {
    const normalizedReference = reference.trim();
    if (!normalizedReference) return [];
    const result = await this.request<FactPtPage<FactPtProduct>>(
      `/products?search=${encodeURIComponent(normalizedReference)}`,
    );
    return (result.data ?? []).filter(
      (product) =>
        product.reference.trim().toLowerCase() ===
        normalizedReference.toLowerCase(),
    );
  }

  async createInvoiceReceipt(
    payload: FactPtInvoiceReceiptPayload,
  ): Promise<FactPtCreatedResource> {
    return this.request<FactPtCreatedResource>('/documents/invoicereceipt', {
      method: 'POST',
      body: payload,
    });
  }

  async createSimplifiedInvoice(
    payload: FactPtSimplifiedInvoicePayload,
  ): Promise<FactPtCreatedResource> {
    return this.request<FactPtCreatedResource>('/documents/simpleinvoice', {
      method: 'POST',
      body: payload,
    });
  }

  async downloadDocumentPdfResource(
    documentId: string,
  ): Promise<FactPtDownloadedPdf> {
    if (!documentId.trim()) {
      throw new Error('O ID do documento FACT.pt é obrigatório.');
    }

    return this.rateLimiter.run(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(
          `${this.config.baseUrl}/documents/${encodeURIComponent(documentId)}/download`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': this.config.apiKey,
              'api-version': this.config.apiVersion,
            },
            signal: controller.signal,
          },
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          throw new FactPtError({
            message: 'O download do PDF FACT.pt excedeu o tempo limite.',
            kind: 'timeout',
            retryable: true,
            cause: error,
          });
        }
        throw new FactPtError({
          message: 'Não foi possível descarregar o PDF FACT.pt.',
          kind: 'network',
          retryable: true,
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const payload = await readJsonEnvelope<FactPtErrorResponse>(response);
        const classification = classifyFactPtError(
          response.status,
          payload?.AppStatusCode,
        );
        throw new FactPtError({
          message: extractErrorMessage(payload),
          ...classification,
          httpStatus: payload?.HttpStatusCode ?? response.status,
          appStatusCode: payload?.AppStatusCode,
          details: payload?.AppResponse?.errors,
        });
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      if (contentType.includes('application/json')) {
        const payload = await readJsonEnvelope<FactPtErrorResponse>(response);
        if (payload?.AppStatusMsg === 'ERR') {
          const classification = classifyFactPtError(
            payload.HttpStatusCode ?? response.status,
            payload.AppStatusCode,
          );
          throw new FactPtError({
            message: extractErrorMessage(payload),
            ...classification,
            httpStatus: payload.HttpStatusCode ?? response.status,
            appStatusCode: payload.AppStatusCode,
            details: payload.AppResponse?.errors,
          });
        }
        throw new FactPtError({
          message: 'A API FACT.pt não devolveu um PDF.',
          kind: 'invalid_response',
          retryable: false,
          httpStatus: response.status,
        });
      }

      const pdf = new Uint8Array(await response.arrayBuffer());
      if (
        pdf.length < 4 ||
        pdf[0] !== 0x25 ||
        pdf[1] !== 0x50 ||
        pdf[2] !== 0x44 ||
        pdf[3] !== 0x46
      ) {
        throw new FactPtError({
          message: 'A API FACT.pt devolveu um ficheiro PDF inválido.',
          kind: 'invalid_response',
          retryable: false,
          httpStatus: response.status,
        });
      }
      return {
        bytes: pdf,
        filename: filenameFromContentDisposition(
          response.headers.get('content-disposition'),
        ),
      };
    });
  }

  async downloadDocumentPdf(documentId: string): Promise<Uint8Array> {
    return (await this.downloadDocumentPdfResource(documentId)).bytes;
  }
}
