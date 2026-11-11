export const ACCOUNTING_ARCHIVE_BUCKET = 'accounting-archive';
export const ACCOUNTING_ARCHIVE_ROOT = 'contabilidade-apostolado';

const FILE_EXTENSION = /\.(?:pdf|jpe?g|docx|xlsx)$/i;
const SAFE_SEGMENT = /^b_([A-Za-z0-9_-]+)(?:\.(pdf|jpe?g|docx|xlsx))?$/i;

/** Storage keys are ASCII; the original UTF-8 names are restored only for admins. */
export function archiveDisplayName(segment: string, file: boolean): string | null {
  const match = SAFE_SEGMENT.exec(segment);
  if (!match || (file && !match[2]) || (!file && !!match[2])) return null;
  const name = Buffer.from(match[1], 'base64url').toString('utf8');
  if (!name || name === '.' || name === '..' || /[/\\\u0000-\u001f\u007f]/.test(name)
      || Buffer.from(name, 'utf8').toString('base64url') !== match[1]
      || file && (!FILE_EXTENSION.test(name) || name.split('.').at(-1)?.toLowerCase() !== match[2]?.toLowerCase())) return null;
  return name;
}

/** Keep every request inside the one private archive collection. */
export function archivePath(value: string | null, file: boolean): string | null {
  const path = value || (file ? '' : ACCOUNTING_ARCHIVE_ROOT);
  if (!path || path.length > 512 || /[\\\u0000-\u001f\u007f]/.test(path)) return null;
  const segments = path.split('/');
  if (segments[0] !== ACCOUNTING_ARCHIVE_ROOT || file && segments.length < 3) return null;
  if (segments.slice(1).some((segment, index) =>
    !archiveDisplayName(segment, file && index === segments.length - 2))) return null;
  return path;
}
