"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRightLeft, ChevronDown, ChevronRight, FileText, Folder, FolderInput, FolderPlus, Home, Image as ImageIcon,
  Inbox, Link2, LoaderCircle, Mail, MoreHorizontal, Pencil, Search, Tag, Trash2, UploadCloud, X,
} from 'lucide-react';

import { DOCUMENT_KIND_LABELS, MAX_DOCUMENT_BYTES, type DocumentKind } from '../../../lib/ledger/document-rules';
import { formatDay, formatEur } from '../../../lib/ledger/format';
import { descendantIds } from '../../../lib/ledger/files-rules';
import { shrinkPhoto } from './compress-image';
import DocumentPreview, { type PreviewDoc } from './DocumentPreview';
import { KindPicker } from './ExpenseDocumentsField';
import { useToast } from './Toasts';
import type { LedgerMovement } from './types';
import { adminFetch } from './useLedger';
import { BADGE, Button, Card, Count, EmptyState, IconButton, cx } from './ui';

// ---------------------------------------------------------------------------
// Shapes from /api/admin/contabilidade/pastas and /ficheiros
// ---------------------------------------------------------------------------

type FolderRow = { id: string; parentId: string | null; name: string; fileCount: number; unlinkedCount: number };
type Tree = { ready: boolean; folders: FolderRow[]; unfiled: number; unlinked: number; total: number };
type Movement = { id: string; date: string; period: string; who: string; description: string; amount: number; category: string; status: string };
type Link = { type: string; targetId: string; label: string; movement: Movement | null };
type FileRow = {
  id: string; fileName: string; kind: DocumentKind; kindLabel: string; mimeType: string | null; sizeBytes: number | null;
  createdAt: string; source: 'email' | 'upload' | 'arquivo'; docNumber: string | null; folderId: string | null;
  folderPath: string[]; links: Link[]; missing: string | null;
};
type Candidate = Movement & { documents: number; needsDocument: boolean };

/** Where the admin is looking. */
type Place = { kind: 'root' } | { kind: 'unlinked' } | { kind: 'unfiled' } | { kind: 'folder'; id: string };

const LINK_LABELS: Record<string, string> = {
  factpt_document: 'FACT.pt', pilgrimage_payment: 'Inscrição', pilgrimage_cost: 'Custo de logística', agreement: 'Acordo',
};

const sizeLabel = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MB`;
};
const isImage = (file: FileRow) => (file.mimeType || '').startsWith('image/');
const toPreview = (file: FileRow): PreviewDoc => {
  const movement = file.links.find(link => link.movement)?.movement || null;
  return {
    id: file.id, kindLabel: file.kindLabel, fileName: file.fileName, mimeType: file.mimeType, source: file.source, docNumber: file.docNumber,
    movement: movement && { id: movement.id, date: movement.date, period: movement.period, who: movement.who, amount: movement.amount, category: movement.category },
  };
};
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/**
 * The accounting folders: the admin's own folders (and the imported archive),
 * every file in them, and what each file is linked to. A file with no
 * movement says so on its own row, with the button that fixes it.
 */
export default function FilesBrowser({
  missing,
  period,
  onOpenMovement,
}: {
  /** Expenses of the loaded month still without a document. */
  missing: LedgerMovement[];
  period: string | null;
  onOpenMovement: (movementId: string, period: string) => void;
}) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>({ kind: 'root' });
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [linking, setLinking] = useState<FileRow | null>(null);
  const [moving, setMoving] = useState<{ file?: FileRow; folder?: FolderRow } | null>(null);
  const [naming, setNaming] = useState<{ mode: 'create'; parentId: string | null } | { mode: 'rename'; folder: FolderRow } | { mode: 'file'; file: FileRow } | null>(null);
  const [kindFor, setKindFor] = useState<FileRow | null>(null);
  const [deleting, setDeleting] = useState<{ file?: FileRow; folder?: FolderRow } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const refresh = useCallback(() => setReload(value => value + 1), []);

  useEffect(() => {
    let active = true;
    adminFetch('/api/admin/contabilidade/pastas')
      .then((result: Tree) => { if (active) { setTree(result); setTreeError(null); } })
      .catch(error => { if (active) setTreeError(errorText(error, 'Não foi possível ler as pastas.')); });
    return () => { active = false; };
  }, [reload]);

  const searching = query.trim().length >= 2;
  const filesUrl = useMemo(() => {
    if (searching) return `/api/admin/contabilidade/ficheiros?view=search&q=${encodeURIComponent(query.trim())}`;
    if (place.kind === 'folder') return `/api/admin/contabilidade/ficheiros?view=folder&folderId=${place.id}`;
    if (place.kind === 'unlinked') return '/api/admin/contabilidade/ficheiros?view=unlinked';
    if (place.kind === 'unfiled') return '/api/admin/contabilidade/ficheiros?view=unfiled';
    return null;
  }, [place, query, searching]);

  useEffect(() => {
    if (!tree?.ready || !filesUrl) { setFiles(null); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      adminFetch(filesUrl)
        .then((result: { files: FileRow[] }) => { if (active) { setFiles(result.files); setFilesError(null); } })
        .catch(error => { if (active) setFilesError(errorText(error, 'Não foi possível ler os ficheiros.')); });
    }, searching ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [filesUrl, tree?.ready, reload, searching]);

  const folders = useMemo(() => tree?.folders || [], [tree]);
  const byId = useMemo(() => new Map(folders.map(folder => [folder.id, folder])), [folders]);
  const childrenOf = useCallback((parentId: string | null) => folders
    .filter(folder => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true })), [folders]);
  /** Files waiting for a link inside a folder and everything under it. */
  const openInside = useCallback((id: string): number => {
    const ids = descendantIds(folders, id);
    return folders.filter(folder => ids.has(folder.id)).reduce((sum, folder) => sum + folder.unlinkedCount, 0);
  }, [folders]);
  const trail = useMemo(() => {
    if (place.kind !== 'folder') return [] as FolderRow[];
    const result: FolderRow[] = [];
    let cursor: FolderRow | undefined = byId.get(place.id);
    while (cursor && result.length < 25) { result.unshift(cursor); cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined; }
    return result;
  }, [place, byId]);
  const current = place.kind === 'folder' ? byId.get(place.id) || null : null;

  // Opening a folder unfolds its parents in the side list.
  useEffect(() => {
    if (trail.length < 2) return;
    setExpanded(prev => {
      const next = new Set(prev);
      trail.slice(0, -1).forEach(folder => next.add(folder.id));
      return next;
    });
  }, [trail]);

  const go = (next: Place) => { setPlace(next); setQuery(''); setPreviewIndex(null); };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const upload = async (list: FileList | File[]) => {
    const target = current;
    let saved = 0;
    try {
      for (const original of Array.from(list)) {
        setUploading(original.name);
        const file = await shrinkPhoto(original);
        if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`${original.name} é demasiado grande (máximo 9 MB).`);
        const form = new FormData();
        form.append('file', file);
        form.append('kind', 'fatura');
        if (target) form.append('folderId', target.id);
        await adminFetch('/api/admin/contabilidade/ficheiros', { method: 'POST', body: form });
        saved += 1;
      }
    } catch (error) {
      toast({ tone: 'error', title: 'Não foi possível carregar', description: errorText(error, 'Tente de novo.') });
    } finally {
      setUploading(null);
      if (picker.current) picker.current.value = '';
      if (saved) {
        toast({
          title: saved === 1 ? `Ficheiro guardado em ${target?.name || 'Sem pasta'}` : `${saved} ficheiros guardados em ${target?.name || 'Sem pasta'}`,
          description: 'Agora ligue cada um ao movimento do banco que justifica.',
        });
        if (!target) setPlace({ kind: 'unfiled' });
        refresh();
      }
    }
  };

  const act = async (work: () => Promise<unknown>, success: string, fallback: string) => {
    try {
      await work();
      toast({ title: success });
      refresh();
      return true;
    } catch (error) {
      toast({ tone: 'error', title: fallback, description: errorText(error, 'Tente de novo.') });
      return false;
    }
  };
  const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (treeError) return <Card><EmptyState title="Não foi possível ler as pastas">{treeError}</EmptyState></Card>;
  if (!tree) return <Card className="flex items-center gap-2 p-6 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A ler as pastas…</Card>;
  if (!tree.ready) {
    return (
      <Card>
        <EmptyState title="As pastas ainda não estão ativas">
          Falta aplicar na base de dados a migração das pastas (20261111150000). Até lá, os documentos continuam em &quot;Por mês&quot;.
        </EmptyState>
      </Card>
    );
  }

  const subfolders = searching ? [] : place.kind === 'root' ? childrenOf(null) : place.kind === 'folder' ? childrenOf(place.id) : [];
  const title = searching ? `Resultados para “${query.trim()}”`
    : place.kind === 'unlinked' ? 'Por ligar'
      : place.kind === 'unfiled' ? 'Sem pasta'
        : place.kind === 'folder' ? current?.name || 'Pasta' : 'Todas as pastas';
  const shownFiles = files || [];
  const showPath = searching || place.kind === 'unlinked';
  const missingHere = missing.filter(movement => movement.period === period);

  return (
    <div className="grid gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      {/* ------------------------------------------------------------ side */}
      <nav className="h-fit space-y-3 lg:sticky lg:top-24" aria-label="Pastas">
        <div className="space-y-0.5">
          <SideItem icon={<Home className="h-4 w-4" aria-hidden />} label="Todas as pastas" count={tree.total} active={!searching && place.kind === 'root'} onClick={() => go({ kind: 'root' })} />
          <SideItem icon={<Link2 className="h-4 w-4" aria-hidden />} label="Por ligar" count={tree.unlinked} attention={tree.unlinked > 0}
            active={!searching && place.kind === 'unlinked'} onClick={() => go({ kind: 'unlinked' })} />
          <SideItem icon={<Inbox className="h-4 w-4" aria-hidden />} label="Sem pasta" count={tree.unfiled} active={!searching && place.kind === 'unfiled'} onClick={() => go({ kind: 'unfiled' })} />
        </div>
        <div className="max-h-[22rem] overflow-y-auto pr-1 lg:max-h-[calc(100vh-18rem)]">
          <p className="px-3 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-zinc-400">Pastas</p>
          <TreeLevel
            parentId={null}
            depth={0}
            childrenOf={childrenOf}
            expanded={expanded}
            onToggle={id => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
            activeId={!searching && place.kind === 'folder' ? place.id : null}
            openInside={openInside}
            onOpen={id => go({ kind: 'folder', id })}
          />
          {!folders.length && <p className="px-3 py-2 text-[12.5px] text-zinc-400">Ainda não há pastas.</p>}
        </div>
        <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => setNaming({ mode: 'create', parentId: current?.id ?? null })}>
          <FolderPlus className="h-4 w-4" aria-hidden /> Nova pasta{current ? ` em ${current.name}` : ''}
        </Button>
      </nav>

      {/* ------------------------------------------------------------ main */}
      <div
        className="flex min-w-0 flex-col gap-4"
        onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
        onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) void upload(event.dataTransfer.files); }}
      >
        {/* Summary of what's left to do: the two jobs of this area. */}
        {!searching && place.kind === 'root' && (tree.unlinked > 0 || missingHere.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {tree.unlinked > 0 && (
              <TodoCard
                title={`${tree.unlinked} ${tree.unlinked === 1 ? 'ficheiro' : 'ficheiros'} por ligar`}
                text="Ainda não dizem que pagamento do banco justificam."
                action="Ver e ligar"
                onClick={() => go({ kind: 'unlinked' })}
              />
            )}
            {missingHere.length > 0 && (
              <TodoCard
                title={`${missingHere.length} ${missingHere.length === 1 ? 'despesa' : 'despesas'} sem documento`}
                text="Pagamentos deste mês ainda sem fatura ou comprovativo."
                action="Abrir a primeira"
                onClick={() => onOpenMovement(missingHere[0].id, missingHere[0].period)}
              />
            )}
          </div>
        )}

        <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {place.kind === 'folder' && !searching && trail.length > 1 && (
              <nav className="mb-1 flex flex-wrap items-center gap-1 text-[12.5px] text-zinc-500" aria-label="Caminho">
                <button type="button" className="hover:text-zinc-900" onClick={() => go({ kind: 'root' })}>Pastas</button>
                {trail.slice(0, -1).map(folder => (
                  <span key={folder.id} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300" aria-hidden />
                    <button type="button" className="hover:text-zinc-900" onClick={() => go({ kind: 'folder', id: folder.id })}>{folder.name}</button>
                  </span>
                ))}
              </nav>
            )}
            <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-semibold tracking-[-0.01em] text-zinc-900">
              <span className="break-words">{title}</span>
              {files && !!shownFiles.length && <Count value={shownFiles.length} />}
              {current && !searching && (
                <Menu as="span" className="relative">
                  <MenuButton className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 outline-none hover:bg-zinc-900/[0.06] hover:text-zinc-900" aria-label="Opções da pasta">
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </MenuButton>
                  <MenuItems anchor="bottom start" className="lg-float z-40 mt-1 w-52 rounded-2xl p-1.5 text-[13.5px] outline-none">
                    <MenuAction icon={<Pencil className="h-4 w-4" />} onClick={() => setNaming({ mode: 'rename', folder: current })}>Mudar o nome</MenuAction>
                    <MenuAction icon={<FolderInput className="h-4 w-4" />} onClick={() => setMoving({ folder: current })}>Mover para outra pasta</MenuAction>
                    <MenuAction icon={<FolderPlus className="h-4 w-4" />} onClick={() => setNaming({ mode: 'create', parentId: current.id })}>Criar subpasta</MenuAction>
                    <MenuAction icon={<Trash2 className="h-4 w-4" />} danger onClick={() => setDeleting({ folder: current })}>Apagar pasta</MenuAction>
                  </MenuItems>
                </Menu>
              )}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">
              {searching ? 'Em todas as pastas.'
                : place.kind === 'unlinked' ? 'Cada ficheiro aqui precisa de ser ligado ao movimento do banco que justifica.'
                  : place.kind === 'unfiled' ? 'Ficheiros anexados aos movimentos ou carregados sem escolher pasta.'
                    : place.kind === 'root' ? 'Abra uma pasta, ou crie as suas. Os ficheiros podem estar numa pasta e ligados a movimentos ao mesmo tempo.'
                      : 'Arraste ficheiros para aqui para os guardar nesta pasta.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <span className="sr-only">Procurar ficheiros</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Procurar em tudo"
                className="lg-pill h-9 w-full rounded-full pl-9 pr-8 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700">
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </label>
            <input ref={picker} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={event => { if (event.target.files?.length) void upload(event.target.files); }} />
            <Button size="sm" disabled={!!uploading} onClick={() => picker.current?.click()} title={`Guardar ficheiros em ${current?.name || 'Sem pasta'}`}>
              {uploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <UploadCloud className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">Carregar</span>
            </Button>
          </div>
        </header>

        {dragging && (
          <div className="rounded-[22px] border-2 border-dashed border-zinc-900/20 bg-zinc-900/[0.03] p-6 text-center text-[13.5px] text-zinc-600">
            Largue para guardar em <strong>{current?.name || 'Sem pasta'}</strong>
          </div>
        )}
        {uploading && <p className="px-1 text-[12.5px] text-zinc-500">A guardar {uploading}…</p>}

        {subfolders.length > 0 && (
          <Card className="overflow-hidden">
            <ul>
              {subfolders.map(folder => {
                const open = openInside(folder.id);
                const inside = childrenOf(folder.id).length;
                return (
                  <li key={folder.id} className="border-b border-zinc-900/[0.05] last:border-0">
                    <button type="button" onClick={() => go({ kind: 'folder', id: folder.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-zinc-900/[0.025] focus-visible:bg-zinc-900/[0.04]">
                      <Folder className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[14px] font-medium text-zinc-900">{folder.name}</span>
                        <span className="block text-[12px] text-zinc-500">
                          {[folder.fileCount ? `${folder.fileCount} ${folder.fileCount === 1 ? 'ficheiro' : 'ficheiros'}` : '', inside ? `${inside} ${inside === 1 ? 'pasta' : 'pastas'}` : ''].filter(Boolean).join(' · ') || 'Vazia'}
                        </span>
                      </span>
                      {open > 0 && <span className={cx(BADGE, 'h-6 bg-amber-100 px-2.5 text-[12px] text-amber-800')}>{open} por ligar</span>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {filesUrl && (
          filesError ? <Card><EmptyState title="Não foi possível ler os ficheiros">{filesError}</EmptyState></Card>
            : !files ? <Card className="flex items-center gap-2 p-6 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A ler os ficheiros…</Card>
              : shownFiles.length === 0 ? (
                subfolders.length ? null : (
                  <Card>
                    <EmptyState
                      title={searching ? 'Nada encontrado' : place.kind === 'unlinked' ? 'Está tudo ligado' : 'Esta pasta não tem ficheiros'}
                      action={!searching && place.kind === 'folder' ? <Button size="sm" onClick={() => picker.current?.click()}><UploadCloud className="h-3.5 w-3.5" aria-hidden /> Carregar ficheiros</Button> : undefined}
                    >
                      {searching ? 'Procure pelo nome do ficheiro, do fornecedor ou pelo número do documento.'
                        : place.kind === 'unlinked' ? 'Todos os ficheiros já estão ligados a um movimento.' : 'Arraste ficheiros para aqui ou use "Carregar".'}
                    </EmptyState>
                  </Card>
                )
              ) : (
                <Card className="overflow-hidden">
                  <ul>
                    {shownFiles.map((file, index) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        showPath={showPath}
                        onPreview={() => setPreviewIndex(index)}
                        onLink={() => setLinking(file)}
                        onOpenMovement={movement => onOpenMovement(movement.id, movement.period)}
                        onMove={() => setMoving({ file })}
                        onRename={() => setNaming({ mode: 'file', file })}
                        onKind={() => setKindFor(file)}
                        onDelete={() => setDeleting({ file })}
                      />
                    ))}
                  </ul>
                </Card>
              )
        )}

        {!filesUrl && !subfolders.length && (
          <Card>
            <EmptyState title="Ainda não há pastas" action={<Button size="sm" variant="primary" onClick={() => setNaming({ mode: 'create', parentId: null })}><FolderPlus className="h-3.5 w-3.5" aria-hidden /> Criar a primeira pasta</Button>}>
              Organize as faturas como no seu arquivo: por fornecedor, por ano ou por viagem.
            </EmptyState>
          </Card>
        )}
      </div>

      {/* --------------------------------------------------------- dialogs */}
      <DocumentPreview
        docs={shownFiles.map(toPreview)}
        index={previewIndex}
        onIndex={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
        onOpenMovement={doc => { setPreviewIndex(null); if (doc.movement) onOpenMovement(doc.movement.id, doc.movement.period); }}
      />

      <LinkDialog
        file={linking}
        onClose={() => setLinking(null)}
        onLink={async movement => {
          if (!linking) return;
          const ok = await act(
            () => adminFetch(`/api/admin/contabilidade/ficheiros/${linking.id}/ligacoes`, json('POST', { type: 'bank_transaction', targetId: movement.id })),
            `Ligado ao pagamento de ${formatDay(movement.date)} (${formatEur(movement.amount)})`, 'Não foi possível ligar',
          );
          if (ok) setLinking(null);
        }}
        onUnlink={async link => {
          if (!linking) return;
          const ok = await act(
            () => adminFetch(`/api/admin/contabilidade/ficheiros/${linking.id}/ligacoes`, json('DELETE', { type: link.type, targetId: link.targetId })),
            'Ligação removida', 'Não foi possível desligar',
          );
          if (ok) setLinking(prev => prev && { ...prev, links: prev.links.filter(item => !(item.type === link.type && item.targetId === link.targetId)) });
        }}
      />

      <MoveDialog
        target={moving}
        folders={folders}
        childrenOf={childrenOf}
        onClose={() => setMoving(null)}
        onPick={async folderId => {
          if (!moving) return;
          const name = folderId ? byId.get(folderId)?.name : 'Sem pasta';
          const ok = moving.file
            ? await act(() => adminFetch(`/api/admin/contabilidade/ficheiros/${moving.file!.id}`, json('PATCH', { folderId })), `Movido para ${name}`, 'Não foi possível mover')
            : await act(() => adminFetch(`/api/admin/contabilidade/pastas/${moving.folder!.id}`, json('PATCH', { parentId: folderId })), `Pasta movida para ${folderId ? name : 'o topo'}`, 'Não foi possível mover a pasta');
          if (ok) setMoving(null);
        }}
      />

      <NameDialog
        state={naming}
        parentName={naming?.mode === 'create' && naming.parentId ? byId.get(naming.parentId)?.name || null : null}
        onClose={() => setNaming(null)}
        onSave={async name => {
          if (!naming) return;
          let ok = false;
          if (naming.mode === 'create') {
            try {
              const result = await adminFetch('/api/admin/contabilidade/pastas', json('POST', { name, parentId: naming.parentId })) as { id: string };
              toast({ title: `Pasta ${name} criada` });
              refresh();
              go({ kind: 'folder', id: result.id });
              ok = true;
            } catch (error) {
              toast({ tone: 'error', title: 'Não foi possível criar a pasta', description: errorText(error, 'Tente de novo.') });
            }
          } else if (naming.mode === 'rename') {
            ok = await act(() => adminFetch(`/api/admin/contabilidade/pastas/${naming.folder.id}`, json('PATCH', { name })), 'Nome mudado', 'Não foi possível mudar o nome');
          } else {
            ok = await act(() => adminFetch(`/api/admin/contabilidade/ficheiros/${naming.file.id}`, json('PATCH', { fileName: name })), 'Nome mudado', 'Não foi possível mudar o nome');
          }
          if (ok) setNaming(null);
        }}
      />

      <KindDialog
        file={kindFor}
        onClose={() => setKindFor(null)}
        onPick={async kind => {
          if (!kindFor) return;
          const ok = await act(() => adminFetch(`/api/admin/contabilidade/ficheiros/${kindFor.id}`, json('PATCH', { kind })), `Agora é ${DOCUMENT_KIND_LABELS[kind].toLowerCase()}`, 'Não foi possível mudar o tipo');
          if (ok) setKindFor(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title={deleting?.file ? `Apagar ${deleting.file.fileName}?` : `Apagar a pasta ${deleting?.folder?.name}?`}
        text={deleting?.file
          ? deleting.file.links.length
            ? 'O ficheiro deixa de existir e sai dos movimentos a que está ligado. Não é possível desfazer.'
            : 'O ficheiro deixa de existir. Não é possível desfazer.'
          : 'Só é possível apagar pastas vazias. Os ficheiros nunca são apagados com a pasta.'}
        confirm="Apagar"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = deleting.file
            ? await act(() => adminFetch(`/api/admin/contabilidade/ficheiros/${deleting.file!.id}`, { method: 'DELETE' }), 'Ficheiro apagado', 'Não foi possível apagar')
            : await act(() => adminFetch(`/api/admin/contabilidade/pastas/${deleting.folder!.id}`, { method: 'DELETE' }), 'Pasta apagada', 'Não foi possível apagar a pasta');
          if (ok) {
            if (deleting.folder) go(deleting.folder.parentId ? { kind: 'folder', id: deleting.folder.parentId } : { kind: 'root' });
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side list
// ---------------------------------------------------------------------------

function SideItem({ icon, label, count, active, attention = false, onClick }: { icon: ReactNode; label: string; count: number; active: boolean; attention?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-full px-3 py-1.5 text-left text-[13.5px] outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15',
        active ? 'lg-thumb font-medium text-zinc-950' : 'text-zinc-600 hover:bg-zinc-900/[0.05]',
      )}
    >
      <span className={cx('shrink-0', attention ? 'text-amber-600' : 'text-zinc-400')}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className={cx('text-[12px] tabular-nums', attention ? 'font-semibold text-amber-700' : 'text-zinc-400')}>{count}</span>
    </button>
  );
}

function TreeLevel({
  parentId, depth, childrenOf, expanded, onToggle, activeId, openInside, onOpen,
}: {
  parentId: string | null; depth: number; childrenOf: (id: string | null) => FolderRow[]; expanded: Set<string>;
  onToggle: (id: string) => void; activeId: string | null; openInside: (id: string) => number; onOpen: (id: string) => void;
}) {
  const list = childrenOf(parentId);
  if (!list.length) return null;
  return (
    <ul>
      {list.map(folder => {
        const hasChildren = childrenOf(folder.id).length > 0;
        const isOpen = expanded.has(folder.id);
        const open = openInside(folder.id);
        return (
          <li key={folder.id}>
            <div
              className={cx('group flex items-center gap-1 rounded-full pr-2 text-[13.5px] transition-colors', activeId === folder.id ? 'lg-thumb font-medium text-zinc-950' : 'text-zinc-600 hover:bg-zinc-900/[0.05]')}
              style={{ paddingLeft: `${0.35 + depth * 0.9}rem` }}
            >
              {hasChildren ? (
                <button type="button" onClick={() => onToggle(folder.id)} aria-label={isOpen ? `Fechar ${folder.name}` : `Abrir ${folder.name}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                </button>
              ) : <span className="h-6 w-6 shrink-0" aria-hidden />}
              <button type="button" onClick={() => onOpen(folder.id)} aria-current={activeId === folder.id ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left outline-none">
                <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={folder.name}>{folder.name}</span>
                {open > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title={`${open} por ligar`} aria-label={`${open} por ligar`} />}
              </button>
            </div>
            {hasChildren && isOpen && (
              <TreeLevel parentId={folder.id} depth={depth + 1} childrenOf={childrenOf} expanded={expanded} onToggle={onToggle} activeId={activeId} openInside={openInside} onOpen={onOpen} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TodoCard({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="lg-glass flex items-start gap-3 rounded-[22px] p-4 text-left outline-none transition-transform active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-zinc-900/15">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-zinc-900">{title}</span>
        <span className="block text-[12.5px] text-zinc-500">{text}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-900">{action} <ChevronRight className="h-3.5 w-3.5" aria-hidden /></span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// One file
// ---------------------------------------------------------------------------

function FileItem({
  file, showPath, onPreview, onLink, onOpenMovement, onMove, onRename, onKind, onDelete,
}: {
  file: FileRow; showPath: boolean; onPreview: () => void; onLink: () => void; onOpenMovement: (movement: Movement) => void;
  onMove: () => void; onRename: () => void; onKind: () => void; onDelete: () => void;
}) {
  const Icon = isImage(file) ? ImageIcon : FileText;
  const meta = [
    file.kindLabel, sizeLabel(file.sizeBytes),
    file.source === 'email' ? 'veio por email' : file.source === 'arquivo' ? 'arquivo antigo' : '',
    showPath ? file.folderPath.join(' / ') || 'Sem pasta' : '',
  ].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-col gap-2 border-b border-zinc-900/[0.05] px-4 py-3 last:border-0 sm:flex-row sm:items-center">
      <button type="button" onClick={onPreview} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none" title="Ver o ficheiro">
        <span className="lg-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500"><Icon className="h-4 w-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[14px] font-medium text-zinc-900 hover:underline">{file.fileName}</span>
          <span className="flex items-center gap-1 text-[12px] text-zinc-500">
            {file.source === 'email' && <Mail className="h-3 w-3" aria-hidden />}
            {meta}
          </span>
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-1.5 pl-12 sm:max-w-[55%] sm:justify-end sm:pl-0">
        {file.links.map(link => link.movement ? (
          <button
            key={`${link.type}:${link.targetId}`}
            type="button"
            onClick={() => onOpenMovement(link.movement!)}
            title={`Abrir o movimento: ${link.movement.description}`}
            className={cx(BADGE, 'h-7 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')}
          >
            <Link2 className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{formatDay(link.movement.date)} · {link.movement.who}</span>
            <span className="tabular-nums">{formatEur(link.movement.amount)}</span>
          </button>
        ) : (
          <span key={`${link.type}:${link.targetId}`} className={cx(BADGE, 'h-7 bg-zinc-900/[0.06] text-zinc-700')}>
            {LINK_LABELS[link.type] || link.type} · {link.label}
          </span>
        ))}
        {file.missing ? (
          <>
            <span className={cx(BADGE, 'h-7 bg-amber-100 text-amber-800')}>{file.missing}</span>
            <Button size="sm" variant="primary" className="h-7 px-3 text-[12.5px]" onClick={onLink}>Ligar</Button>
          </>
        ) : null}
        <Menu as="div" className="relative">
          <MenuButton className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 outline-none hover:bg-zinc-900/[0.06] hover:text-zinc-900 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15" aria-label={`Opções de ${file.fileName}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </MenuButton>
          <MenuItems anchor="bottom end" className="lg-float z-40 mt-1 w-60 rounded-2xl p-1.5 text-[13.5px] outline-none">
            <MenuAction icon={<Link2 className="h-4 w-4" />} onClick={onLink}>{file.links.length ? 'Ligar a outro movimento' : 'Ligar a um movimento'}</MenuAction>
            <MenuAction icon={<ArrowRightLeft className="h-4 w-4" />} onClick={onMove}>Mover para outra pasta</MenuAction>
            <MenuAction icon={<Tag className="h-4 w-4" />} onClick={onKind}>Mudar o tipo ({file.kindLabel.toLowerCase()})</MenuAction>
            <MenuAction icon={<Pencil className="h-4 w-4" />} onClick={onRename}>Mudar o nome</MenuAction>
            <MenuAction icon={<Trash2 className="h-4 w-4" />} danger onClick={onDelete}>Apagar ficheiro</MenuAction>
          </MenuItems>
        </Menu>
      </div>
    </li>
  );
}

function MenuAction({ icon, children, danger = false, onClick }: { icon: ReactNode; children: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <MenuItem>
      <button type="button" onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left data-[focus]:bg-zinc-900/[0.06]', danger ? 'text-rose-700' : 'text-zinc-800')}>
        <span className="shrink-0 opacity-70" aria-hidden>{icon}</span>
        {children}
      </button>
    </MenuItem>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function Sheet({ open, onClose, title, subtitle, children, wide = false }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-zinc-950/25 transition-opacity duration-200 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel transition className={cx('lg-float flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] transition duration-200 data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:rounded-[24px]', wide ? 'max-w-[640px]' : 'max-w-[440px]')}>
          <header className="flex items-start gap-3 px-5 pb-2 pt-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="break-words text-[16px] font-semibold tracking-[-0.01em] text-zinc-900">{title}</DialogTitle>
              {subtitle && <div className="mt-0.5 text-[12.5px] text-zinc-500">{subtitle}</div>}
            </div>
            <IconButton label="Fechar" onClick={onClose} className="-mr-1.5"><X className="h-[18px] w-[18px]" aria-hidden /></IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function LinkDialog({ file, onClose, onLink, onUnlink }: {
  file: FileRow | null; onClose: () => void; onLink: (movement: Candidate) => Promise<void>; onUnlink: (link: Link) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileId = file?.id;

  useEffect(() => { setQuery(''); }, [fileId]);
  useEffect(() => {
    if (!fileId) return;
    let active = true;
    setList(null);
    const timer = window.setTimeout(() => {
      adminFetch(`/api/admin/contabilidade/ficheiros/movimentos?q=${encodeURIComponent(query.trim())}`)
        .then((result: { movements: Candidate[] }) => { if (active) { setList(result.movements); setError(null); } })
        .catch(loadError => { if (active) setError(errorText(loadError, 'Não foi possível ler os movimentos.')); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [fileId, query]);

  const linkedIds = new Set((file?.links || []).filter(link => link.type === 'bank_transaction').map(link => link.targetId));
  const run = async (key: string, work: () => Promise<void>) => { setBusy(key); try { await work(); } finally { setBusy(null); } };

  return (
    <Sheet open={!!file} onClose={onClose} wide title="Ligar a um movimento do banco" subtitle={file?.fileName}>
      {!!file?.links.length && (
        <div className="mb-4">
          <p className="mb-1.5 text-[12.5px] font-medium text-zinc-500">Já está ligado a</p>
          <ul className="space-y-1.5">
            {file.links.map(link => (
              <li key={`${link.type}:${link.targetId}`} className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
                <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {link.movement ? `${formatDay(link.movement.date, true)} · ${link.movement.who} · ${formatEur(link.movement.amount)}` : `${LINK_LABELS[link.type] || link.type} · ${link.label}`}
                </span>
                <Button size="sm" variant="ghost" className="h-7 px-3 text-[12.5px]" disabled={!!busy} onClick={() => void run(`u:${link.targetId}`, () => onUnlink(link))}>
                  {busy === `u:${link.targetId}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : 'Desligar'}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-zinc-500">Pode ligar o mesmo ficheiro a vários pagamentos (por exemplo, uma fatura paga em prestações).</p>
        </div>
      )}

      <label className="relative block">
        <span className="sr-only">Procurar movimento</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Procure pelo nome ou pelo valor (ex.: Vodafone, 23,50)"
          className="lg-pill h-10 w-full rounded-full pl-9 pr-3 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15"
        />
      </label>
      <p className="mb-2 mt-3 text-[12.5px] font-medium text-zinc-500">{query.trim() ? 'Movimentos encontrados' : 'Primeiro as despesas que ainda esperam documento'}</p>

      {error ? <p className="rounded-2xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>
        : !list ? <p className="flex items-center gap-2 py-6 text-[13px] text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A procurar…</p>
          : !list.length ? <p className="py-6 text-center text-[13px] text-zinc-500">Nenhum movimento encontrado. Experimente outro nome ou o valor exato.</p>
            : (
              <ul className="divide-y divide-zinc-900/[0.05]">
                {list.map(movement => {
                  const already = linkedIds.has(movement.id);
                  const waiting = movement.needsDocument && !movement.documents;
                  return (
                    <li key={movement.id}>
                      <button
                        type="button"
                        disabled={already || !!busy}
                        onClick={() => void run(movement.id, () => onLink(movement))}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-zinc-900/[0.03] focus-visible:bg-zinc-900/[0.05] disabled:cursor-default disabled:opacity-60"
                      >
                        <span className="w-14 shrink-0 text-[12.5px] tabular-nums text-zinc-500">{formatDay(movement.date)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-zinc-900">{movement.who}</span>
                          <span className="block truncate text-[12px] text-zinc-500">{movement.category}</span>
                        </span>
                        {already ? <span className={cx(BADGE, 'h-6 bg-emerald-50 px-2.5 text-[12px] text-emerald-800')}>Já ligado</span>
                          : waiting ? <span className={cx(BADGE, 'h-6 bg-amber-100 px-2.5 text-[12px] text-amber-800')}>Espera documento</span>
                            : movement.documents ? <span className={cx(BADGE, 'h-6 bg-zinc-900/[0.06] px-2.5 text-[12px] text-zinc-600')}>Tem {movement.documents}</span> : null}
                        <span className={cx('w-24 shrink-0 text-right text-[13.5px] font-medium tabular-nums', movement.amount < 0 ? 'text-zinc-900' : 'text-emerald-700')}>{formatEur(movement.amount)}</span>
                        {busy === movement.id && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
    </Sheet>
  );
}

function MoveDialog({ target, folders, childrenOf, onClose, onPick }: {
  target: { file?: FileRow; folder?: FolderRow } | null; folders: FolderRow[]; childrenOf: (id: string | null) => FolderRow[];
  onClose: () => void; onPick: (folderId: string | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const blocked = target?.folder ? descendantIds(folders, target.folder.id) : new Set<string>();
  const currentId = target?.file ? target.file.folderId : target?.folder?.parentId ?? null;
  const rows: Array<{ folder: FolderRow; depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of childrenOf(parentId)) { rows.push({ folder, depth }); walk(folder.id, depth + 1); }
  };
  walk(null, 0);
  const pick = async (id: string | null) => { setBusy(true); try { await onPick(id); } finally { setBusy(false); } };
  const name = target?.file?.fileName || target?.folder?.name || '';
  return (
    <Sheet open={!!target} onClose={onClose} title={`Mover ${name}`} subtitle="Escolha a pasta de destino.">
      <ul className="space-y-0.5">
        <li>
          <button type="button" disabled={busy || currentId === null} onClick={() => void pick(null)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] text-zinc-800 hover:bg-zinc-900/[0.04] disabled:opacity-40">
            <Inbox className="h-4 w-4 text-zinc-400" aria-hidden /> {target?.folder ? 'No topo (sem pasta-mãe)' : 'Sem pasta'}
          </button>
        </li>
        {rows.map(({ folder, depth }) => (
          <li key={folder.id}>
            <button
              type="button"
              disabled={busy || blocked.has(folder.id) || folder.id === currentId}
              onClick={() => void pick(folder.id)}
              className="flex w-full items-center gap-2 rounded-xl py-2 pr-3 text-left text-[13.5px] text-zinc-800 hover:bg-zinc-900/[0.04] disabled:opacity-40"
              style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
            >
              <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              {folder.id === currentId && <span className="text-[12px] text-zinc-400">está aqui</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function NameDialog({ state, parentName, onClose, onSave }: {
  state: { mode: 'create'; parentId: string | null } | { mode: 'rename'; folder: FolderRow } | { mode: 'file'; file: FileRow } | null;
  parentName: string | null; onClose: () => void; onSave: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const key = state ? (state.mode === 'create' ? `c:${state.parentId}` : state.mode === 'rename' ? `r:${state.folder.id}` : `f:${state.file.id}`) : '';
  useEffect(() => {
    if (!state) return;
    setValue(state.mode === 'rename' ? state.folder.name : state.mode === 'file' ? state.file.fileName : '');
    // Only when another dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const title = state?.mode === 'create' ? 'Nova pasta' : state?.mode === 'rename' ? 'Mudar o nome da pasta' : 'Mudar o nome do ficheiro';
  const subtitle = state?.mode === 'create' ? (parentName ? `Dentro de ${parentName}` : 'No topo das pastas') : undefined;
  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try { await onSave(value.trim()); } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!state} onClose={onClose} title={title} subtitle={subtitle}>
      <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4">
        <input
          autoFocus
          value={value}
          maxLength={state?.mode === 'file' ? 200 : 120}
          onChange={event => setValue(event.target.value)}
          placeholder={state?.mode === 'create' ? 'Ex.: Hotéis 2027, Vodafone, Viagem a Fátima' : ''}
          className="lg-pill h-10 w-full rounded-full px-4 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:ring-[3px] focus-visible:ring-zinc-900/15"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="primary" type="submit" disabled={busy || !value.trim()}>
            {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {state?.mode === 'create' ? 'Criar pasta' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function KindDialog({ file, onClose, onPick }: { file: FileRow | null; onClose: () => void; onPick: (kind: DocumentKind) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={!!file} onClose={onClose} title="Que documento é?" subtitle={file?.fileName}>
      {file && (
        <KindPicker value={file.kind} disabled={busy} onChange={kind => { setBusy(true); void onPick(kind).finally(() => setBusy(false)); }} />
      )}
    </Sheet>
  );
}

function ConfirmDialog({ open, title, text, confirm, onClose, onConfirm }: { open: boolean; title: string; text: string; confirm: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[13.5px] text-zinc-600">{text}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button size="sm" className="bg-rose-600 text-white hover:bg-rose-700" disabled={busy} onClick={() => { setBusy(true); void onConfirm().finally(() => setBusy(false)); }}>
          {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />} {confirm}
        </Button>
      </div>
    </Sheet>
  );
}
