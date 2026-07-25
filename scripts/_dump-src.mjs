import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs'; import path from 'node:path';
for (const line of fs.readFileSync(path.join(process.cwd(),'.env'),'utf8').split('\n')){
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m)continue; let v=m[2];
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  if(process.env[m[1]]===undefined)process.env[m[1]]=v;
}
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const norm=(u)=>{try{return new URL(u).pathname.replace(/^\/(en|es)\//,'/').replace(/\/+$/,'')||'/'}catch{return u}};
const out=[];
for(const t of ['wp_pages','posts']){
  const {data}=await sb.from(t).select('slug,locale,source_url').eq('locale','pt');
  for(const r of data) out.push(norm(r.source_url||('/'+r.slug)));
}
fs.writeFileSync('/tmp/db_paths.txt', out.sort().join('\n')+'\n');
console.log('db PT paths:', out.length);
