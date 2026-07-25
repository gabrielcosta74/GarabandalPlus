import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs'; import path from 'node:path';
for (const line of fs.readFileSync(path.join(process.cwd(),'.env'),'utf8').split('\n')){
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m)continue; let v=m[2];
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  if(process.env[m[1]]===undefined)process.env[m[1]]=v;
}
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const t of ['wp_pages','posts']){
  const {data}=await sb.from(t).select('locale,status,source_url');
  const pt=data.filter(r=>r.locale==='pt');
  const withSrc=pt.filter(r=>r.source_url && r.source_url.includes('apostoladodegarabandal'));
  const otherSrc=pt.filter(r=>r.source_url && !r.source_url.includes('apostoladodegarabandal'));
  const noSrc=pt.filter(r=>!r.source_url);
  const byStatus=Object.entries(pt.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{})).map(([k,v])=>`${k}=${v}`).join(' ');
  console.log(`${t}: PT total=${pt.length} [${byStatus}] | src@apostolado=${withSrc.length} | other_src=${otherSrc.length} | no_src=${noSrc.length}`);
  if(otherSrc.length) console.log('   other domains:',[...new Set(otherSrc.map(r=>{try{return new URL(r.source_url).hostname}catch{return r.source_url}}))].slice(0,8));
}
