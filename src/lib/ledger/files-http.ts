
import { FileActionError, FilesNotReadyError } from './files';
import { requireAdmin } from './server';

export const UUID = /^[0-9a-f-]{36}$/i;

/** Admin check + one way to word every refusal for the folder/file routes. */
export async function handle(req: Request, work: (admin: { email: string }) => Promise<unknown>): Promise<Response> {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  try {
    const result = await work({ email: admin.email });
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof FilesNotReadyError) return Response.json({ ready: false, error: error.message }, { status: 503 });
    if (error instanceof FileActionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : 'Algo correu mal.' }, { status: 500 });
  }
}

export const invalid = (message = 'Pedido inválido.') => Response.json({ error: message }, { status: 400 });
