import { NextResponse } from 'next/server';
import { buildMarketingContacts, buildMarketingOverview } from '../../../../../lib/marketing-data';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const contacts = await buildMarketingContacts(auth.supabase);
    const overview = buildMarketingOverview(contacts);

    const [{ data: campaigns }, { data: funnels }, { data: tasks }, { data: failedMessages }] = await Promise.all([
      auth.supabase.from('marketing_campaigns').select('id,name,status,segment_slug,scheduled_at,metrics,created_at').order('created_at', { ascending: false }).limit(8),
      auth.supabase.from('marketing_funnels').select('id,name,slug,status,segment_slug,trigger_type,steps,metrics').order('created_at', { ascending: false }),
      auth.supabase.from('marketing_tasks').select('id,title,priority,status,due_at,source,created_at,contact:marketing_contacts(display_name,normalized_email)').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(10),
      auth.supabase.from('marketing_message_logs').select('id,to_email,subject,status,error_message,created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(10),
    ]);

    return NextResponse.json({
      ...overview,
      campaigns: campaigns || [],
      funnels: funnels || [],
      tasks: tasks || [],
      failedMessages: failedMessages || [],
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar marketing.');
  }
}
