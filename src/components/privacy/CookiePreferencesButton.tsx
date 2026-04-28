"use client";

import { Settings2 } from 'lucide-react';
import { openCookiePreferences } from '../../lib/cookie-consent';

export default function CookiePreferencesButton({
  children = 'Gerir preferências de cookies',
}: {
  children?: string;
}) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
    >
      <Settings2 className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}
