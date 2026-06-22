"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, FolderTree, History, Image as ImageIcon, Link2 as LinkIcon, Monitor, Save, Search, Settings2, Smartphone, Tablet } from 'lucide-react';
import Link from 'next/link';
import { ArticleHero } from '../../content/ArticleHero';
import { savePageAction } from '../../../app/admin/cms/actions';
import type { CmsRecord, CmsLocale, CmsStatus } from '../../../lib/cms/queries';
import type { EditorHandle } from './TipTapEditor';
import { useAutosave } from './useAutosave';
import { AutosaveBadge } from './AutosaveBadge';
import { SlugInput } from './SlugInput';
import { CategoryAutocomplete } from '../CategoryAutocomplete';
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

export function PageEditor({ initial, groupId, peerLocales = [] }: { initial: CmsRecord; groupId?: string; peerLocales?: CmsLocale[] }) {
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [locale, setLocale] = useState<CmsLocale>(initial.locale);
  const [metaTitle, setMetaTitle] = useState(initial.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(initial.meta_description ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(initial.og_image_url ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [parentSlug, setParentSlug] = useState(initial.parent_slug ?? '');
  const [status, setStatus] = useState<CmsStatus>(initial.status);
  const [version, setVersion] = useState(initial.updated_at);
  const [bodyRev, setBodyRev] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const editorRef = useRef<EditorHandle>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const stateRef = useRef({ title, slug, locale, metaTitle, metaDescription, ogImageUrl, category, parentSlug, status, version });
  stateRef.current = { title, slug, locale, metaTitle, metaDescription, ogImageUrl, category, parentSlug, status, version };

  const performSave = useCallback(
    async (overrideStatus?: CmsStatus): Promise<{ ok: boolean }> => {
      const html = editorRef.current?.getHtml() ?? '';
      const json = editorRef.current?.getJson() ?? null;
      const s = stateRef.current;
      const result = await savePageAction({
        id: initial.id,
        title: s.title,
        slug: s.slug,
        locale: s.locale,
        meta_title: s.metaTitle,
        meta_description: s.metaDescription,
        og_image_url: s.ogImageUrl,
        category: s.category,
        parent_slug: s.parentSlug,
        status: overrideStatus ?? s.status,
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

  const signature = JSON.stringify({ title, slug, locale, metaTitle, metaDescription, ogImageUrl, category, parentSlug, bodyRev });
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

  const previewHref = `${locale === 'pt' ? '' : '/' + locale}/${slug}`;

  return (
    <div className="cms-live-editor">
      <header className="cms-editor-topbar">
        <div className="cms-editor-topbar-left">
          <Link href="/admin/cms/pages" className="cms-back-link" title="Voltar a paginas">
            <ArrowLeft size={16} />
          </Link>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titulo da pagina"
            className="cms-editor-title-field"
          />
          <AutosaveBadge status={saveStatus} lastSavedAt={lastSavedAt} />
          {initial.mt_unreviewed && <MtReviewBadge />}
        </div>

        <DeviceToggle device={device} onChange={setDevice} />

        <div className="cms-editor-topbar-right">
          {groupId && (
            <TranslationCoverageBar type="page" groupId={groupId} currentLocale={locale} peerLocales={peerLocales} />
          )}
          <Link href={`/admin/cms/pages/${initial.id}/history`} className="cms-btn cms-btn-ghost" title="Historico">
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
              variant="page"
              title={title || 'Sem titulo'}
              subtitle={metaDescription}
              coverImage={ogImageUrl}
              breadcrumbs={[
                { href: '/', label: 'Inicio' },
                { label: title || 'Pagina' },
              ]}
            />
            <HeroCoverOverlay value={ogImageUrl || null} onChange={(v) => setOgImageUrl(v ?? '')} />
          </div>
          <TipTapEditor
            ref={editorRef}
            initialHtml={initial.content_html ?? ''}
            placeholder="Conteudo da pagina..."
            onChange={() => setBodyRev((x) => x + 1)}
          />
        </section>

        {message && (
          <div className={`cms-editor-message cms-editor-message-${message.kind}`}>
            {message.kind === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {message.text}
          </div>
        )}

        <section className="cms-editor-panels" aria-label="Definicoes da pagina">
          <Panel icon={ImageIcon} title="Capa" description="Imagem grande no topo da pagina (e usada ao partilhar o link).">
            <Field label="Imagem de capa" hint="Tambem podes adicionar/trocar diretamente no topo da pre-visualizacao.">
              <MediaPicker value={ogImageUrl || null} onChange={(v) => setOgImageUrl(v ?? '')} label="Escolher imagem de capa" aspect="wide" />
            </Field>
          </Panel>

          <Panel icon={Settings2} title="Publicacao" description="Controla se a pagina esta visivel ao publico e em que estado.">
            <Field label="Estado" hint="Rascunho fica so para ti; Publicado fica visivel no site.">
              <select value={status} onChange={(e) => setStatus(e.target.value as CmsStatus)} className="cms-input">
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </Panel>

          <Panel icon={LinkIcon} title="URL e idioma" description="O endereco da pagina e a lingua em que esta escrita.">
            <Field label="Slug" hint="Mudancas geram redirect 301 automaticamente">
              <SlugInput value={slug} onChange={setSlug} type="page" locale={locale} excludeId={initial.id} />
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

          <Panel icon={Search} title="SEO" description="Como a pagina aparece no Google e ao partilhar nas redes.">
            <Field label="Meta title" hint="O titulo que aparece no separador e no Google.">
              <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="cms-input" placeholder="Default: usa o titulo" />
            </Field>
            <Field label="Meta description" hint="Resumo no Google. Ideal 140-160 caracteres.">
              <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} className="cms-input cms-input-textarea" />
              <CharMeter value={metaDescription} min={140} max={160} />
            </Field>
          </Panel>

          <Panel icon={FolderTree} title="Organizacao" description="Categoria e hierarquia para agrupar esta pagina.">
            <Field label="Categoria" hint="Sugestoes a partir das categorias existentes">
              <CategoryAutocomplete value={category} onChange={setCategory} />
            </Field>
            <Field label="Slug pai" hint="Opcional. Aninha esta pagina debaixo de outra.">
              <input value={parentSlug} onChange={(e) => setParentSlug(e.target.value)} className="cms-input" />
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
