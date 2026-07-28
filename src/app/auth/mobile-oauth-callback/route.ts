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

export async function GET(request: Request) {
  const currentUrl = new URL(request.url);
  const returnTo = currentUrl.searchParams.get('return_to');

  if (!returnTo || !isAllowedReturnUrl(returnTo)) {
    return Response.json({ error: 'Invalid mobile return URL.' }, { status: 400 });
  }

  const destination = new URL(returnTo);
  ['code', 'error', 'error_code', 'error_description', 'type'].forEach((key) => {
    const value = currentUrl.searchParams.get(key);
    if (value) destination.searchParams.set(key, value);
  });

  return new Response(null, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
      Location: destination.toString(),
    },
  });
}
