#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { parseStringPromise } from 'xml2js';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const DEFAULT_XLSX = 'membrostabela.xlsx';
const DEFAULT_SHEET = 'Membros 2025 atualizado';
const YEARS = [2023, 2024, 2025, 2026, 2027];

const YEAR_VALUE_COL = {
  2023: 10,
  2024: 11,
  2025: 13,
  2026: 17,
  2027: 21,
};

const YEAR_METHOD_COL = {
  2023: null,
  2024: 12,
  2025: 14,
  2026: 18,
  2027: 22,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    apply: false,
    xlsxPath: DEFAULT_XLSX,
    sheetName: DEFAULT_SHEET,
    outDir: 'migration-output',
    createAuthForExcluded: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') out.apply = true;
    else if (arg === '--create-auth-for-excluded') out.createAuthForExcluded = true;
    else if (arg === '--file' && args[i + 1]) out.xlsxPath = args[++i];
    else if (arg === '--sheet' && args[i + 1]) out.sheetName = args[++i];
    else if (arg === '--out-dir' && args[i + 1]) out.outDir = args[++i];
  }
  return out;
}

function readZipEntry(xlsxPath, entryPath) {
  return execFileSync('unzip', ['-p', xlsxPath, entryPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30,
  });
}

function colToIndex(cellRef) {
  const m = String(cellRef || '').match(/^([A-Z]+)/);
  if (!m) return -1;
  return m[1].split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

function getCell(row, index) {
  if (!row || index >= row.length) return '';
  const value = row[index];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeText(value) {
  const cleaned = String(value || '').trim();
  return cleaned ? cleaned.replace(/\s+/g, ' ') : '';
}

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}

function normalizeNif(value) {
  const nif = normalizeText(value);
  if (!nif) return null;
  if (['sem', 'n/a', 'na', '-', '--'].includes(nif.toLowerCase())) return null;
  return nif;
}

function xmlText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return String(node);
  }
  if (Array.isArray(node)) return node.map((item) => xmlText(item)).join('');
  if (typeof node === 'object') {
    if (node._ !== undefined) return String(node._);
    if (node.t !== undefined) return xmlText(node.t);
    if (node.r !== undefined) return xmlText(node.r);
  }
  return '';
}

function parseAmount(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (['n/a', 'na', 'não pagou', 'nao pagou', '-', '--'].includes(lowered)) return null;
  const normalized = raw.replace(',', '.').replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

function normalizeCategory(value) {
  const raw = normalizeText(value).toLowerCase();
  if (raw.includes('fundador')) return 'fundador';
  if (raw.includes('honor')) return 'honorifico';
  if (raw.includes('exclu')) return 'excluido';
  return 'regular';
}

function methodForYear(rawMethod) {
  const method = normalizeText(rawMethod);
  if (!method || ['n/a', 'na'].includes(method.toLowerCase())) return 'manual';
  return method;
}

function makeSeedUuid(seed) {
  const hash = crypto.createHash('sha1').update(seed).digest('hex');
  const raw = hash.slice(0, 32).split('');
  raw[12] = '5';
  const variant = Number.parseInt(raw[16], 16);
  raw[16] = ((variant & 0x3) | 0x8).toString(16);
  return `${raw.slice(0, 8).join('')}-${raw.slice(8, 12).join('')}-${raw.slice(12, 16).join('')}-${raw.slice(16, 20).join('')}-${raw.slice(20, 32).join('')}`;
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const text = value === undefined || value === null ? '' : String(value);
      if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    })
    .join(',');
}

async function readSheetRows(xlsxPath, sheetName) {
  const workbookXml = readZipEntry(xlsxPath, 'xl/workbook.xml');
  const workbook = await parseStringPromise(workbookXml);
  const sheetNodes = workbook?.workbook?.sheets?.[0]?.sheet || [];
  const sheetNode = sheetNodes.find((sheet) => sheet?.$?.name === sheetName);
  if (!sheetNode) {
    throw new Error(`Sheet "${sheetName}" not found in ${xlsxPath}`);
  }

  const relsXml = readZipEntry(xlsxPath, 'xl/_rels/workbook.xml.rels');
  const rels = await parseStringPromise(relsXml);
  const relNodes = rels?.Relationships?.Relationship || [];
  const relMap = new Map(relNodes.map((rel) => [rel?.$?.Id, rel?.$?.Target]));

  const target = relMap.get(sheetNode.$['r:id']);
  if (!target) throw new Error(`Cannot resolve relationship for sheet "${sheetName}"`);
  const worksheetPath = `xl/${String(target).replace(/^\/+/, '')}`;

  const sharedStrings = [];
  try {
    const sstXml = readZipEntry(xlsxPath, 'xl/sharedStrings.xml');
    const sst = await parseStringPromise(sstXml);
    const siNodes = sst?.sst?.si || [];
    for (const si of siNodes) {
      if (si.t !== undefined) {
        sharedStrings.push(xmlText(si.t));
      } else {
        const fragments = (si.r || []).map((part) => xmlText(part?.t ?? part));
        sharedStrings.push(fragments.join(''));
      }
    }
  } catch {
    // sharedStrings.xml is optional
  }

  const worksheetXml = readZipEntry(xlsxPath, worksheetPath);
  const worksheet = await parseStringPromise(worksheetXml);
  const rowNodes = worksheet?.worksheet?.sheetData?.[0]?.row || [];

  const rows = rowNodes.map((rowNode) => {
    const row = [];
    for (const cell of rowNode.c || []) {
      const index = colToIndex(cell?.$?.r);
      if (index < 0) continue;
      const type = cell?.$?.t;
      let value = '';
      if (type === 's') {
        const sstIndex = Number.parseInt(cell?.v?.[0] ?? '', 10);
        value = Number.isFinite(sstIndex) ? sharedStrings[sstIndex] ?? '' : '';
      } else if (type === 'inlineStr') {
        value = xmlText(cell?.is?.[0]?.t ?? cell?.is?.[0] ?? '');
      } else {
        value = String(cell?.v?.[0] ?? '');
      }
      row[index] = value;
    }
    return row;
  });

  return rows;
}

function parseSpreadsheetRecords(rows) {
  const headerRowIndex = rows.findIndex((row) => getCell(row, 1).toLowerCase() === 'nº de membro');
  if (headerRowIndex < 0) throw new Error('Header row not found');

  const records = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const memberNumber = getCell(row, 1);
    if (!/^\d+$/.test(memberNumber)) continue;

    const base = {
      sourceRow: i + 1,
      numero_socio: memberNumber,
      nome: normalizeText(getCell(row, 2)),
      categoria_raw: normalizeText(getCell(row, 3)),
      categoria: normalizeCategory(getCell(row, 3)),
      address: normalizeText(getCell(row, 4)) || null,
      postal_code: normalizeText(getCell(row, 5)) || null,
      telefone: normalizeText(getCell(row, 6)) || null,
      email: normalizeEmail(getCell(row, 7)),
      country: normalizeText(getCell(row, 8)) || null,
      nif: normalizeNif(getCell(row, 9)),
      yearPayments: {},
    };

    for (const year of YEARS) {
      const amount = parseAmount(getCell(row, YEAR_VALUE_COL[year]));
      const methodRaw = YEAR_METHOD_COL[year] === null ? '' : getCell(row, YEAR_METHOD_COL[year]);
      base.yearPayments[year] = {
        amount,
        method: methodForYear(methodRaw),
      };
    }

    records.push(base);
  }
  return records;
}

async function listAllAuthUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

function buildMemberStatus(record) {
  const isFounder = record.categoria === 'fundador';
  const isHonorifico = record.categoria === 'honorifico';
  const isExcluded = record.categoria === 'excluido';

  let earliestPaidYear = null;
  let latestPaidYear = null;
  for (const year of YEARS) {
    const amount = record.yearPayments[year]?.amount ?? null;
    if (amount !== null) {
      if (earliestPaidYear === null || year < earliestPaidYear) earliestPaidYear = year;
      if (latestPaidYear === null || year > latestPaidYear) latestPaidYear = year;
    }
  }

  const paid2026 = record.yearPayments[2026]?.amount !== null;

  let estado_quota = 'pendente';
  let is_membro = false;
  let proxima_quota = null;
  let tipo_subscricao = 'regular';

  if (isFounder) tipo_subscricao = 'fundador';
  if (isHonorifico) tipo_subscricao = 'honorifico';

  if (isExcluded) {
    estado_quota = 'revogado';
    is_membro = false;
    proxima_quota = null;
  } else if (isFounder || isHonorifico) {
    estado_quota = 'pago';
    is_membro = true;
    proxima_quota = null;
  } else if (latestPaidYear !== null) {
    const nextYear = latestPaidYear + 1;
    proxima_quota = `${nextYear}-01-31`;
    if (latestPaidYear >= 2026) {
      estado_quota = 'pago';
      is_membro = true;
    } else {
      estado_quota = 'expirado';
      is_membro = false;
    }
  } else {
    estado_quota = 'pendente';
    is_membro = false;
    proxima_quota = null;
  }

  const data_adesao = earliestPaidYear ? `${earliestPaidYear}-01-01` : null;

  return {
    isFounder,
    isHonorifico,
    isExcluded,
    paid2026,
    earliestPaidYear,
    latestPaidYear,
    estado_quota,
    is_membro,
    proxima_quota,
    tipo_subscricao,
    data_adesao,
  };
}

async function main() {
  const args = parseArgs();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE credentials in .env/.env.local');
  }

  const xlsxPath = path.resolve(process.cwd(), args.xlsxPath);
  if (!fs.existsSync(xlsxPath)) throw new Error(`File not found: ${xlsxPath}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const rows = await readSheetRows(xlsxPath, args.sheetName);
  const records = parseSpreadsheetRecords(rows);

  const [authUsers, membersData, existingLegacyPayments] = await Promise.all([
    listAllAuthUsers(supabase),
    supabase.from('membros').select('id,email,numero_socio'),
    supabase.from('pagamentos_quotas').select('external_reference').like('external_reference', 'legacy_quota:%'),
  ]);

  if (membersData.error) throw membersData.error;
  if (existingLegacyPayments.error) throw existingLegacyPayments.error;

  const authByEmail = new Map();
  for (const user of authUsers) {
    const email = normalizeEmail(user.email);
    if (email) authByEmail.set(email, user);
  }

  const members = membersData.data || [];
  const memberByEmail = new Map();
  const memberByNumber = new Map();
  for (const member of members) {
    const email = normalizeEmail(member.email);
    if (email) memberByEmail.set(email, member);
    const number = normalizeText(member.numero_socio);
    if (number) memberByNumber.set(number, member);
  }

  const paymentRefs = new Set((existingLegacyPayments.data || []).map((p) => p.external_reference).filter(Boolean));

  const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), args.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const passwordCsvPath = path.join(outDir, `member-temp-passwords-${nowStamp}.csv`);
  const reportPath = path.join(outDir, `member-migration-report-${nowStamp}.json`);

  const passwordRows = [['numero_socio', 'nome', 'email', 'password', 'status']];
  const warnings = [];

  let createdAuthCount = 0;
  let reusedAuthCount = 0;
  let insertedMembers = 0;
  let updatedMembers = 0;
  let insertedPayments = 0;

  const seenEmails = new Set();

  for (const record of records) {
    const status = buildMemberStatus(record);
    let email = record.email;
    const existingByNumber = memberByNumber.get(record.numero_socio);
    const existingByEmail = email ? memberByEmail.get(email) : null;
    const duplicateEmailInSheet = email && seenEmails.has(email);

    if (email) seenEmails.add(email);

    let memberId = existingByNumber?.id || existingByEmail?.id || null;
    let shouldCreateAuth = Boolean(email);

    if (status.isExcluded && !args.createAuthForExcluded) {
      shouldCreateAuth = false;
    }

    if (duplicateEmailInSheet) {
      warnings.push({
        type: 'duplicate_email_sheet',
        numero_socio: record.numero_socio,
        email,
        action: 'set_email_null_no_auth',
      });
      email = null;
      shouldCreateAuth = false;
    }

    const authUser = email ? authByEmail.get(email) : null;
    if (authUser?.id) {
      memberId = authUser.id;
      reusedAuthCount += 1;
    }

    const password = `Membro.${crypto.randomBytes(5).toString('base64url')}!`;
    if (!memberId && shouldCreateAuth && email && !authUser) {
      if (args.apply) {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nome: record.nome, numero_socio: record.numero_socio, imported_from: 'membrostabela.xlsx' },
        });
        if (error) {
          warnings.push({
            type: 'auth_create_failed',
            numero_socio: record.numero_socio,
            email,
            error: error.message,
            action: 'member_without_auth',
          });
          shouldCreateAuth = false;
        } else {
          memberId = data.user?.id || null;
          if (memberId) {
            authByEmail.set(email, data.user);
            passwordRows.push([record.numero_socio, record.nome, email, password, 'created']);
            createdAuthCount += 1;
          } else {
            shouldCreateAuth = false;
          }
        }
      } else {
        createdAuthCount += 1;
      }
    } else if (email && authUser?.id) {
      passwordRows.push([record.numero_socio, record.nome, email, '', 'existing']);
    }

    if (!memberId) {
      memberId = makeSeedUuid(`legacy-member:${record.numero_socio}`);
    }

    let nif = record.nif;
    if (nif && ['sem', 'n/a', 'na'].includes(nif.toLowerCase())) nif = null;

    const memberPayload = {
      id: memberId,
      numero_socio: record.numero_socio,
      nome: record.nome || null,
      email,
      telefone: record.telefone,
      country: record.country,
      address: record.address,
      postal_code: record.postal_code,
      nif,
      tipo_subscricao: status.tipo_subscricao,
      is_membro: status.is_membro,
      estado_quota: status.estado_quota,
      proxima_quota: status.proxima_quota,
      data_adesao: status.data_adesao,
    };

    if (args.apply) {
      let upsertResult = await supabase.from('membros').upsert(memberPayload, { onConflict: 'id' });
      if (upsertResult.error && nif) {
        warnings.push({
          type: 'nif_conflict',
          numero_socio: record.numero_socio,
          nif,
          action: 'retry_with_null_nif',
        });
        memberPayload.nif = null;
        upsertResult = await supabase.from('membros').upsert(memberPayload, { onConflict: 'id' });
      }
      if (upsertResult.error) {
        warnings.push({
          type: 'member_upsert_failed',
          numero_socio: record.numero_socio,
          error: upsertResult.error.message,
        });
        continue;
      }

      if (existingByNumber || existingByEmail) updatedMembers += 1;
      else insertedMembers += 1;
    } else if (existingByNumber || existingByEmail) {
      updatedMembers += 1;
    } else {
      insertedMembers += 1;
    }

    for (const year of YEARS) {
      const payment = record.yearPayments[year];
      if (!payment?.amount) continue;
      const externalReference = `legacy_quota:${record.numero_socio}:${year}`;
      if (paymentRefs.has(externalReference)) continue;

      if (args.apply) {
        const { error } = await supabase.from('pagamentos_quotas').insert({
          user_id: memberId,
          data_pagamento: `${year}-01-01`,
          valor: payment.amount,
          metodo_pagamento: payment.method,
          estado: 'pago',
          external_reference: externalReference,
          payment_intent_id: `legacy_import:${record.numero_socio}:${year}`,
        });
        if (error) {
          warnings.push({
            type: 'payment_insert_failed',
            numero_socio: record.numero_socio,
            year,
            error: error.message,
          });
          continue;
        }
      }

      paymentRefs.add(externalReference);
      insertedPayments += 1;
    }
  }

  const paid2026Count = records.filter((record) => record.yearPayments[2026]?.amount !== null).length;
  const unpaid2026Count = records.length - paid2026Count;
  const excludedCount = records.filter((record) => normalizeCategory(record.categoria_raw) === 'excluido').length;

  const report = {
    mode: args.apply ? 'apply' : 'dry-run',
    source: {
      file: xlsxPath,
      sheet: args.sheetName,
      records: records.length,
    },
    results: {
      createdAuthCount,
      reusedAuthCount,
      insertedMembers,
      updatedMembers,
      insertedPayments,
      paid2026Count,
      unpaid2026Count,
      excludedCount,
      warningsCount: warnings.length,
    },
    warnings,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(passwordCsvPath, passwordRows.map((row) => toCsvRow(row)).join('\n') + '\n', 'utf8');

  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Source: ${xlsxPath} [${args.sheetName}]`);
  console.log(`Records: ${records.length}`);
  console.log(`Created auth: ${createdAuthCount}`);
  console.log(`Reused auth: ${reusedAuthCount}`);
  console.log(`Members inserted: ${insertedMembers}`);
  console.log(`Members updated: ${updatedMembers}`);
  console.log(`Payments inserted: ${insertedPayments}`);
  console.log(`2026 paid: ${paid2026Count}`);
  console.log(`2026 unpaid: ${unpaid2026Count}`);
  console.log(`Excluded: ${excludedCount}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Password CSV: ${passwordCsvPath}`);
  console.log(`Report JSON: ${reportPath}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
