import "server-only";

import { cookies } from "next/headers";

import { parseUiLanguage, UI_LANGUAGE_COOKIE, type UiLanguage } from "./index";

/**
 * Idioma de interfaz del usuario, leído de la cookie `lang`. Solo servidor:
 * usar `cookies()` marca la ruta como dinámica a propósito (la decisión de
 * idioma es por usuario). Valor ausente o inválido → `"es"`.
 */
export async function getUiLanguage(): Promise<UiLanguage> {
  const cookieStore = await cookies();
  return parseUiLanguage(cookieStore.get(UI_LANGUAGE_COOKIE)?.value);
}
