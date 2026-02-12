import { GET as membershipRulesGet } from '../membership-rules/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return membershipRulesGet(request);
}
