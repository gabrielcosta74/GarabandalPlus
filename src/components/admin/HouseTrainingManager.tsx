'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Check, Copy, GraduationCap, Loader2, Pencil, Plus, UserRoundCheck, Video } from 'lucide-react';
import { toast } from 'sonner';
import { getBrowserAccessToken } from '../../lib/supabase-browser';

type Cohort = { id: string; title: string; starts_at: string; meeting_url: string | null; capacity: number; notes: string | null };
type Application = {
  id: string; membro_id: string; cohort_id: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'code_issued' | 'declined';
  contact_name: string; contact_email: string; contact_phone: string;
  availability_notes: string | null; created_at: string; completed_at: string | null;
  membros: { numero_socio: string | null } | null;
};
type Data = { cohorts: Cohort[]; applications: Application[] };
type Form = { title: string; startsAt: string; meetingUrl: string; capacity: string; notes: string };
const emptyForm: Form = { title: '', startsAt: '', meetingUrl: '', capacity: '20', notes: '' };
const date = (value: string) => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const localInput = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const badge: Record<Application['status'], string> = {
  pending: 'Pendente', assigned: 'Turma atribuída', completed: 'Concluída', code_issued: 'Código emitido', declined: 'Não aceite',
};

async function call(method: 'GET' | 'PATCH', body?: unknown) {
  const token = await getBrowserAccessToken();
  const res = await fetch('/api/admin/house/training', {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Falha ao guardar a formação.');
  return data;
}

export default function HouseTrainingManager() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const load = useCallback(async () => {
    try { setData(await call('GET') as Data); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Falha ao carregar.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cohorts = data?.cohorts ?? [];
  const applications = data?.applications ?? [];
  const pending = applications.filter(app => app.status === 'pending');
  const grouped = cohorts.map(cohort => ({
    cohort, members: applications.filter(app => app.cohort_id === cohort.id && app.status !== 'declined'),
  }));

  const act = async (body: Record<string, unknown>, success: string, applicant?: Application): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await call('PATCH', body);
      if (result.code && applicant) setIssued({ name: applicant.contact_name, code: result.code });
      toast.success(success);
      await load();
      return true;
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Falha ao guardar.'); return false; }
    finally { setBusy(false); }
  };
  const saveCohort = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.startsAt) return;
    const saved = await act({ action: editing ? 'update_cohort' : 'create_cohort', id: editing,
      title: form.title, startsAt: new Date(form.startsAt).toISOString(), meetingUrl: form.meetingUrl,
      capacity: Number(form.capacity), notes: form.notes }, editing ? 'Turma atualizada.' : 'Turma criada.');
    if (saved) { setEditing(null); setForm(emptyForm); }
  };
  const edit = (cohort: Cohort) => {
    setEditing(cohort.id);
    setForm({ title: cohort.title, startsAt: localInput(cohort.starts_at), meetingUrl: cohort.meeting_url ?? '', capacity: String(cohort.capacity), notes: cohort.notes ?? '' });
    document.getElementById('house-training-cohort-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <div className="grid gap-7 text-slate-800">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-700"><Video size={22} /></span><div><h2 className="text-xl font-bold">Formação online da Casa</h2><p className="text-sm text-slate-500">Crie turmas, atribua membros e emita o código depois de concluírem a formação.</p></div></div>
      <form id="house-training-cohort-form" onSubmit={saveCohort} className="grid gap-4 scroll-mt-24 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">Nome da turma<input className="rounded-xl border border-slate-300 px-3 py-2.5" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required minLength={3} maxLength={120} placeholder="Formação online · novembro" /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Data e hora<input className="rounded-xl border border-slate-300 px-3 py-2.5" type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} required /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Ligação da aula (HTTPS)<input className="rounded-xl border border-slate-300 px-3 py-2.5" type="url" value={form.meetingUrl} onChange={e => setForm({ ...form, meetingUrl: e.target.value })} maxLength={500} placeholder="https://…" /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Vagas<input className="rounded-xl border border-slate-300 px-3 py-2.5" type="number" min={1} max={100} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required /></label>
        <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Notas internas<textarea className="min-h-20 rounded-xl border border-slate-300 px-3 py-2.5" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f4c81] px-4 py-2 font-bold text-white transition-colors hover:bg-[#0a355d] disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={17} /> : editing ? <Check size={17} /> : <Plus size={17} />}{editing ? 'Guardar turma' : 'Criar turma'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50">Cancelar edição</button>}</div>
      </form>
    </section>

    {issued && <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4"><Check className="text-emerald-700" size={20} /><div className="flex-1"><strong>Código emitido para {issued.name}</strong><p className="font-mono text-lg font-bold tracking-wider">{issued.code}</p><small>O membro já o pode consultar na área da Casa.</small></div><button type="button" onClick={() => { void navigator.clipboard.writeText(issued.code); toast.success('Código copiado.'); }} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-3 py-2 font-semibold hover:bg-emerald-100"><Copy size={16} /> Copiar</button></div>}

    {loading ? <p className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /> A carregar turmas…</p> : <>
      <section className="grid gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><GraduationCap size={21} /> Pedidos por atribuir <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">{pending.length}</span></h2>
        {pending.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-500">Não há pedidos pendentes.</p> : pending.map(app => <div key={app.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Applicant app={app} /><div className="mt-4 flex flex-wrap items-center gap-2"><select aria-label={`Turma para ${app.contact_name}`} value={selected[app.id] ?? ''} onChange={e => setSelected({ ...selected, [app.id]: e.target.value })} className="min-h-11 min-w-56 rounded-xl border border-slate-300 px-3"><option value="">Escolher turma</option>{cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.title} · {date(cohort.starts_at)}</option>)}</select>
            <button type="button" disabled={busy || !selected[app.id]} onClick={() => void act({ action: 'assign', id: app.id, cohortId: selected[app.id] }, 'Membro atribuído à turma.')} className="min-h-11 rounded-xl bg-[#0f4c81] px-4 font-bold text-white hover:bg-[#0a355d] disabled:opacity-50">Atribuir turma</button>
            <button type="button" disabled={busy} onClick={() => void act({ action: 'decline', id: app.id }, 'Pedido não aceite.')} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold hover:bg-slate-50 disabled:opacity-50">Não aceitar</button></div>
        </div>)}
      </section>
      <section className="grid gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays size={21} /> Turmas <span className="text-sm font-normal text-slate-500">({cohorts.length})</span></h2>
        {grouped.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-500">Crie a primeira turma acima.</p> : grouped.map(({ cohort, members }) => <div key={cohort.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4"><div className="flex-1"><h3 className="font-bold">{cohort.title}</h3><p className="text-sm text-slate-500">{date(cohort.starts_at)} · {members.length}/{cohort.capacity} vagas</p>{cohort.meeting_url && <a className="text-sm font-semibold text-blue-700 underline" href={cohort.meeting_url} target="_blank" rel="noopener noreferrer">Ligação da aula</a>}</div><button type="button" onClick={() => edit(cohort)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 font-semibold hover:bg-slate-50"><Pencil size={15} /> Editar</button></div>
          {members.length === 0 ? <p className="p-4 text-sm text-slate-500">Ainda não há membros nesta turma.</p> : <div className="divide-y divide-slate-100">{members.map(app => <div key={app.id} className="p-4"><Applicant app={app} />
            <div className="mt-3 flex flex-wrap gap-2">{app.status === 'assigned' && <><button type="button" disabled={busy} onClick={() => void act({ action: 'complete', id: app.id }, 'Formação marcada como concluída.')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><UserRoundCheck size={16} /> Marcar concluída</button><button type="button" disabled={busy} onClick={() => void act({ action: 'decline', id: app.id }, 'Pedido não aceite.')} className="rounded-xl border border-slate-300 px-3 font-semibold hover:bg-slate-50">Não aceitar</button></>}
              {app.status === 'completed' && <button type="button" disabled={busy} onClick={() => void act({ action: 'issue_code', id: app.id }, 'Código emitido.', app)} className="min-h-10 rounded-xl bg-[#0f4c81] px-4 font-bold text-white hover:bg-[#0a355d] disabled:opacity-50">Emitir código pessoal</button>}
              {app.status === 'code_issued' && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">Código emitido</span>}
              {app.status === 'assigned' && <select aria-label={`Mover ${app.contact_name} de turma`} value={selected[app.id] ?? app.cohort_id ?? ''} onChange={e => setSelected({ ...selected, [app.id]: e.target.value })} className="min-h-10 rounded-xl border border-slate-300 px-2 text-sm"><option value={app.cohort_id ?? ''}>Mover para outra turma</option>{cohorts.filter(c => c.id !== app.cohort_id).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>}
              {app.status === 'assigned' && selected[app.id] && selected[app.id] !== app.cohort_id && <button type="button" disabled={busy} onClick={() => void act({ action: 'assign', id: app.id, cohortId: selected[app.id] }, 'Turma alterada.')} className="rounded-xl border border-blue-300 px-3 text-sm font-bold text-blue-800 hover:bg-blue-50">Guardar mudança</button>}
            </div></div>)}</div>}
        </div>)}
      </section>
    </>}
  </div>;
}

function Applicant({ app }: { app: Application }) {
  return <div className="flex flex-wrap items-start gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-600"><GraduationCap size={18} /></span><div className="min-w-0 flex-1"><strong>{app.contact_name}</strong><span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{badge[app.status]}</span><p className="mt-1 break-words text-sm text-slate-600">{app.membros?.numero_socio ? `Sócio ${app.membros.numero_socio} · ` : ''}{app.contact_email} · {app.contact_phone}</p><p className="text-xs text-slate-400">Pedido em {date(app.created_at)}</p>{app.availability_notes && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><strong>Disponibilidade:</strong> {app.availability_notes}</p>}</div></div>;
}
