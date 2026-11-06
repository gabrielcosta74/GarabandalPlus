/** Stays under the 10 MB request limit of proxy.ts, so an upload is never cut short. */
export const MAX_DOCUMENT_BYTES = 9 * 1024 * 1024;

const SIGNATURES: { mime: string; extension: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { mime: 'application/pdf', extension: 'pdf', matches: bytes => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) },
  { mime: 'image/jpeg', extension: 'jpg', matches: bytes => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  { mime: 'image/png', extension: 'png', matches: bytes => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) },
  { mime: 'image/webp', extension: 'webp', matches: bytes => startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 12) === 'WEBP' },
  { mime: 'image/heic', extension: 'heic', matches: bytes => ascii(bytes, 4, 8) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(bytes, 8, 12)) },
];

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

/** The file's own bytes decide what it is: a name or a browser header can lie. */
export function detectDocumentType(bytes: Uint8Array): { mime: string; extension: string } | null {
  const match = SIGNATURES.find(signature => signature.matches(bytes));
  return match ? { mime: match.mime, extension: match.extension } : null;
}

export function documentProblem(file: { name: string; size: number }): string | null {
  if (file.size === 0) return 'O ficheiro está vazio.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'O ficheiro é demasiado grande (máximo 9 MB).';
  if (file.name.length > 255) return 'O nome do ficheiro é demasiado longo.';
  return null;
}

export function documentStoragePath(period: string, movementId: string, sha256: string, extension: string): string {
  return `${period}/${movementId}/${sha256.slice(0, 32)}.${extension}`;
}
