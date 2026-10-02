import {
  isUiLanguage,
  safeNextPath,
  UI_LANGUAGE_COOKIE,
  type UiLanguage,
} from "@/lib/i18n";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function languageCookie(lang: UiLanguage): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${UI_LANGUAGE_COOKIE}=${lang}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * GET /preferences/language/[lang]?next=<ruta>
 *
 * Fija la cookie global de idioma (1 año, `path=/`, `SameSite=Lax`) y redirige
 * con 303 a `next` solo si es una ruta relativa interna. `next` externo,
 * protocol-relative o con esquema cae a `/projects`. Idioma inválido → 404 sin
 * cookie: no se inventa un idioma que no exista.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ lang: string }> },
): Promise<Response> {
  const { lang } = await context.params;

  if (!isUiLanguage(lang)) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const next = safeNextPath(new URL(request.url).searchParams.get("next"));

  return new Response(null, {
    status: 303,
    headers: {
      Location: next,
      "Set-Cookie": languageCookie(lang),
      "Cache-Control": "no-store",
    },
  });
}
