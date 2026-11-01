import { getBrowserAccessToken } from './supabase-browser';

export type HouseTrainingApplication = {
  id: string;
  status: 'pending' | 'assigned' | 'completed' | 'code_issued' | 'declined';
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  availability_notes: string | null;
  created_at: string;
  completed_at: string | null;
  cohort: { title: string; starts_at: string; meeting_url: string | null } | null;
  code: string | null;
  codeValidUntil: string | null;
};

export type HouseTrainingStatus = {
  eligible: boolean;
  activeCode: { code: string | null; valid_until: string | null } | null;
  application: HouseTrainingApplication | null;
};

async function request<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const token = await getBrowserAccessToken();
  const res = await fetch('/api/member/house/training', {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Não foi possível concluir o pedido.');
  return data;
}

export const getHouseTrainingStatus = () => request<HouseTrainingStatus>('GET');
export async function applyForHouseTraining(input: { name: string; email: string; phone: string; availability: string }) {
  await request<{ ok: true; id: string }>('POST', input);
}
