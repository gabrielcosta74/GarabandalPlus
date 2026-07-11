import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { lookupRedirect } from "./lib/redirects-edge"

const CANONICAL_HOST = 'apostoladodegarabandal.com';

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    // `nextUrl.pathname` may already be normalized by Next.js. Keep the raw
    // browser pathname so legacy trailing slashes can be collapsed together
    // with a host redirect instead of producing a second hop.
    const rawPathname = new URL(request.url).pathname;

    // 0. Canonical host. The legacy `app.` subdomain (and `www.`) are duplicate
    //    copies of the whole site that were splitting brand authority in Google
    //    and polluting the sitelinks. Permanently redirect every non-canonical
    //    host to the apex domain, preserving the full path + query.
    const host = (request.headers.get('host') || '').toLowerCase();
    if (host && host !== CANONICAL_HOST && host.endsWith('apostoladodegarabandal.com')) {
      const url = new URL(request.url);
      url.host = CANONICAL_HOST;
      url.protocol = 'https:';
      url.port = '';
      // Legacy Webnode URLs commonly ended in a slash. Normalize the path in
      // this same redirect so Google reaches the canonical URL in one hop
      // instead of host redirect -> trailing-slash redirect -> final page.
      if (rawPathname.length > 1 && rawPathname.endsWith('/')) {
        url.pathname = rawPathname.slice(0, -1);
      }
      return NextResponse.redirect(url, 301);
    }

    // Next.js' built-in trailing-slash redirect runs before middleware. We
    // disable that default in next.config.js and normalize here so a legacy
    // `www` URL with a trailing slash is consolidated in the host redirect
    // above, while canonical-host URLs still get one permanent redirect.
    if (
      rawPathname.length > 1 &&
      rawPathname.endsWith('/') &&
      !rawPathname.startsWith('/.well-known') &&
      !rawPathname.includes('.')
    ) {
      const url = new URL(request.url);
      url.pathname = rawPathname.slice(0, -1);
      return NextResponse.redirect(url, 301);
    }

    // 1. Public 301s from the migration. Run BEFORE auth so the smallest
    //    possible amount of work happens for redirected URLs (which are mostly
    //    crawlers and old backlinks). Internal admin/api paths skip this.
    if (
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/auth') &&
      !pathname.includes('.')
    ) {
      try {
        const hit = await lookupRedirect(pathname);
        if (hit) {
          const url = request.nextUrl.clone();
          url.pathname = hit.destination_path;
          return NextResponse.redirect(url, hit.status_code);
        }
      } catch {
        // fail open — never block a request if the redirect lookup misbehaves
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pathname', pathname);
    let response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return response;
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: any) {
                    const persistentOptions = { ...options, maxAge: 31536000 };
                    request.cookies.set({
                        name,
                        value,
                        ...persistentOptions,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: requestHeaders,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...persistentOptions,
                    })
                },
                remove(name: string, options: any) {
                    request.cookies.set({
                        name,
                        value: "",
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: requestHeaders,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: "",
                        ...options,
                    })
                },
            },
        }
    )

    // This will refresh the session if expired and set the cookies correctly
    await supabase.auth.getUser()

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|images|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
