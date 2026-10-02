import "server-only";

import { cookies } from "next/headers";

import { parseUiTheme, UI_THEME_COOKIE, type UiTheme } from "./index";

/**
 * Tema de interfaz del usuario, leído de la cookie `theme`. Solo servidor: el
 * layout lo aplica como clase en `<html>` para que el SSR no parpadee. Valor
 * ausente o inválido → `"system"`.
 */
export async function getUiTheme(): Promise<UiTheme> {
  const cookieStore = await cookies();
  return parseUiTheme(cookieStore.get(UI_THEME_COOKIE)?.value);
}
