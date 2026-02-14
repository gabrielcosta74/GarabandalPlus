type ReduniqInitParams = {
    amount: number; // Amount in EUR (e.g., 10.50)
    orderRef: string;
    customerName?: string;
    customerEmail?: string;
    returnUrlOk: string;
    returnUrlError: string;
    notificationUrl?: string;
    description?: string;
    solution?: number;
    languageCode?: string;
    action?: 100 | 101;
    mode?: 'redirect' | 'lightbox' | 'iframe' | 'webless';
    targetOriginUrl?: string;
};

type ReduniqInitResponse = {
    success: boolean;
    url?: string;
    error?: string;
    transactionId?: string;
    token?: string;
    resultCode?: string;
    raw?: any;
};

type ReduniqResultResponse = {
    success: boolean;
    error?: string;
    resultCode?: string;
    transactionId?: string;
    status?: 'success' | 'pending' | 'failed' | 'unknown';
    orderRef?: string;
    raw?: any;
};

type PostResult = {
    ok: boolean;
    status: number;
    data?: any;
    error?: string;
    text?: string;
};

export class ReduniqClient {
    private username: string;
    private secret: string;
    private endpoint: string;

    constructor() {
        this.username = process.env.REDUNIQ_API_USER || '';
        this.secret = process.env.REDUNIQ_API_PASSWORD || '';
        this.endpoint = process.env.REDUNIQ_API_ENDPOINT || '';

        if (!this.username || !this.secret || !this.endpoint) {
            console.warn('Reduniq credentials not fully configured.');
        }
    }

    private getEndpoint() {
        return this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`;
    }

    private formatDateTime(date: Date) {
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    }

    private splitName(fullName?: string) {
        const trimmed = (fullName || '').trim();
        if (!trimmed) return { firstName: '', lastName: '' };
        const parts = trimmed.split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ').trim();
        return { firstName, lastName };
    }

    private async post(payload: any): Promise<PostResult> {
        if (!this.endpoint) {
            return { ok: false, status: 0, error: 'Reduniq endpoint not configured.' };
        }

        let response: Response;
        const controller = new AbortController();
        const timeoutMs = Number(process.env.REDUNIQ_API_TIMEOUT_MS || 15000);
        const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 15000);
        try {
            response = await fetch(this.getEndpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify(payload)
            });
        } catch (error: any) {
            return {
                ok: false,
                status: 0,
                error: `Fetch failed: ${error?.message || 'Unknown network error'}`,
            };
        } finally {
            clearTimeout(timeout);
        }

        const text = await response.text();

        if (text.trim().startsWith('<')) {
            return {
                ok: false,
                status: response.status,
                error: `Reduniq API returned HTML (status ${response.status}). Check endpoint/credentials.`,
                text
            };
        }

        let data: any = null;
        try {
            data = JSON.parse(text);
        } catch (error: any) {
            return {
                ok: false,
                status: response.status,
                error: 'Invalid JSON response from Reduniq API.',
                text
            };
        }

        return { ok: response.ok, status: response.status, data };
    }

    async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
        if (!this.username || !this.secret || !this.endpoint) {
            return { success: false, message: 'Missing REDUNIQ credentials or endpoint.' };
        }

        try {
            const payload = {
                method: 'getResult',
                api: { username: this.username, password: this.secret },
                token: 'invalid-token-check',
            };

            const result = await this.post(payload);

            if (!result.ok) {
                return { success: false, message: result.error || `HTTP ${result.status}`, data: result.text };
            }

            const resultCode = result.data?.result?.code;
            if (resultCode === '00100001') {
                return { success: false, message: 'Authentication failed (check REDUNIQ_API_USER/REDUNIQ_API_PASSWORD).', data: result.data };
            }
            if (resultCode === '00100002') {
                return { success: false, message: 'Merchant has no associated payment solutions.', data: result.data };
            }
            return {
                success: true,
                message: `Gateway reachable (result.code ${resultCode || 'unknown'})`,
                data: result.data
            };
        } catch (error: any) {
            return { success: false, message: `Network/Client error: ${error.message}` };
        }
    }

    async initiatePayment(params: ReduniqInitParams): Promise<ReduniqInitResponse> {
        try {
            if (!this.username || !this.secret || !this.endpoint) {
                return { success: false, error: 'Reduniq not configured.' };
            }

            const amountCents = Math.round(params.amount * 100);
            const orderDate = this.formatDateTime(new Date());
            const { firstName, lastName } = this.splitName(params.customerName);
            const action = params.action ?? 101;

            const buyer: Record<string, string> = {};
            if (firstName) buyer.firstName = firstName;
            if (lastName) buyer.lastName = lastName;
            if (params.customerEmail) buyer.email = params.customerEmail.trim();

            const payload: any = {
                method: 'initPayment',
                api: {
                    username: this.username,
                    password: this.secret,
                },
                payment: {
                    amount: amountCents,
                    action,
                    description: (params.description || 'Pagamento').slice(0, 255),
                    ...(params.solution ? { solution: params.solution } : {})
                },
                order: {
                    ref: params.orderRef,
                    amount: amountCents,
                    taxes: 0,
                    date: orderDate,
                },
                ...(params.mode ? { mode: params.mode } : {}),
                returnUrlOk: params.returnUrlOk,
                returnUrlError: params.returnUrlError,
                ...(params.notificationUrl ? { notificationUrl: params.notificationUrl } : {}),
                ...(params.targetOriginUrl ? { targetOriginUrl: params.targetOriginUrl } : {}),
                ...(params.languageCode ? { languageCode: params.languageCode } : {}),
                privateData: [
                    { name: 'orderRef', value: params.orderRef }
                ],
                ...(Object.keys(buyer).length ? { buyer } : {})
            };

            const result = await this.post(payload);

            if (!result.ok) {
                return { success: false, error: result.error || `HTTP ${result.status}`, raw: result.text };
            }

            const data = result.data || {};
            const resultCode = data?.result?.code;
            if (resultCode && resultCode !== '00000000') {
                return {
                    success: false,
                    error: data?.result?.message || `Reduniq error (${resultCode})`,
                    resultCode,
                    raw: data
                };
            }

            const redirectUrl = data.redirectUrl || data.url || data.payment_url;
            if (!redirectUrl) {
                return { success: false, error: 'No redirect URL returned by Reduniq.', raw: data };
            }

            return {
                success: true,
                url: redirectUrl,
                transactionId: data?.transaction?.id,
                token: data?.token,
                resultCode,
                raw: data
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async getResult(token: string): Promise<PostResult> {
        const payload = {
            method: 'getResult',
            api: { username: this.username, password: this.secret },
            token,
        };

        return await this.post(payload);
    }

    async doCapture(params: {
        transactionId: string;
        amountCents: number;
        action?: 200 | 201;
        reference?: string;
        comment?: string;
    }): Promise<PostResult> {
        const payload: any = {
            method: 'doCapture',
            api: { username: this.username, password: this.secret },
            transaction: { id: params.transactionId },
            payment: { amount: params.amountCents, action: params.action ?? 200 },
            ...(params.reference ? { reference: params.reference } : {}),
            ...(params.comment ? { comment: params.comment } : {}),
        };
        return await this.post(payload);
    }

    async doRefund(params: {
        transactionId: string;
        amountCents: number;
        reference?: string;
        comment?: string;
    }): Promise<PostResult> {
        const payload: any = {
            method: 'doRefund',
            api: { username: this.username, password: this.secret },
            transaction: { id: params.transactionId },
            payment: { amount: params.amountCents, action: 300 },
            ...(params.reference ? { reference: params.reference } : {}),
            ...(params.comment ? { comment: params.comment } : {}),
        };
        return await this.post(payload);
    }

    async doVoid(params: {
        transactionId: string;
        reference?: string;
        comment?: string;
    }): Promise<PostResult> {
        const payload: any = {
            method: 'doVoid',
            api: { username: this.username, password: this.secret },
            transaction: { id: params.transactionId },
            ...(params.reference ? { reference: params.reference } : {}),
            ...(params.comment ? { comment: params.comment } : {}),
        };
        return await this.post(payload);
    }

    async searchTransactions(params: {
        startDate?: string; // YYYY-MM-DD
        endDate?: string; // YYYY-MM-DD
        orderRef?: string;
        transactionId?: string;
        solution?: number;
        status?: 1 | 2 | 3 | 4;
        offset?: number;
        limit?: number;
    }): Promise<PostResult> {
        const payload: any = {
            method: 'searchTransactions',
            api: { username: this.username, password: this.secret },
            filter: {
                ...(params.startDate ? { startDate: params.startDate } : {}),
                ...(params.endDate ? { endDate: params.endDate } : {}),
                ...(params.orderRef ? { orderRef: params.orderRef } : {}),
                ...(params.transactionId ? { transactionId: params.transactionId } : {}),
                ...(typeof params.solution === 'number' ? { solution: params.solution } : {}),
                ...(typeof params.status === 'number' ? { status: String(params.status) } : {}),
            },
            ...(typeof params.offset === 'number' ? { offset: params.offset } : {}),
            ...(typeof params.limit === 'number' ? { limit: params.limit } : {}),
        };
        return await this.post(payload);
    }

    async getOrderStatus(token: string): Promise<ReduniqResultResponse> {
        try {
            if (!this.username || !this.secret || !this.endpoint) {
                return { success: false, error: 'Reduniq not configured.' };
            }

            const result = await this.getResult(token);
            if (!result.ok) {
                return { success: false, error: result.error || `HTTP ${result.status}`, raw: result.text };
            }

            const data = result.data || {};
            const resultCode = data?.result?.code;
            const statusCode = String(data?.transaction?.status || '');

            // Gateway-level errors where we should not try to interpret transaction.status.
            if (typeof resultCode === 'string') {
                if (resultCode === '00100007') {
                    return { success: false, error: 'Invalid token', resultCode, raw: data };
                }
                // "payment process not started / in progress" are not terminal errors
                if (resultCode !== '00100008' && resultCode !== '00100009') {
                    if (resultCode.startsWith('001000') || resultCode.startsWith('002000') || resultCode.startsWith('003000')) {
                        return {
                            success: false,
                            error: data?.result?.message || `Reduniq gateway error (${resultCode})`,
                            resultCode,
                            raw: data,
                        };
                    }
                }
            }

            let status: ReduniqResultResponse['status'] = 'unknown';
            if (statusCode === '4') status = 'success';
            else if (statusCode === '3') status = 'failed';
            else if (statusCode === '0' || statusCode === '1' || statusCode === '2' || statusCode === '') status = 'pending';

            // Some async methods return a "waiting confirmation" code (example: 00800000)
            if (typeof resultCode === 'string' && resultCode.startsWith('008')) status = 'pending';

            const privateData = Array.isArray(data?.privateData) ? data.privateData : [];
            const orderRef =
                data?.order?.ref ||
                privateData.find((item: any) => item?.name === 'orderRef')?.value ||
                privateData.find((item: any) => item?.name === 'order.ref')?.value;

            return {
                success: true,
                status,
                resultCode,
                transactionId: data?.transaction?.id,
                orderRef,
                raw: data
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}

export const reduniqClient = new ReduniqClient();
