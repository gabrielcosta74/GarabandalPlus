import { getAppUrl } from './config';

type ReduniqApiConfig = {
  apiUrl: string;
  username: string;
  password: string;
};

export type ReduniqInitPayload = {
  amount: number;
  type: 'donation' | 'membership' | 'store';
  userId?: string;
  solution?: number | null;
  metadata?: Record<string, string>;
  orderRef?: string;
};

export type ReduniqInitResponse = {
  token: string;
  redirectUrl: string;
  urlPath?: string;
  orderRef: string;
};

export type ReduniqResultResponse = {
  result?: {
    code?: string;
    message?: string;
  };
  transaction?: {
    id?: string;
    status?: string;
    date?: string;
    extraData?: Array<{ name?: string; value?: string }>;
  };
  payment?: {
    amount?: string;
    action?: string;
    solution?: string;
  };
  privateData?: Array<{ name?: string; value?: string }>;
};

const getApiConfig = (): ReduniqApiConfig => {
  const apiUrl =
    process.env.REDUNIQ_API_URL ||
    (process.env.REDUNIQ_ENV === 'sandbox'
      ? 'https://pagamentos.sandbox.reduniq.pt/api-gateway/v7.0/rest/'
      : 'https://pagamentos.reduniq.pt/api-gateway/v7.0/rest/');

  const username = process.env.REDUNIQ_API_USERNAME || '';
  const password = process.env.REDUNIQ_API_PASSWORD || '';

  console.log('🔍 [REDUNIQ DEBUG] Environment:', process.env.REDUNIQ_ENV);
  console.log('🔍 [REDUNIQ DEBUG] Username:', username ? `${username.substring(0, 3)}***` : 'EMPTY');
  console.log('🔍 [REDUNIQ DEBUG] Password:', password ? `${password.substring(0, 3)}***` : 'EMPTY');
  console.log('🔍 [REDUNIQ DEBUG] API URL:', apiUrl);

  if (!username || !password) {
    throw new Error('Credenciais REDUNIQ não configuradas.');
  }

  return { apiUrl, username, password };
};

const toOrderTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
};

const requestReduniq = async <T>(payload: Record<string, unknown>) => {
  const { apiUrl } = getApiConfig();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as T;

  console.log('📡 [REDUNIQ DEBUG] Response Status:', response.status, response.statusText);
  console.log('📡 [REDUNIQ DEBUG] Response Data:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error((data as any)?.result?.message || 'Erro ao comunicar com a REDUNIQ.');
  }
  return data;
};

export const initReduniqPayment = async ({
  amount,
  type,
  userId,
  solution,
  metadata,
  orderRef: orderRefOverride,
}: ReduniqInitPayload): Promise<ReduniqInitResponse> => {
  const { username, password } = getApiConfig();
  const siteUrl = getAppUrl();
  const amountCents = Math.round(amount * 100);
  const orderRef = orderRefOverride || `reduniq_${type}_${Date.now()}`;
  const description =
    type === 'membership' ? 'Quota anual' : type === 'store' ? 'Compra loja online' : 'Doação';

  const privateData: Array<{ name: string; value: string }> = [
    { name: 'type', value: type },
    { name: 'orderRef', value: orderRef },
    ...(userId ? [{ name: 'userId', value: userId }] : []),
  ];

  if (metadata) {
    Object.entries(metadata).forEach(([name, value]) => {
      privateData.push({ name, value });
    });
  }

  const payload: Record<string, unknown> = {
    method: 'initPayment',
    api: { username, password },
    payment: {
      amount: amountCents,
      action: 100,
      description,
    },
    order: {
      ref: orderRef,
      amount: amountCents,
      taxes: 0,
      date: toOrderTimestamp(new Date()),
      shipping: '0',
    },
    privateData,
    mode: 'redirect',
    returnUrlOk: `${siteUrl}/thank-you?type=${type}&amount=${amount}&provider=reduniq&orderRef=${orderRef}`,
    returnUrlError: `${siteUrl}/thank-you?type=${type}&amount=${amount}&provider=reduniq&status=error&orderRef=${orderRef}`,
    languageCode: 'por',
  };

  if (solution) {
    (payload.payment as { solution?: number }).solution = solution;
  }

  const response = await requestReduniq<{
    result?: { code?: string; message?: string };
    token?: string;
    redirectUrl?: string;
    urlPath?: string;
  }>(payload);

  if (response?.result?.code !== '00000000') {
    throw new Error(response?.result?.message || 'Pagamento não inicializado na REDUNIQ.');
  }

  if (!response?.token || !response?.redirectUrl) {
    throw new Error('Resposta incompleta da REDUNIQ.');
  }

  return {
    token: response.token,
    redirectUrl: response.redirectUrl,
    urlPath: response.urlPath,
    orderRef,
  };
};

export const getReduniqResult = async (token: string): Promise<ReduniqResultResponse> => {
  const { username, password } = getApiConfig();
  return requestReduniq<ReduniqResultResponse>({
    method: 'getResult',
    api: { username, password },
    token,
  });
};
