/** Pure rules for accounting folders and files (no database), shared by server and page. */

export const FILE_TARGET_TYPES = ['bank_transaction', 'factpt_document', 'pilgrimage_payment', 'pilgrimage_cost', 'agreement'] as const;
export type FileTargetType = (typeof FILE_TARGET_TYPES)[number];

export const FILE_TARGET_LABELS: Record<FileTargetType, string> = {
  bank_transaction: 'Movimento do banco',
  factpt_document: 'Documento FACT.pt',
  pilgrimage_payment: 'Pagamento de peregrinação',
  pilgrimage_cost: 'Custo de logística',
  agreement: 'Acordo com fornecedor',
};

export function folderNameProblem(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return 'Dê um nome à pasta.';
  const name = value.trim();
  if (name.length > 120) return 'O nome é demasiado longo (máximo 120 caracteres).';
  if (/[/\\]/.test(name)) return 'O nome não pode ter / nem \\.';
  return null;
}

/** Names from the top folder down to this one. Stops on a loop instead of hanging. */
export function folderPath(folders: Map<string, { parentId: string | null; name: string }>, id: string | null): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let cursor = id;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const folder = folders.get(cursor);
    if (!folder) break;
    names.unshift(folder.name);
    cursor = folder.parentId;
  }
  return names;
}

/** What a file still needs, in words the admin understands. */
export function fileProblem(linkCount: number): string | null {
  return linkCount > 0 ? null : 'Falta ligar a um movimento do banco';
}

/** Folder ids that can't receive `id` when moving it (itself and everything under it). */
export function descendantIds(folders: Array<{ id: string; parentId: string | null }>, id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id);
        grew = true;
      }
    }
  }
  return result;
}
