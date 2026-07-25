import { readFileSync, writeFileSync } from 'node:fs';

// token (unsafe boolean prefix check) -> segment-correct form, applied per file.
const A = ["pathname?.startsWith('/en')", "(pathname === '/en' || pathname?.startsWith('/en/'))"];
const B = ["window.location.pathname.startsWith('/en')", "(window.location.pathname === '/en' || window.location.pathname.startsWith('/en/'))"];
const C = ["next.startsWith('/en')", "(next === '/en' || next.startsWith('/en/'))"];
const D = ["pathname.startsWith('/en')", "(pathname === '/en' || pathname.startsWith('/en/'))"];

const jobs = [
  ['src/app/auth/update-password/page.tsx', [A]],
  ['src/app/member/profile/page.tsx', [A]],
  ['src/app/peregrinacoes/[slug]/page.tsx', [B]],
  ['src/app/reset-password/page.tsx', [B]],
  ['src/app/login/page.tsx', [A]],
  ['src/components/member/VIPLayout.tsx', [A]],
  ['src/components/member/MemberShell.tsx', [A]],
  ['src/components/dashboard/DashboardShell.tsx', [A]],
  ['src/components/account/AccountShell.tsx', [A]],
  ['src/components/membership/QuotaWarning.tsx', [A]],
  ['src/lib/login-routing.ts', [C]],
  ['src/lib/member-activity.ts', [D]],
];

for (const [file, reps] of jobs) {
  let src = readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of reps) {
    const count = src.split(from).length - 1;
    if (count === 0) { console.log(`!! ${file}: token NÃO encontrado`); continue; }
    src = src.split(from).join(to);
    n += count;
  }
  writeFileSync(file, src);
  console.log(`ok ${file} (${n} subst.)`);
}
