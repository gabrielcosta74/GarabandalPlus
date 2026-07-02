#!/usr/bin/env node
// Rebuild the marketing_contacts projection from all source tables (members,
// leads, waitlists, bookings, donations, orders, quotas, newsletter_subscribers).
// Same work as POST /api/admin/marketing/sync-contacts, run with the service role.
//
//   npx tsx scripts/rebuild-marketing-contacts.mjs

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { buildMarketingContacts, persistMarketingContacts } from '../src/lib/marketing-data.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

const contacts = await buildMarketingContacts(supabase);
const result = await persistMarketingContacts(supabase, contacts);
console.log('sourceContacts:', contacts.length, '|', JSON.stringify(result));
