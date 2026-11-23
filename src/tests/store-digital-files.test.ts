import { beforeEach, describe, expect, it, vi } from 'vitest';

const SUPABASE = 'https://project.supabase.co';
const FILE = `${SUPABASE}/storage/v1/object/public/store_files/products/livro%201.pdf`;

type Row = Record<string, any>;

const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  user: null as null | { id: string; email: string },
  signed: [] as Array<{ bucket: string; path: string; seconds: number }>,
  signError: false,
}));

vi.mock('../lib/supabase', () => {
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    const run = () => {
      const rows = (state.tables[table] || []).filter((row) => filters.every((f) => f(row)));
      if (patch) rows.forEach((row) => Object.assign(row, patch));
      return rows;
    };
    const builder: any = {
      select: () => builder,
      order: () => builder,
      range: () => builder,
      update: (value: Row) => { patch = value; return builder; },
      insert: async (value: Row) => {
        (state.tables[table] ||= []).push({ ...value });
        return { data: null, error: null };
      },
      eq: (c: string, v: unknown) => { filters.push((row) => row[c] === v); return builder; },
      is: (c: string, v: unknown) => { filters.push((row) => (row[c] ?? null) === v); return builder; },
      in: (c: string, v: unknown[]) => { filters.push((row) => v.includes(row[c])); return builder; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: run(), error: null }).then(resolve),
    };
    return builder;
  };
  return {
    supabaseServer: {
      from,
      auth: {
        getUser: async () => state.user
          ? { data: { user: state.user }, error: null }
          : { data: { user: null }, error: new Error('invalid') },
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, seconds: number) => {
            state.signed.push({ bucket, path, seconds });
            return state.signError
              ? { data: null, error: new Error('missing') }
              : { data: { signedUrl: `https://signed.example/${path}?token=s` }, error: null };
          },
        }),
      },
    },
  };
});

import { GET as download } from '../app/api/store/download/route';
import { GET as library } from '../app/api/store/library/route';
import { GET as listProducts } from '../app/api/store/products/route';
import { GET as oneProduct } from '../app/api/store/products/[id]/route';
import { fetchProductForPage } from '../app/loja/[id]/page';
import { createDigitalAccessToken } from '../lib/store-access';
import { mapStoreProductRecord } from '../lib/store-products';
import { buyerFileUrl, isRecentStoreOrder, storeFilePath } from '../lib/store-files';
import { supabaseServer } from '../lib/supabase';

const product = (): Row => ({
  product_id: 'livro', name: 'Livro em PDF', category: 'Livros Digitais', price: 5, currency: 'EUR',
  is_active: true, is_physical: false, type_id: 'book_digital', image_url: '/capa.jpg',
  digital_url: FILE, metadata: { pages: 10 }, allowed_countries: ['PT'], specifications: {},
});

const purchase = (over: Row = {}): Row => ({
  id: 'acesso-1', order_ref: 'store_1', product_id: 'livro', buyer_email: 'ana_silva@example.com',
  user_id: null, status: 'available', qty: 1, file_url: FILE, created_at: '2026-02-20T00:00:00Z', download_count: 0, ...over,
});

const link = async (expiresInDays = 7) => (await createDigitalAccessToken(supabaseServer, {
  orderRef: 'store_1', productId: 'livro', buyerEmail: 'ana_silva@example.com', expiresInDays,
})).token;

const get = (token?: string) => download(new Request(`https://site.test/api/store/download${token ? `?token=${token}` : ''}`));
const openLibrary = () => library(new Request('https://site.test/api/store/library', { headers: { authorization: 'Bearer x' } }));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
  state.tables = {
    store_products: [product()],
    store_orders: [{ order_ref: 'store_1', status: 'paid', buyer_email: 'ana_silva@example.com', buyer_user_id: null }],
    store_digital_access: [purchase()],
    store_digital_access_tokens: [],
    store_order_items: [{ order_ref: 'store_1', product_id: 'livro', qty: 1 }],
  };
  state.user = null;
  state.signed = [];
  state.signError = false;
});

describe('public store responses', () => {
  const expectNoAddress = (value: unknown) => {
    const text = JSON.stringify(value);
    expect(text).not.toContain('store_files');
    expect(text).not.toMatch(/digital_?url/i);
  };

  it('leaves the file address out of both product APIs and keeps what the app reads', async () => {
    const list = await (await listProducts(new Request('https://site.test/api/store/products'))).json();
    const one = await (await oneProduct(
      new Request('https://site.test/api/store/products/livro'),
      { params: Promise.resolve({ id: 'livro' }) },
    )).json();
    for (const item of [list.products[0], one.product]) {
      expectNoAddress(item);
      expect(item).toMatchObject({
        id: 'livro', isPhysical: false, type_id: 'book_digital', metadata: { pages: 10 }, allowedCountries: ['PT'], stock: null,
      });
    }
  });

  it('leaves it out of the pages too', async () => {
    expectNoAddress(await fetchProductForPage('livro'));
    expectNoAddress(mapStoreProductRecord(product(), 'pt'));
  });

  it('still treats a product as digital when only the file says so', async () => {
    const item = mapStoreProductRecord({ ...product(), is_physical: null, type_id: null, category: 'Outros', name: 'Livro' }, 'pt');
    expect(item.isPhysical).toBe(false);
    expectNoAddress(item);
  });
});

describe('download', () => {
  it('refuses a missing or unknown token', async () => {
    expect((await get()).status).toBe(400);
    expect((await get('inventado')).status).toBe(404);
  });

  it.each(['failed', 'pending', 'canceled', 'refunded'])('refuses a %s order', async (status) => {
    state.tables.store_orders[0].status = status;
    expect((await get(await link())).status).toBe(403);
    expect(state.signed).toEqual([]);
  });

  it('refuses when the access is missing or revoked', async () => {
    const token = await link();
    state.tables.store_digital_access[0].status = 'revoked';
    expect((await get(token)).status).toBe(403);
    state.tables.store_digital_access = [];
    expect((await get(token)).status).toBe(403);
    expect(state.signed).toEqual([]);
  });

  it('sends a buyer to a short signed link, with no headers needed', async () => {
    const response = await get(await link());
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toMatch(/^https:\/\/signed\.example\//);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(state.signed).toEqual([{ bucket: 'store_files', path: 'products/livro 1.pdf', seconds: 300 }]);
    expect(state.tables.store_digital_access[0].download_count).toBe(1);
  });

  it('keeps old email links working for a paid purchase', async () => {
    expect((await get(await link(-200))).status).toBe(307);
  });

  it('never falls back to the permanent address when signing fails', async () => {
    state.signError = true;
    const response = await get(await link());
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('library', () => {
  it('needs a session', async () => {
    expect((await library(new Request('https://site.test/api/store/library'))).status).toBe(401);
    expect((await openLibrary()).status).toBe(401);
  });

  it('gives the buyer the fields the app reads, and a link that works', async () => {
    state.user = { id: 'ana', email: 'Ana_Silva@example.com' };
    const body = await (await openLibrary()).json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ productId: 'livro', status: 'available', purchaseCount: 1 });
    expect(body.items[0].downloadUrl).toMatch(/^\/api\/store\/download\?token=/);
    expect(body.items[0]).not.toHaveProperty('fileUrl');
    expect(JSON.stringify(body)).not.toContain('store_files');
    expect(state.tables.store_digital_access[0].user_id).toBe('ana');
    expect((await get(body.items[0].downloadUrl.split('token=')[1])).status).toBe(307);
  });

  it('does not reach purchases of a similar email', async () => {
    state.tables.store_digital_access[0].buyer_email = 'anaXsilva@example.com';
    state.user = { id: 'outra', email: 'ana_silva@example.com' };
    expect((await (await openLibrary()).json()).items).toEqual([]);
    expect(state.tables.store_digital_access[0].user_id).toBeNull();
  });

  it('leaves out unpaid and revoked purchases', async () => {
    state.user = { id: 'ana', email: 'ana_silva@example.com' };
    state.tables.store_orders[0].status = 'failed';
    expect((await (await openLibrary()).json()).items).toEqual([]);
    state.tables.store_orders[0].status = 'paid';
    state.tables.store_digital_access[0].status = 'revoked';
    expect((await (await openLibrary()).json()).items).toEqual([]);
  });
});

describe('store files', () => {
  it('only signs files of the store bucket in this project', () => {
    expect(storeFilePath(FILE)).toBe('products/livro 1.pdf');
    expect(storeFilePath(FILE.replace('store_files', 'avatars'))).toBeNull();
    expect(storeFilePath(FILE.replace('project.', 'other.'))).toBeNull();
    expect(storeFilePath('nada')).toBeNull();
  });

  it('keeps files hosted elsewhere, but nothing that is not a web address', async () => {
    expect(await buyerFileUrl(supabaseServer!, 'https://drive.example/livro')).toBe('https://drive.example/livro');
    expect(await buyerFileUrl(supabaseServer!, 'javascript:alert(1)')).toBeNull();
  });

  it('shows buyer details only right after checkout', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(isRecentStoreOrder('2026-11-23T11:30:00Z', now)).toBe(true);
    expect(isRecentStoreOrder('2026-11-23T10:30:00Z', now)).toBe(false);
    expect(isRecentStoreOrder(null, now)).toBe(false);
  });
});
