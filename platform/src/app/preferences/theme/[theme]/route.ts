import { safeNextPath } from "@/lib/i18n";
import { isUiTheme, UI_THEME_COOKIE, type UiTheme } from "@/lib/theme";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function themeCookie(theme: UiTheme): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${UI_THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * GET /preferences/theme/[theme]?next=<ruta>
 *
 * Fija la cookie global de tema (1 año, `path=/`, `SameSite=Lax`) y redirige
 * con 303 a `next` solo si es una ruta relativa interna. `next` externo,
 * protocol-relative o con esquema cae a `/projects`. Tema inválido → 404 sin
 * cookie.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ theme: string }> },
): Promise<Response> {
  const { theme } = await context.params;

  if (!isUiTheme(theme)) {
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
      "Set-Cookie": themeCookie(theme),
      "Cache-Control": "no-store",
    },
  });
}
