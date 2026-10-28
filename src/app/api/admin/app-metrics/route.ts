import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { isExpoPushToken } from '../../../../lib/expo-push';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

type DeviceRow = {
  user_id: string;
  platform: string | null;
  app_version: string | null;
  locale: string | null;
  push_enabled: boolean;
  expo_push_token: string | null;
  last_seen_at: string;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { authorized, error: authError } = await verifyAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: authError || 'Não autorizado.' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(7, Number.parseInt(searchParams.get('days') || '30', 10) || 30));
  const now = Date.now();
  const recentCutoff = now - 30 * DAY_MS;
  const weekCutoff = now - 7 * DAY_MS;
  const trendCutoff = now - days * DAY_MS;
  const devices: DeviceRow[] = [];
  const pageSize = 1000;

  // Read in pages so dashboards stay accurate after the API's default row cap.
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseServer
      .from('member_devices')
      .select('user_id, platform, app_version, locale, push_enabled, expo_push_token, last_seen_at, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const page = (data || []) as DeviceRow[];
    devices.push(...page);
    if (page.length < pageSize) break;
  }

  const peopleActive7d = new Set<string>();
  const peopleActive30d = new Set<string>();
  const dailyInstalls = new Map<string, number>();
  const platforms = new Map<string, number>();
  const versions = new Map<string, number>();
  let activeDevices7d = 0;
  let activeDevices30d = 0;
  let installs7d = 0;
  let installs30d = 0;
  let pushEnabled = 0;
  let reachableDevices = 0;
  let englishDevices = 0;

  for (const device of devices) {
    const lastSeen = Date.parse(device.last_seen_at);
    const created = Date.parse(device.created_at);
    const platform = device.platform || 'unknown';
    const version = device.app_version?.trim() || 'Sem versão';

    platforms.set(platform, (platforms.get(platform) || 0) + 1);
    versions.set(version, (versions.get(version) || 0) + 1);
    if ((device.locale || '').toLowerCase().startsWith('en')) englishDevices += 1;
    if (device.push_enabled) pushEnabled += 1;
    if (device.push_enabled && isExpoPushToken(device.expo_push_token)) reachableDevices += 1;

    if (Number.isFinite(lastSeen) && lastSeen >= weekCutoff) {
      activeDevices7d += 1;
      peopleActive7d.add(device.user_id);
    }
    if (Number.isFinite(lastSeen) && lastSeen >= recentCutoff) {
      activeDevices30d += 1;
      peopleActive30d.add(device.user_id);
    }
    if (Number.isFinite(created) && created >= weekCutoff) installs7d += 1;
    if (Number.isFinite(created) && created >= recentCutoff) installs30d += 1;
    if (Number.isFinite(created) && created >= trendCutoff) {
      const day = new Date(created).toISOString().slice(0, 10);
      dailyInstalls.set(day, (dailyInstalls.get(day) || 0) + 1);
    }
  }

  const daysList = Array.from({ length: days }, (_, index) => {
    const day = new Date(trendCutoff + index * DAY_MS).toISOString().slice(0, 10);
    return { day, installs: dailyInstalls.get(day) || 0 };
  });

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    days,
    totals: {
      installations: devices.length,
      activeDevices7d,
      activeDevices30d,
      activePeople7d: peopleActive7d.size,
      activePeople30d: peopleActive30d.size,
      installs7d,
      installs30d,
      pushEnabled,
      reachableDevices,
      englishDevices,
    },
    platforms: [...platforms.entries()].map(([platform, count]) => ({ platform, count })),
    versions: [...versions.entries()]
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count || a.version.localeCompare(b.version))
      .slice(0, 8),
    dailyInstalls: daysList,
  });
}
