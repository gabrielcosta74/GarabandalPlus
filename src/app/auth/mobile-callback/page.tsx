'use client';

import { useEffect, useState } from 'react';

const MOBILE_APP_LOGIN_REDIRECT = 'garabandalmembros://login';

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isAllowedReturnUrl(value: string) {
  if (value === MOBILE_APP_LOGIN_REDIRECT) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'exp:' &&
      (url.hostname === 'localhost' || isPrivateIpv4(url.hostname)) &&
      url.pathname.endsWith('/--/login')
    );
  } catch {
    return false;
  }
}

export default function MobileAuthCallbackPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const returnTo = currentUrl.searchParams.get('return_to');

    if (!returnTo || !isAllowedReturnUrl(returnTo)) {
      setError('Não foi possível abrir a aplicação com segurança.');
      return;
    }

    const forwardedQuery = new URLSearchParams();
    ['code', 'error', 'error_code', 'error_description', 'type'].forEach((key) => {
      const value = currentUrl.searchParams.get(key);
      if (value) forwardedQuery.set(key, value);
    });

    const query = forwardedQuery.toString();
    const destination = `${returnTo}${query ? `?${query}` : ''}${currentUrl.hash}`;
    window.location.replace(destination);
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F2F2F7] px-8 text-center text-[#111111]">
      <div className="flex max-w-sm flex-col items-center gap-5">
        {error ? (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
              !
            </div>
            <p className="text-base font-medium">{error}</p>
          </>
        ) : (
          <>
            <div
              aria-label="A abrir"
              className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#D1D1D6] border-t-[#007AFF]"
            />
            <p className="text-base font-medium">A abrir Garabandal Membros…</p>
          </>
        )}
      </div>
    </main>
  );
}
