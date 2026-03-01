import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { isPaidStatus } from '../../../../lib/membership-status';

export const dynamic = 'force-dynamic';

type MemberRow = {
  id: string;
  nome: string | null;
  email: string | null;
  numero_socio: string | null;
  country: string | null;
  is_membro: boolean | null;
  estado_quota: string | null;
  data_adesao: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  referrals_count: number | null;
  store_credits: number | null;
};

const cleanCode = (value?: string | null) => {
  const code = (value || '').trim();
  return code.length > 0 ? code : null;
};

export async function GET(req: Request) {
  const { authorized, error } = await verifyAdmin(req);
  if (!authorized) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
  }

  try {
    const { data, error: queryError } = await supabaseServer
      .from('membros')
      .select('id, nome, email, numero_socio, country, is_membro, estado_quota, data_adesao, referral_code, referred_by_code, referrals_count, store_credits')
      .order('data_adesao', { ascending: false, nullsFirst: false });

    if (queryError) {
      throw queryError;
    }

    const members = (data || []) as MemberRow[];
    const membersByCode = new Map<string, MemberRow>();

    for (const member of members) {
      const code = cleanCode(member.referral_code);
      if (code) membersByCode.set(code, member);
    }

    const invitedRows = members
      .filter((member) => cleanCode(member.referred_by_code))
      .map((invitee) => {
        const usedCode = cleanCode(invitee.referred_by_code)!;
        const inviter = membersByCode.get(usedCode) || null;
        const paid = !!invitee.is_membro && isPaidStatus(invitee.estado_quota);

        return {
          invitee_id: invitee.id,
          invitee_name: invitee.nome,
          invitee_email: invitee.email,
          invitee_member_number: invitee.numero_socio,
          invitee_country: invitee.country,
          invitee_joined_at: invitee.data_adesao,
          invitee_quota_status: invitee.estado_quota,
          used_code: usedCode,
          paid,
          inviter_id: inviter?.id || null,
          inviter_name: inviter?.nome || null,
          inviter_email: inviter?.email || null,
          inviter_member_number: inviter?.numero_socio || null,
        };
      });

    const inviterAgg = new Map<
      string,
      {
        inviter_id: string;
        inviter_name: string | null;
        inviter_email: string | null;
        inviter_member_number: string | null;
        referral_code: string | null;
        registered_referrals_count: number;
        store_credits: number;
        actual_invites: number;
        paid_invites: number;
      }
    >();

    for (const row of invitedRows) {
      if (!row.inviter_id) continue;
      const inviter = members.find((m) => m.id === row.inviter_id);
      const existing = inviterAgg.get(row.inviter_id);
      if (existing) {
        existing.actual_invites += 1;
        if (row.paid) existing.paid_invites += 1;
      } else {
        inviterAgg.set(row.inviter_id, {
          inviter_id: row.inviter_id,
          inviter_name: row.inviter_name,
          inviter_email: row.inviter_email,
          inviter_member_number: row.inviter_member_number,
          referral_code: inviter?.referral_code || null,
          registered_referrals_count: Number(inviter?.referrals_count || 0),
          store_credits: Number(inviter?.store_credits || 0),
          actual_invites: 1,
          paid_invites: row.paid ? 1 : 0,
        });
      }
    }

    const topInviters = Array.from(inviterAgg.values())
      .map((inviter) => ({
        ...inviter,
        pending_invites: Math.max(0, inviter.actual_invites - inviter.paid_invites),
        count_gap: inviter.registered_referrals_count - inviter.actual_invites,
      }))
      .sort((a, b) => {
        if (b.actual_invites !== a.actual_invites) return b.actual_invites - a.actual_invites;
        if (b.paid_invites !== a.paid_invites) return b.paid_invites - a.paid_invites;
        return (a.inviter_name || '').localeCompare(b.inviter_name || '', 'pt-PT');
      });

    const invitedSorted = [...invitedRows].sort((a, b) => {
      const aDate = a.invitee_joined_at ? new Date(a.invitee_joined_at).getTime() : 0;
      const bDate = b.invitee_joined_at ? new Date(b.invitee_joined_at).getTime() : 0;
      return bDate - aDate;
    });

    const stats = {
      total_members: members.length,
      members_with_referral_code: members.filter((m) => cleanCode(m.referral_code)).length,
      invited_members_total: invitedRows.length,
      invited_members_paid: invitedRows.filter((r) => r.paid).length,
      invited_members_pending: invitedRows.filter((r) => !r.paid).length,
      invited_members_with_known_inviter: invitedRows.filter((r) => !!r.inviter_id).length,
      invited_members_without_known_inviter: invitedRows.filter((r) => !r.inviter_id).length,
      inviters_with_at_least_one_invite: topInviters.length,
    };

    return NextResponse.json({
      stats,
      topInviters,
      invitedMembers: invitedSorted.slice(0, 250),
    });
  } catch (err) {
    console.error('Admin referrals API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
