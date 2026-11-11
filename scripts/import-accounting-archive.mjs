/** Import a local accounting folder into a dedicated, private Supabase bucket.
 * Usage: node --env-file=.env scripts/import-accounting-archive.mjs /absolute/folder [--apply]
 * Without --apply this only validates and reports aggregate counts.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'accounting-archive';
const ROOT = 'contabilidade-apostolado';
const MAX_BYTES = 20 * 1024 * 1024;
const MIME = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const encodeSegment = (name, file) => {
  const encoded = Buffer.from(name, 'utf8').toString('base64url');
  const extension = file ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return `b_${encoded}${file ? `.${extension}` : ''}`;
};

const args = process.argv.slice(2);
const source = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');
if (!source || args.some(arg => arg.startsWith('--') && arg !== '--apply')) {
  throw new Error('Indique a pasta absoluta e, para importar, --apply.');
}
const root = resolve(source);
if (basename(root) !== ROOT) throw new Error(`A pasta deve chamar-se ${ROOT}.`);

const files = [];
let skippedShortcuts = 0;
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('O arquivo contém uma ligação simbólica; importação interrompida.');
    if (entry.isDirectory()) { await scan(full); continue; }
    if (!entry.isFile()) throw new Error('O arquivo contém um item não regular; importação interrompida.');
    const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
    if (ext === '.lnk') { skippedShortcuts += 1; continue; }
    if (!MIME[ext]) throw new Error(`Extensão não suportada: ${ext}`);
    const info = await stat(full);
    if (info.size === 0 || info.size > MAX_BYTES) throw new Error('Ficheiro vazio ou acima do limite de 20 MiB.');
    const body = await readFile(full);
    const signatureOk = ext === '.pdf' ? body.subarray(0, 8).includes(Buffer.from('%PDF-'))
      : ext === '.jpg' || ext === '.jpeg' ? body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (!signatureOk) throw new Error(`Assinatura inválida para ${ext}; importação interrompida.`);
    const rel = relative(root, full).split(sep).join('/');
    if (rel.startsWith('../') || rel.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Caminho fora do arquivo; importação interrompida.');
    }
    const parts = rel.split('/');
    const storagePath = `${ROOT}/${parts.map((part, index) => encodeSegment(part, index === parts.length - 1)).join('/')}`;
    files.push({ full, path: storagePath, mime: MIME[ext], size: info.size,
      sha256: createHash('sha256').update(body).digest('hex') });
  }
}
await scan(root);
files.sort((a, b) => a.path.localeCompare(b.path, 'pt'));
console.log(JSON.stringify({ documents: files.length, folders: new Set(files.map(file => file.path.split('/')[1])).size,
  bytes: files.reduce((sum, file) => sum + file.size, 0), skippedShortcuts, mode: apply ? 'apply' : 'dry-run' }));
if (!apply) process.exit(0);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Faltam credenciais de servidor Supabase.');
if (new URL(url).hostname !== 'pntzzuxzjnzksubbjfvj.supabase.co') {
  throw new Error('Este importador só pode atuar no projeto Supabase do Apostolado.');
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existingBucket, error: bucketError } = await client.storage.getBucket(BUCKET);
if (bucketError && !/bucket not found/i.test(bucketError.message)) throw bucketError;
if (existingBucket) {
  const allowed = new Set(existingBucket.allowed_mime_types || []);
  if (existingBucket.public || (existingBucket.file_size_limit || 0) < MAX_BYTES
      || Object.values(MIME).some(mime => !allowed.has(mime))) {
    throw new Error('A configuração do bucket existente não cumpre as regras de privacidade e tipos.');
  }
} else {
  const { error } = await client.storage.createBucket(BUCKET, {
    public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: [...new Set(Object.values(MIME))],
  });
  if (error) throw error;
}
const { data: checkedBucket, error: checkError } = await client.storage.getBucket(BUCKET);
if (checkError || !checkedBucket || checkedBucket.public) throw new Error('Não foi possível confirmar que o bucket é privado.');

let uploaded = 0;
let alreadyPresent = 0;
async function verify(file) {
  const { data, error } = await client.storage.from(BUCKET).download(file.path);
  if (error || !data) throw new Error('Falhou a verificação de um documento importado.');
  const digest = createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex');
  if (digest !== file.sha256) throw new Error('Um documento remoto não coincide com o original.');
}

for (let index = 0; index < files.length; index += 4) {
  const batch = files.slice(index, index + 4);
  await Promise.all(batch.map(async file => {
    const body = await readFile(file.full);
    const { error } = await client.storage.from(BUCKET).upload(file.path, body, {
      contentType: file.mime, upsert: false, cacheControl: '0',
      metadata: { sha256: file.sha256 },
    });
    if (error) {
      if (Number(error.statusCode) !== 409) throw error;
      alreadyPresent += 1;
    } else uploaded += 1;
    await verify(file);
  }));
  if ((index + batch.length) % 40 === 0 || index + batch.length === files.length) {
    console.log(JSON.stringify({ verified: index + batch.length, total: files.length }));
  }
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!anonKey) throw new Error('Falta a chave pública para verificar o isolamento do bucket.');
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: exposed, error: anonError } = await anon.storage.from(BUCKET).list(ROOT, { limit: 1 });
const { data: exposedFile } = await anon.storage.from(BUCKET).download(files[0].path);
if ((exposed || []).length > 0 || exposedFile) throw new Error('O arquivo ficou acessível sem autenticação de administrador.');

console.log(JSON.stringify({ uploaded, alreadyPresent, verified: files.length, privateBucket: true,
  anonymousAccessDenied: !!anonError || (exposed || []).length === 0 && !exposedFile }));
