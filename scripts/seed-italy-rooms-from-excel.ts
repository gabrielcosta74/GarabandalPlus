/**
 * Carrega a planta de quartos da Itália 2027 a partir do Excel.
 *
 *   npx tsx scripts/seed-italy-rooms-from-excel.ts          # simulação
 *   npx tsx scripts/seed-italy-rooms-from-excel.ts --write  # grava
 *
 * O Excel encoda os quartos de três formas, por ordem de confiança:
 *   1. Tipologia em branco = partilha com a linha de cima (convenção da folha).
 *   2. Nota explícita: "Partilha com X", "Fica com X", "Quarto triplo com X e Y".
 *   3. Mesma morada = casal ou família.
 *
 * Quem o Excel nunca emparelhou fica por atribuir, tal como estava. Os inscritos
 * que não existem no Excel (entraram depois) também.
 */

import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const PILGRIMAGE_ID = 'a7e2616e-fe39-48dc-968e-b14153c25325';
const XLSX = 'Contabilidade_Peregrinação_IItalia-Medjugorje 2027.xlsx';

const CAPACITY: Record<string, number> = { single: 1, double_bed: 2, twin: 2, triple: 3, family: 4 };
const LABEL: Record<string, string> = {
    single: 'Individual', double_bed: 'Duplo casal', twin: 'Duplo twin',
    triple: 'Triplo', family: 'Familiar',
};

type ExcelRow = { n: number; name: string; type: string; address: string; note: string };

// --- Leitura do xlsx sem dependências ---------------------------------------
function readSheet(): ExcelRow[] {
    const buf = readFileSync(XLSX);
    const files = new Map<string, Buffer>();
    let offset = 0;
    while (offset < buf.length - 4) {
        if (buf.readUInt32LE(offset) !== 0x04034b50) { offset += 1; continue; }
        const method = buf.readUInt16LE(offset + 8);
        const compSize = buf.readUInt32LE(offset + 18);
        const nameLen = buf.readUInt16LE(offset + 26);
        const extraLen = buf.readUInt16LE(offset + 28);
        const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString();
        const start = offset + 30 + nameLen + extraLen;
        if (compSize > 0) {
            const raw = buf.subarray(start, start + compSize);
            files.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
        }
        offset = start + compSize;
    }

    const strings = [...(files.get('xl/sharedStrings.xml')?.toString() || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
        .map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))
        .map(s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));

    const sheet = files.get('xl/worksheets/sheet1.xml')?.toString() || '';
    const rows: ExcelRow[] = [];

    for (const rowMatch of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells: Record<number, string> = {};
        for (const cell of rowMatch[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
            const letters = cell[1];
            let col = 0;
            for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
            const isShared = /t="s"/.test(cell[2]);
            const value = cell[3].match(/<v>([\s\S]*?)<\/v>/)?.[1];
            if (value === undefined) continue;
            cells[col - 1] = isShared ? (strings[Number(value)] ?? '') : value;
        }
        const n = Number(cells[1]);
        const name = (cells[3] || '').trim();
        if (!Number.isFinite(n) || !name) continue;
        rows.push({ n, name: cleanName(name) || name, type: (cells[4] || '').trim(), address: (cells[6] || '').trim(), note: (cells[13] || '').trim() });
    }
    return rows;
}

// --- Correspondência de nomes ------------------------------------------------
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'la']);

/**
 * Os nomes do Excel trazem anotações: "Rogério Rodrigues ( falta Izabel
 * Rodrigues) ????". Sem limpar isto, o nome dele contém o nome dela e rouba-lhe
 * a correspondência.
 */
const cleanName = (v: string) => v.replace(/\([^)]*\)/g, ' ').replace(/[?\]]+/g, ' ').trim();
const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (v: string) => norm(v).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
const stem = (w: string) => w.replace(/(s|es)$/, '').replace(/c/g, 'k');
const score = (a: string, b: string) => {
    const left = new Set(tokens(a).map(stem));
    return tokens(b).map(stem).filter(t => left.has(t)).length;
};

const planType = (excelType: string): string => {
    const t = norm(excelType);
    if (t.includes('individual')) return 'single';
    if (t.includes('triplo')) return 'triple';
    if (t.includes('familiar')) return 'family';
    if (t.includes('duplo m')) return 'double_bed';
    if (t.includes('duplo t')) return 'twin';
    return 'twin';
};

async function main() {
    const write = process.argv.includes('--write');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const excel = readSheet();

    // --- Grupos a partir do Excel -------------------------------------------
    const groupOf = new Map<number, number>();   // nº excel -> nº do líder
    const link = (a: number, b: number) => {
        const leader = groupOf.get(a) ?? a;
        groupOf.set(a, leader);
        groupOf.set(b, leader);
    };

    // 1. Tipologia em branco = continua o quarto de cima.
    let current: ExcelRow | null = null;
    for (const row of excel) {
        if (row.type) { current = row; groupOf.set(row.n, row.n); continue; }
        if (current) link(current.n, row.n);
    }

    // Quantas vezes cada palavra aparece nos nomes da folha. Uma nota como
    // "com June e Cynthia" traz só o primeiro nome: chega, desde que seja único.
    const excelTokenCount = new Map<string, number>();
    for (const row of excel) {
        for (const tk of new Set(tokens(row.name).map(stem))) {
            excelTokenCount.set(tk, (excelTokenCount.get(tk) || 0) + 1);
        }
    }

    // 2. Notas explícitas.
    for (const row of excel) {
        if (!row.note) continue;
        const m = row.note.match(/(?:partilh\w*|fica|quarto triplo)\s+(?:com|quarto com)?\s*:?\s*(.+)/i)
            || row.note.match(/com quem\s*:\s*(.+)/i);
        if (!m) continue;
        for (const raw of m[1].split(/[,;\]]|\se\s/).map(s => s.trim()).filter(s => s.length > 3)) {
            let best: ExcelRow | null = null;
            let bestScore = 0;
            for (const other of excel) {
                if (other.n === row.n) continue;
                const sc = score(other.name, raw);
                if (sc === 0) continue;
                // Uma palavra só chega quando não há outra pessoa com ela.
                const enough = sc > 1
                    || tokens(raw).map(stem).some(tk => excelTokenCount.get(tk) === 1);
                if (enough && sc > bestScore) { best = other; bestScore = sc; }
            }
            if (best) link(row.n, best.n);
        }
    }

    // 3. Mesma morada.
    const byAddress = new Map<string, ExcelRow[]>();
    for (const row of excel) {
        if (row.address.length < 15) continue;
        const key = norm(row.address).replace(/[^a-z0-9]/g, '').slice(0, 40);
        byAddress.set(key, [...(byAddress.get(key) || []), row]);
    }
    for (const group of byAddress.values()) {
        if (group.length < 2) continue;
        for (let i = 1; i < group.length; i++) link(group[0].n, group[i].n);
    }

    // Resolver líderes transitivamente.
    const leaderOf = (n: number): number => {
        let cur = n;
        for (let i = 0; i < 10 && groupOf.get(cur) !== undefined && groupOf.get(cur) !== cur; i++) cur = groupOf.get(cur)!;
        return cur;
    };

    const groups = new Map<number, ExcelRow[]>();
    for (const row of excel) {
        const leader = leaderOf(row.n);
        groups.set(leader, [...(groups.get(leader) || []), row]);
    }

    // --- Cruzar com os inscritos reais --------------------------------------
    const { data: bookings } = await supabase
        .from('bookings').select('id').eq('pilgrimage_id', PILGRIMAGE_ID).neq('status', 'cancelled');
    const { data: pilgrims } = await supabase
        .from('pilgrims').select('id,full_name,room_type')
        .in('booking_id', (bookings || []).map((b: any) => b.id));

    // Emparelhamento global: avaliamos todos os pares e ficamos com os melhores
    // primeiro. Por ordem da folha, um nome com anotações rouba a pessoa errada.
    // Um apelido que só existe numa pessoa chega para identificar: no Excel é
    // "Elenita Lesperance", no sistema "Elle Lesperance".
    const tokenCount = new Map<string, number>();
    for (const p of pilgrims || []) {
        for (const tk of new Set(tokens(p.full_name).map(stem))) {
            tokenCount.set(tk, (tokenCount.get(tk) || 0) + 1);
        }
    }
    const uniqueHit = (excelName: string, dbName: string) =>
        tokens(excelName).map(stem).some(tk =>
            tokenCount.get(tk) === 1 && new Set(tokens(dbName).map(stem)).has(tk));

    const pairs: { n: number; pilgrim: any; sc: number }[] = [];
    for (const row of excel) {
        for (const p of pilgrims || []) {
            const sc = score(p.full_name, row.name);
            if (sc > 1) pairs.push({ n: row.n, pilgrim: p, sc });
            else if (sc === 1 && uniqueHit(row.name, p.full_name)) pairs.push({ n: row.n, pilgrim: p, sc: 1 });
        }
    }
    pairs.sort((a, b) => b.sc - a.sc);

    const matched = new Map<number, { id: string; full_name: string }>();
    const usedPilgrims = new Set<string>();
    for (const pair of pairs) {
        if (matched.has(pair.n) || usedPilgrims.has(pair.pilgrim.id)) continue;
        matched.set(pair.n, pair.pilgrim);
        usedPilgrims.add(pair.pilgrim.id);
    }

    // --- Quartos a criar ----------------------------------------------------
    const drafts: { type: string; members: { id: string; name: string }[]; source: string }[] = [];
    const skipped: string[] = [];

    for (const [leader, members] of groups) {
        const typed = members.find(m => m.type) || members[0];
        const type = planType(typed.type);
        const present = members.map(m => matched.get(m.n)).filter(Boolean) as { id: string; full_name: string }[];

        if (present.length === 0) {
            skipped.push(`${members.map(m => m.name).join(' + ')} — não está inscrito no sistema`);
            continue;
        }
        // Só cria quarto quando o Excel comprometeu alguém: grupo com mais de uma
        // pessoa, ou individual (que por definição é um quarto fechado).
        if (present.length === 1 && type !== 'single' && members.length === 1) {
            skipped.push(`${present[0].full_name} — o Excel não disse com quem partilha`);
            continue;
        }
        drafts.push({
            type,
            members: present.map(p => ({ id: p.id, name: p.full_name })),
            source: members.length > 1 ? 'Excel: grupo' : 'Excel: individual',
        });
    }

    const placed = new Set(drafts.flatMap(d => d.members.map(m => m.id)));
    const leftover = (pilgrims || []).filter((p: any) => !placed.has(p.id));

    // --- Relatório ----------------------------------------------------------
    const order = ['double_bed', 'twin', 'triple', 'family', 'single'];
    drafts.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    console.log(`\nQUARTOS DO EXCEL (${drafts.length})`);
    for (const d of drafts) {
        const flag = d.members.length > (CAPACITY[d.type] ?? 2) ? '  <-- excede a capacidade' : '';
        console.log(`  ${LABEL[d.type].padEnd(12)} ${d.members.map(m => m.name).join(' + ')}${flag}`);
    }

    console.log(`\nFICAM POR ATRIBUIR (${leftover.length})`);
    for (const p of leftover) console.log(`  ${p.full_name} (${p.room_type || 'sem tipologia'})`);

    if (skipped.length) {
        console.log(`\nLINHAS DO EXCEL IGNORADAS (${skipped.length})`);
        for (const s of skipped) console.log(`  ${s}`);
    }

    if (!write) {
        console.log('\n>>> SIMULAÇÃO. Nada foi gravado. Corre com --write para gravar.\n');
        return;
    }

    const { data: existing } = await supabase
        .from('pilgrimage_rooms').select('id').eq('pilgrimage_id', PILGRIMAGE_ID);
    if ((existing?.length || 0) > 0) {
        console.log(`\nA planta já tem ${existing!.length} quartos — apagar e refazer.`);
        await supabase.from('pilgrimage_rooms').delete().eq('pilgrimage_id', PILGRIMAGE_ID);
    }

    const counters: Record<string, number> = {};
    const rows = drafts.map((d, i) => {
        counters[d.type] = (counters[d.type] || 0) + 1;
        return {
            pilgrimage_id: PILGRIMAGE_ID,
            label: `${LABEL[d.type]} ${counters[d.type]}`,
            room_type: d.type,
            capacity: CAPACITY[d.type] ?? 2,
            display_order: i + 1,
        };
    });

    const { data: created, error } = await supabase.from('pilgrimage_rooms').insert(rows).select('id,display_order');
    if (error) throw error;

    const byOrder = new Map((created || []).map((r: any) => [r.display_order, r.id]));
    const members = drafts.flatMap((d, i) =>
        d.members.map((m, position) => ({ room_id: byOrder.get(i + 1), pilgrim_id: m.id, seat_id: null, position })),
    );
    const { error: memberError } = await supabase.from('pilgrimage_room_members').insert(members);
    if (memberError) throw memberError;

    console.log(`\nGravado: ${rows.length} quartos, ${members.length} pessoas colocadas, ${leftover.length} por atribuir.\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
