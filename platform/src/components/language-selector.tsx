"use client";

import { usePathname, useSearchParams } from "next/navigation";

import type { LanguageVariant } from "@/course/types";
import { languagePreferenceHref, type UiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type LanguageSelectorProps = {
  /** Idioma de interfaz activo; por defecto `"es"`. */
  lang?: UiLanguage;
  className?: string;
  /**
   * API por página de la ola anterior (variantes del documento). Se mantiene
   * aceptada por compatibilidad de tipos, pero esta versión es el selector
   * global: la elige el shell y solo cambia la preferencia de idioma.
   */
  variants?: readonly LanguageVariant[];
  currentPath?: string;
  buildHref?: (variant: LanguageVariant) => string;
};

const groupLabels: Record<UiLanguage, string> = {
  es: "Idioma",
  en: "Language",
};

const optionLabels: Record<UiLanguage, string> = {
  es: "Español",
  en: "English",
};

export function LanguageSelector({
  lang = "es",
  className,
}: LanguageSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = new URLSearchParams(searchParams?.toString() ?? "");
  query.delete("lang");
  const search = query.toString();
  const next = search.length > 0 ? `${pathname}?${search}` : pathname;

  return (
    <nav aria-label={groupLabels[lang]} className={cn("shrink-0", className)}>
      <ul className="flex items-center rounded-md border border-border p-0.5">
        {(["es", "en"] as const).map((option) => {
          const isActive = option === lang;
          return (
            <li key={option}>
              <a
                href={languagePreferenceHref(option, next)}
                lang={option}
                hrefLang={option}
                aria-label={optionLabels[option]}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-block rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors duration-150 ease-out",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover-fine:bg-muted/60 hover-fine:text-foreground",
                )}
              >
                {option.toUpperCase()}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
