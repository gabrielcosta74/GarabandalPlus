#!/usr/bin/env bash

set -euo pipefail

TMP_AUDIT_JSON="$(mktemp)"
trap 'rm -f "$TMP_AUDIT_JSON"' EXIT

echo "==> Running npm audit (prod deps only)"
npm audit --omit=dev --json > "$TMP_AUDIT_JSON" || true

node - "$TMP_AUDIT_JSON" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const report = JSON.parse(fs.readFileSync(path, 'utf8'));

const v = report?.metadata?.vulnerabilities || {};
const critical = Number(v.critical || 0);
const high = Number(v.high || 0);
const moderate = Number(v.moderate || 0);
const low = Number(v.low || 0);

console.log('Vulnerability summary:', { critical, high, moderate, low });

if (critical > 0) {
  console.error('ERROR: Critical vulnerabilities detected.');
  process.exit(2);
}

if (high > 0) {
  console.error('ERROR: High vulnerabilities detected.');
  process.exit(3);
}

console.log('✅ No critical/high vulnerabilities in production dependencies.');
NODE
