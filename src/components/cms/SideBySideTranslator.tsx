"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Save, Plus, Loader2, AlertTriangle, CheckCircle2, FileText, Wand2 } from 'lucide-react';
import { savePageAction, savePostAction, createTranslationPeerAction, translateGroupAction } from '../../app/admin/cms/actions';
import type { CmsRecord, CmsContentType, CmsLocale, CmsStatus, TranslationGroup } from '../../lib/cms/queries';
import type { EditorHandle } from './editor/TipTapEditor';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { MtReviewBadge } from './MtReviewBadge';

const TipTapEditor = dynamic(() => import('./editor/TipTapEditor').then((m) => m.TipTapEditor), {
  ssr: false,
  loading: () => <div style={{ padding: 16, color: 'var(--muted)' }}>A carregar editor…</div>,
});

type Props = {
  type: CmsContentType;
  groupId: string;
  group: TranslationGroup;
};

// PT is the editorial source; every other locale is translated from it.
const TARGET_LOCALES: { locale: CmsLocale; label: string; flag: string }[] = [
  { locale: 'en', label: 'English', flag: '🇬🇧' },
  { locale: 'es', label: 'Español', flag: '🇪🇸' },
  { locale: 'fr', label: 'Français', flag: '🇫🇷' },
  { locale: 'it', label: 'Italiano', flag: '🇮🇹' },
];

export function SideBySideTranslator({ type, groupId, group: groupInitial }: Props) {
  const router = useRouter();
  const [group, setGroup] = useState(groupInitial);
  const [translatingLocale, setTranslatingLocale] = useState<CmsLocale | null>(null);
  const [creatingLocale, setCreatingLocale] = useState<CmsLocale | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const pt = group.pt;
  const missingCount = TARGET_LOCALES.filter((t) => !group[t.locale]?.content_html?.trim()).length;

  const onTranslateAll = async () => {
    if (!pt || batchRunning) return;
    setBatchRunning(true);
    setMessage(null);
    try {
      const r = await translateGroupAction(type, groupId);
      if (!r.ok) {
        setMessage({ kind: 'err', text: r.message ?? 'Falha na tradução em lote.' });
        return;
      }
      const done = r.results.filter((x) => x.status === 'translated' || x.status === 'created');
      const errors = r.results.filter((x) => x.status === 'error');
      const parts: string[] = [];
      if (done.length) parts.push(`${done.length} traduzida(s): ${done.map((d) => d.locale.toUpperCase()).join(', ')}`);
      if (errors.length) parts.push(`${errors.length} com erro: ${errors.map((e) => `${e.locale.toUpperCase()} (${e.message})`).join('; ')}`);
      setMessage({ kind: errors.length ? 'err' : 'ok', text: parts.join(' · ') || 'Nada em falta para traduzir.' });
      router.refresh();
    } finally {
      setBatchRunning(false);
    }
  };

  const patchLocale = (locale: CmsLocale, updated: { id: string; updated_at: string; status: CmsStatus; slug: string }) =>
    setGroup((cur) => ({ ...cur, [locale]: cur[locale] ? { ...cur[locale]!, ...updated } : cur[locale] }));

  const onCreatePeer = async (target: CmsLocale) => {
    const source = pt ?? group.en;
    if (!source) return;
    setCreatingLocale(target);
    setMessage(null);
    try {
      const r = await createTranslationPeerAction(type, source.id, target, false);
      if (!r.ok) {
        setMessage({ kind: 'err', text: r.message });
      } else {
        setMessage({ kind: 'ok', text: `Criado peer ${target.toUpperCase()} — a recarregar…` });
        router.refresh();
      }
    } finally {
      setCreatingLocale(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link href="/admin/cms/translations" className="cms-back-link" title="Voltar">
          <ArrowLeft size={16} />
        </Link>
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          {type === 'page' ? 'Página' : 'Artigo'} · grupo <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.75rem' }}>{groupId.slice(0, 8)}</code>
        </span>
        {pt && missingCount > 0 && (
          <button
            type="button"
            onClick={onTranslateAll}
            disabled={batchRunning}
            className="cms-btn cms-btn-primary"
            style={{ marginLeft: 'auto' }}
            title="Cria e traduz do PT todas as línguas em falta de uma vez"
          >
            {batchRunning ? <Loader2 size={14} className="cms-spin" /> : <Wand2 size={14} />}
            Traduzir do PT o que falta ({missingCount})
          </button>
        )}
      </div>

      {message && (
        <div className={`cms-editor-message cms-editor-message-${message.kind}`}>
          {message.kind === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {message.text}
        </div>
      )}

      <div className="cms-translate-grid">
        <style>{`
          .cms-translate-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 1rem;
            align-items: start;
          }
          @media (max-width: 820px) { .cms-translate-grid { grid-template-columns: 1fr; } }
        `}</style>

        <PeerColumn
          label="Português"
          flag="🇵🇹"
          locale="pt"
          record={pt}
          type={type}
          onSaved={(updated) => patchLocale('pt', updated)}
          showAiAction={false}
          onCreate={() => onCreatePeer('pt')}
          creating={creatingLocale === 'pt'}
        />

        {TARGET_LOCALES.map((t) => (
          <PeerColumn
            key={t.locale}
            label={t.label}
            flag={t.flag}
            locale={t.locale}
            record={group[t.locale]}
            type={type}
            onSaved={(updated) => patchLocale(t.locale, updated)}
            showAiAction={!!pt}
            ptSource={pt}
            translating={translatingLocale === t.locale}
            setTranslating={(v) => setTranslatingLocale(v ? t.locale : null)}
            onCreate={() => onCreatePeer(t.locale)}
            creating={creatingLocale === t.locale}
          />
        ))}
      </div>
    </div>
  );
}

type ColumnProps = {
  label: string;
  flag: string;
  locale: CmsLocale;
  record: CmsRecord | null;
  type: CmsContentType;
  onSaved: (updated: { id: string; updated_at: string; status: CmsStatus; slug: string }) => void;
  showAiAction: boolean;
  ptSource?: CmsRecord | null;
  translating?: boolean;
  setTranslating?: (v: boolean) => void;
  onCreate: () => void;
  creating: boolean;
};

function PeerColumn(p: ColumnProps) {
  const editorRef = useRef<EditorHandle>(null);
  const [title, setTitle] = useState(p.record?.title ?? '');
  const [metaDescription, setMetaDescription] = useState(p.record?.meta_description ?? '');
  const [savePending, startSave] = useTransition();
  const [bodyKey, setBodyKey] = useState(0); // bumps to force editor re-mount with new initial HTML

  const onSave = () => {
    if (!p.record) return;
    startSave(async () => {
      const html = editorRef.current?.getHtml() ?? p.record!.content_html ?? '';
      const json = editorRef.current?.getJson() ?? null;
      const action = p.type === 'page' ? savePageAction : savePostAction;
      // Preserve all current fields; only push title/meta/body
      const payload = {
        id: p.record!.id,
        title,
        slug: p.record!.slug,
        locale: p.locale,
        meta_title: p.record!.meta_title,
        meta_description: metaDescription,
        og_image_url: p.record!.og_image_url,
        ...(p.type === 'page'
          ? { category: p.record!.category ?? null, parent_slug: p.record!.parent_slug ?? null }
          : {
              cover_image_url: p.record!.cover_image_url ?? null,
              tags: p.record!.tags ?? [],
              featured: !!p.record!.featured,
              published_at: p.record!.published_at,
            }),
        status: p.record!.status,
        content_html: html,
        content_json: json,
        client_version: p.record!.updated_at,
      } as Parameters<typeof savePageAction>[0] & Parameters<typeof savePostAction>[0];
      const r = await (action as (p: typeof payload) => ReturnType<typeof savePageAction>)(payload);
      if (r.ok) p.onSaved(r.row);
    });
  };

  const onAiTranslate = async () => {
    if (!p.ptSource || !p.record || !p.setTranslating) return;
    if (!supabaseBrowser) return;
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) return;
    p.setTranslating(true);
    try {
      const sourceHtml = p.ptSource.content_html ?? '';
      const sourceTitle = p.ptSource.title;
      const sourceMeta = p.ptSource.meta_description ?? '';
      const call = (source: string, kind: 'body' | 'short') =>
        fetch('/api/admin/cms/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ source, sourceLocale: 'pt', targetLocale: p.locale, kind }),
        }).then((r) => r.json());

      const [bodyRes, titleRes, metaRes] = await Promise.all([
        sourceHtml ? call(sourceHtml, 'body') : Promise.resolve({ translated: '' }),
        call(sourceTitle, 'short'),
        sourceMeta ? call(sourceMeta, 'short') : Promise.resolve({ translated: '' }),
      ]);

      if (titleRes.translated) setTitle(titleRes.translated);
      if (metaRes.translated) setMetaDescription(metaRes.translated);
      if (bodyRes.translated && p.record) {
        // Mutate the record's content_html for re-mount
        p.record.content_html = bodyRes.translated;
        setBodyKey((k) => k + 1);
      }
    } finally {
      p.setTranslating(false);
    }
  };

  if (!p.record) {
    return (
      <div className="cms-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{p.flag}</span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{p.label}</h2>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          Esta tradução ainda não existe. Cria-a vazia e depois usa “Traduzir do PT”.
        </p>
        <button type="button" onClick={p.onCreate} disabled={p.creating} className="cms-btn cms-btn-primary">
          {p.creating ? <Loader2 size={14} className="cms-spin" /> : <Plus size={14} />} Criar {p.label}
        </button>
      </div>
    );
  }

  return (
    <div className="cms-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          background: '#f8fafc',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{p.flag}</span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{p.label}</h2>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
            /{p.record.slug}
          </span>
          {p.record.mt_unreviewed && <MtReviewBadge compact />}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {p.showAiAction && (
            <button type="button" onClick={onAiTranslate} disabled={p.translating} className="cms-btn cms-btn-secondary">
              {p.translating ? <Loader2 size={14} className="cms-spin" /> : <Sparkles size={14} />} Traduzir do PT
            </button>
          )}
          <button type="button" onClick={onSave} disabled={savePending} className="cms-btn cms-btn-primary">
            {savePending ? <Loader2 size={14} className="cms-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      </header>

      <div style={{ padding: '1rem' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-serif)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.4rem',
            letterSpacing: '-0.01em',
          }}
        />
        <textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Meta description (140-160 chars)"
          rows={2}
          className="cms-input"
          style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
          <FileText size={12} /> Body
        </div>
        <TipTapEditor
          key={`${p.record.id}-${bodyKey}`}
          ref={editorRef}
          initialHtml={p.record.content_html ?? ''}
          placeholder={`Conteúdo em ${p.label}…`}
        />
      </div>
    </div>
  );
}
