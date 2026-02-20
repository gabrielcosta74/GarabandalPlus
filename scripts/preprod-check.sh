#!/usr/bin/env bash

set -euo pipefail

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
UNSUPPORTED_NODE=0
if [ "$NODE_MAJOR" -lt 20 ] || [ "$NODE_MAJOR" -ge 23 ]; then
  UNSUPPORTED_NODE=1
fi

echo "==> [1/5] Node version check"
node -e '
  const major = Number(process.versions.node.split(".")[0]);
  const allowUnsupported = process.env.ALLOW_UNSUPPORTED_NODE === "1";
  if (major < 20 || major >= 23) {
    if (!allowUnsupported) {
      console.error("ERROR: Node version must be >=20 and <23. Current:", process.version);
      console.error("Set ALLOW_UNSUPPORTED_NODE=1 only for local diagnostics.");
      process.exit(1);
    }
    console.warn("WARN: Running with unsupported Node version for local diagnostics:", process.version);
  }
  console.log("OK:", process.version);
'

echo "==> [2/5] TypeScript check"
echo "Generating Next.js route/page types..."
npx next typegen
npx tsc --noEmit

echo "==> [3/5] Lint check"
if [ "${SKIP_LINT:-0}" = "1" ]; then
  echo "SKIP: lint check disabled by SKIP_LINT=1"
elif [ "$UNSUPPORTED_NODE" -eq 1 ] && [ "${ALLOW_UNSUPPORTED_NODE:-0}" = "1" ]; then
  echo "SKIP: lint check skipped because Node is unsupported in local diagnostic mode"
else
  npm run lint
fi

echo "==> [4/5] Production build check"
if [ "$UNSUPPORTED_NODE" -eq 1 ] && [ "${ALLOW_UNSUPPORTED_NODE:-0}" = "1" ]; then
  echo "SKIP: build lint phase disabled for unsupported local Node"
  npm run build -- --no-lint
else
  npm run build
fi

echo "==> [5/5] Critical endpoint hardening checks"
node - <<'NODE'
const fs = require('fs');

const checks = [
  {
    file: 'src/app/api/test-reduniq/route.ts',
    mustContain: "process.env.NODE_ENV === 'production'"
  },
  {
    file: 'src/app/api/test/diploma/route.ts',
    mustContain: "process.env.NODE_ENV === 'production'"
  },
  {
    file: 'src/app/api/auth/check-email-exists/route.ts',
    mustContain: 'disabled: true'
  },
  {
    file: 'src/app/api/booking/check-duplicate/route.ts',
    mustContain: 'Do not expose booking identifiers'
  }
];

for (const check of checks) {
  const content = fs.readFileSync(check.file, 'utf8');
  if (!content.includes(check.mustContain)) {
    console.error(`ERROR: ${check.file} does not contain required marker: ${check.mustContain}`);
    process.exit(1);
  }
}

console.log('OK: endpoint hardening markers found');
NODE

echo "✅ Pre-production checks passed."
