type FactPtConfig = {
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
};

export type FactPtSourceType = 'store' | 'donation' | 'membership';

type FactPtResponse<T> = {
  HttpStatusCode?: number;
  AppStatusCode?: number;
  AppStatusMsg?: string;
  AppResponse?: T;
};

type FactPtErrorPayload = {
  errors?: Record<string, string | string[]>;
  message?: string;
};

export const FACTPT_DEFAULT_API_VERSION = '1.0.0';

const resolveFactPtApiKey = (type?: FactPtSourceType) => {
  const keyByType =
    type === 'store'
      ? process.env.FACTPT_API_KEY_STORE
      : type === 'donation'
      ? process.env.FACTPT_API_KEY_DONATION
      : type === 'membership'
      ? process.env.FACTPT_API_KEY_MEMBERSHIP
      : undefined;
  return keyByType || process.env.FACTPT_API_KEY || null;
};

const resolveAnyFactPtApiKey = () =>
  process.env.FACTPT_API_KEY ||
  process.env.FACTPT_API_KEY_STORE ||
  process.env.FACTPT_API_KEY_DONATION ||
  process.env.FACTPT_API_KEY_MEMBERSHIP ||
  null;

export const getFactPtConfig = (
  type?: FactPtSourceType,
  allowAny = false,
): FactPtConfig | null => {
  const baseUrl = process.env.FACTPT_BASE_URL;
  const apiKey = resolveFactPtApiKey(type) || (allowAny ? resolveAnyFactPtApiKey() : null);
  const apiVersion = process.env.FACTPT_API_VERSION || FACTPT_DEFAULT_API_VERSION;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, apiVersion };
};

const buildFactPtError = (payload?: FactPtResponse<FactPtErrorPayload> | null) => {
  if (!payload) return 'Resposta inválida do fact.pt.';
  const errorInfo = payload.AppResponse?.errors;
  if (errorInfo && Object.keys(errorInfo).length) {
    return Object.entries(errorInfo)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join(' | ');
  }
  return payload.AppResponse?.message || payload.AppStatusMsg || 'Erro desconhecido no fact.pt.';
};

export async function factptRequest<T>(
  config: FactPtConfig,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, any>,
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-auth-token': config.apiKey,
    'api-version': config.apiVersion,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload: FactPtResponse<T> | null = null;
  try {
    payload = (await response.json()) as FactPtResponse<T>;
  } catch {
    payload = null;
  }

  const statusMsg = payload?.AppStatusMsg;
  if (!response.ok || (statusMsg && statusMsg !== 'OK')) {
    throw new Error(buildFactPtError(payload as FactPtResponse<FactPtErrorPayload>));
  }

  if (!payload?.AppResponse) {
    throw new Error('Resposta incompleta do fact.pt.');
  }

  return payload.AppResponse;
}

export const downloadFactPtDocumentPdf = async (
  documentId: string,
  configOverride?: FactPtConfig,
): Promise<Buffer> => {
  const config = configOverride || getFactPtConfig(undefined, true);
  if (!config) {
    throw new Error('fact.pt nao configurado.');
  }
  const url = `${config.baseUrl.replace(/\/$/, '')}/documents/${encodeURIComponent(documentId)}/download`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-auth-token': config.apiKey,
      'api-version': config.apiVersion,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      payload?.AppResponse?.errors?.document ||
      payload?.AppStatusMsg ||
      'Erro ao descarregar documento.';
    throw new Error(message);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
};

export type FactPtClientInput = {
  name: string;
  tin?: number | null;
  forceTin?: boolean;
  address: string;
  zip: string;
  city: string;
  ric?: boolean;
  retention?: boolean;
  country: string;
  brand?: string;
  email?: string;
  site?: string;
  phone?: string | number;
  finalConsumer?: boolean;
};

export type FactPtDocumentInput = {
  client: { id: number | string };
  document?: {
    date?: string;
    paymentType?: number;
    duePayment?: string;
    additionalText?: boolean;
    comments?: string;
    markPaid?: boolean;
    reference?: string;
    retention?: number;
    download?: boolean;
    allowRound?: boolean;
    identifierId?: string;
    language?: string;
  };
  items: Array<Record<string, any>>;
};
