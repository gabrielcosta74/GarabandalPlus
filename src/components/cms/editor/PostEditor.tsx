"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Clock, Eye, History, Link2 as LinkIcon, Monitor, Save, Search, Settings2, Smartphone, Star, Tablet, Tags } from 'lucide-react';
import Link from 'next/link';
import { ArticleHero } from '../../content/ArticleHero';
import { savePostAction } from '../../../app/admin/cms/actions';
import type { CmsRecord, CmsLocale, CmsStatus } from '../../../lib/cms/queries';
import type { EditorHandle } from './TipTapEditor';
import { useAutosave } from './useAutosave';
import { AutosaveBadge } from './AutosaveBadge';
import { SlugInput } from './SlugInput';
import { MediaPicker } from '../MediaPicker';
import { HeroCoverOverlay } from './HeroCoverOverlay';
import { TranslationCoverageBar } from './TranslationCoverageBar';
import { MtReviewBadge } from '../MtReviewBadge';
import './layout.css';

const TipTapEditor = dynamic(() => import('./TipTapEditor').then((m) => m.TipTapEditor), {
  ssr: false,
  loading: () => <div style={{ padding: 24, color: 'var(--muted)' }}>A carregar editor...</div>,
});

const statusOptions: { value: CmsStatus; label: string }[] = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'published', label: 'Publicado' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'archived', label: 'Arquivado' },
];

type Device = 'mobile' | 'tablet' | 'desktop';

export function PostEditor({ initial, groupId, peerLocales = [] }: { initial: CmsRecord; groupId?: string; peerLocales?: CmsLocale[] }) {
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [locale, setLocale] = useState<CmsLocale>(initial.locale);
  const [metaTitle, setMetaTitle] = useState(initial.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(initial.meta_description ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(initial.og_image_url ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(initial.cover_image_url ?? '');
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(', '));
  const [featured, setFeatured] = useState(!!initial.featured);
  const [status, setStatus] = useState<CmsStatus>(initial.status);
  const [publishedAt, setPublishedAt] = useState(initial.published_at?.slice(0, 16) ?? '');
  const [version, setVersion] = useState(initial.updated_at);
  const [bodyRev, setBodyRev] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const editorRef = useRef<EditorHandle>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const stateRef = useRef({ title, slug, locale, metaTitle, metaDescription, ogImageUrl, coverImageUrl, tagsText, featured, status, publishedAt, version });
  stateRef.current = { title, slug, locale, metaTitle, metaDescription, ogImageUrl, coverImageUrl, tagsText, featured, status, publishedAt, version };

  const performSave = useCallback(
    async (overrideStatus?: CmsStatus): Promise<{ ok: boolean }> => {
      const html = editorRef.current?.getHtml() ?? '';
      const json = editorRef.current?.getJson() ?? null;
      const s = stateRef.current;
      const tags = s.tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      const result = await savePostAction({
        id: initial.id,
        title: s.title,
        slug: s.slug,
        locale: s.locale,
        meta_title: s.metaTitle,
        meta_description: s.metaDescription,
        og_image_url: s.ogImageUrl,
        cover_image_url: s.coverImageUrl,
        tags,
        featured: s.featured,
        status: overrideStatus ?? s.status,
        published_at: s.publishedAt ? new Date(s.publishedAt).toISOString() : null,
        content_html: html,
        content_json: json,
        client_version: s.version,
      });
      if (result.ok) {
        setStatus(result.row.status);
        setVersion(result.row.updated_at);
      }
      return { ok: result.ok };
    },
    [initial.id],
  );

  const signature = JSON.stringify({
    title, slug, locale, metaTitle, metaDescription, ogImageUrl, coverImageUrl,
    tagsText, featured, publishedAt, bodyRev,
  });
  const { status: saveStatus, lastSavedAt } = useAutosave(
    signature,
    () => performSave(),
    { delayMs: 2500, enabled: true },
  );

  const onManualSave = (newStatus?: CmsStatus) => {
    startTransition(async () => {
      setMessage(null);
      const r = await performSave(newStatus);
      setMessage({ kind: r.ok ? 'ok' : 'err', text: r.ok ? (newStatus === 'published' ? 'Publicado.' : 'Guardado.') : 'Erro a guardar.' });
      if (newStatus) setStatus(newStatus);
    });
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveStatus]);

  const previewHref = `${locale === 'pt' ? '' : '/' + locale}/l/${slug}`;
  const cover = coverImageUrl || ogImageUrl || null;
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="cms-live-editor">
      <header className="cms-editor-topbar">
        <div className="cms-editor-topbar-left">
          <Link href="/admin/cms/posts" className="cms-back-link" title="Voltar aos artigos">
            <ArrowLeft size={16} />
          </Link>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titulo do artigo"
            className="cms-editor-title-field"
          />
          <AutosaveBadge status={saveStatus} lastSavedAt={lastSavedAt} />
          {initial.mt_unreviewed && <MtReviewBadge />}
        </div>

        <DeviceToggle device={device} onChange={setDevice} />

        <div className="cms-editor-topbar-right">
          {groupId && (
            <TranslationCoverageBar type="post" groupId={groupId} currentLocale={locale} peerLocales={peerLocales} />
          )}
          <Link href={`/admin/cms/posts/${initial.id}/history`} className="cms-btn cms-btn-ghost" title="Historico">
            <History size={15} /> <span>Historico</span>
          </Link>
          <Link href={previewHref} target="_blank" rel="noopener noreferrer" className="cms-btn cms-btn-ghost" title="Abrir publicado">
            <Eye size={15} /> <span>Preview</span>
          </Link>
          <button type="button" onClick={() => onManualSave()} disabled={pending} className="cms-btn cms-btn-secondary">
            <Save size={15} /> <span>Save</span>
          </button>
          {status !== 'published' ? (
            <button type="button" onClick={() => onManualSave('published')} disabled={pending} className="cms-btn cms-btn-primary cms-btn-publish">
              <CheckCircle2 size={15} /> <span>Publish</span>
            </button>
          ) : (
            <button type="button" onClick={() => onManualSave('draft')} disabled={pending} className="cms-btn cms-btn-warning">
              Unpublish
            </button>
          )}
        </div>
      </header>

      <main className="cms-editor-stage">
        <section className={`cms-device-frame cms-device-${device}`} aria-label="Canvas do artigo">
          <div style={{ position: 'relative' }}>
            <ArticleHero
              variant="post"
              title={title || 'Sem titulo'}
              subtitle={metaDescription}
              coverImage={cover}
              breadcrumbs={[
                { href: '/', label: 'Inicio' },
                { href: '/l', label: 'Artigos' },
                { label: title || 'Artigo' },
              ]}
              meta={
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {date && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: cover ? 'rgba(255,255,255,0.9)' : 'var(--muted)', fontSize: '0.85rem' }}>
                      <Calendar size={14} aria-hidden /> {date}
                    </span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: cover ? 'rgba(255,255,255,0.9)' : 'var(--muted)', fontSize: '0.85rem' }}>
                    <Clock size={14} aria-hidden /> live editor
                  </span>
                </div>
              }
            />
            <HeroCoverOverlay value={coverImageUrl || null} onChange={(v) => setCoverImageUrl(v ?? '')} />
          </div>
          <TipTapEditor
            ref={editorRef}
            initialHtml={initial.content_html ?? ''}
            placeholder="Escreve o teu artigo..."
            onChange={() => setBodyRev((x) => x + 1)}
          />
        </section>

        {message && (
          <div className={`cms-editor-message cms-editor-message-${message.kind}`}>
            {message.kind === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {message.text}
          </div>
        )}

        <section className="cms-editor-panels" aria-label="Definicoes do artigo">
          <Panel icon={Settings2} title="Publicacao" description="Estado, data e se o artigo aparece em destaque.">
            <Field label="Estado" hint="Rascunho fica so para ti; Publicado fica visivel no site.">
              <select value={status} onChange={(e) => setStatus(e.target.value as CmsStatus)} className="cms-input">
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Data de publicacao" hint="Define a data mostrada e agenda artigos futuros.">
              <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="cms-input" />
            </Field>
            <label className="cms-check-row">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              <Star size={14} aria-hidden style={{ color: featured ? '#d4af37' : 'var(--muted)' }} />
              <span>Destacar artigo</span>
            </label>
          </Panel>

          <Panel icon={LinkIcon} title="URL e idioma" description="O endereco do artigo e a lingua em que esta escrito.">
            <Field label="Slug" hint="Mudancas geram redirect 301">
              <SlugInput value={slug} onChange={setSlug} type="post" locale={locale} excludeId={initial.id} />
            </Field>
            <Field label="Idioma">
              <select value={locale} onChange={(e) => setLocale(e.target.value as CmsLocale)} className="cms-input">
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
              </select>
            </Field>
          </Panel>

          <Panel icon={Search} title="SEO e imagens" description="Como o artigo aparece no Google e ao partilhar.">
            <Field label="Meta title" hint="O titulo que aparece no separador e no Google.">
              <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="cms-input" placeholder="Default: usa o titulo" />
            </Field>
            <Field label="Meta description" hint="Resumo no Google. Ideal 140-160 caracteres.">
              <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} className="cms-input cms-input-textarea" />
              <CharMeter value={metaDescription} min={140} max={160} />
            </Field>
            <Field label="Cover image / hero" hint="Imagem grande no topo do artigo. Tambem editavel no topo da pre-visualizacao.">
              <MediaPicker value={coverImageUrl || null} onChange={(v) => setCoverImageUrl(v ?? '')} label="Escolher cover" aspect="wide" />
            </Field>
            <Field label="Imagem OG" hint="Imagem ao partilhar. Default: usa a cover.">
              <MediaPicker value={ogImageUrl || null} onChange={(v) => setOgImageUrl(v ?? '')} label="Escolher OG" aspect="wide" />
            </Field>
          </Panel>

          <Panel icon={Tags} title="Tags" description="Palavras-chave para agrupar e filtrar artigos.">
            <Field label="Tags" hint="Separadas por virgulas">
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className="cms-input" placeholder="ex: aviso, fe, peregrinacao" />
            </Field>
          </Panel>
        </section>
      </main>

      <div className="cms-mobile-bar">
        <AutosaveBadge status={saveStatus} lastSavedAt={lastSavedAt} />
        <button type="button" onClick={() => onManualSave('published')} disabled={pending} className="cms-btn cms-btn-primary">
          Publish
        </button>
      </div>
    </div>
  );
}

function DeviceToggle({ device, onChange }: { device: Device; onChange: (next: Device) => void }) {
  const items: { value: Device; label: string; icon: typeof Monitor }[] = [
    { value: 'mobile', label: 'Mobile', icon: Smartphone },
    { value: 'tablet', label: 'Tablet', icon: Tablet },
    { value: 'desktop', label: 'Desktop', icon: Monitor },
  ];
  return (
    <div className="cms-device-toggle" aria-label="Tamanho do canvas">
      {items.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={device === value ? 'is-active' : undefined}
          title={label}
          aria-pressed={device === value}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="cms-field">
      <span className="cms-field-label">{label}</span>
      {children}
      {hint && <span className="cms-field-hint">{hint}</span>}
    </label>
  );
}

function Panel({ icon: Icon, title, description, children }: { icon: typeof Settings2; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="cms-card">
      <header className="cms-card-head">
        <span className="cms-card-head-icon"><Icon size={16} /></span>
        <div>
          <h3 className="cms-card-head-title">{title}</h3>
          <p className="cms-card-head-desc">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function CharMeter({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length;
  const state = len === 0 ? 'empty' : len < min ? 'low' : len > max ? 'high' : 'ok';
  const label = state === 'empty' ? 'Vazio' : state === 'low' ? 'Curto' : state === 'high' ? 'Longo' : 'Ideal';
  return (
    <span className={`cms-char-meter cms-char-meter-${state}`}>
      <span className="cms-char-meter-dot" />
      {len} caracteres · {label}
    </span>
  );
}
