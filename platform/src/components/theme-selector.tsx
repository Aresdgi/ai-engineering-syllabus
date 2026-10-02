"use client";

import { usePathname, useSearchParams } from "next/navigation";

import type { UiLanguage } from "@/lib/i18n";
import { nextUiTheme, themePreferenceHref, type UiTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type ThemeSelectorProps = {
  /** Tema activo (cookie global); por defecto `"system"`. */
  theme?: UiTheme;
  /** Idioma de interfaz para el texto accesible; por defecto `"es"`. */
  lang?: UiLanguage;
  className?: string;
};

type ThemeMessages = {
  group: string;
  names: Record<UiTheme, string>;
  action: (current: string, next: string) => string;
};

const messages: Record<UiLanguage, ThemeMessages> = {
  es: {
    group: "Tema",
    names: { light: "Claro", dark: "Oscuro", system: "Sistema" },
    action: (current, next) => `Tema actual: ${current}. Cambiar a ${next}`,
  },
  en: {
    group: "Theme",
    names: { light: "Light", dark: "Dark", system: "System" },
    action: (current, next) => `Current theme: ${current}. Switch to ${next}`,
  },
};

function ThemeIcon({ theme }: { theme: UiTheme }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function ThemeSelector({
  theme = "system",
  lang = "es",
  className,
}: ThemeSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = new URLSearchParams(searchParams?.toString() ?? "");
  query.delete("lang");
  const search = query.toString();
  const next = search.length > 0 ? `${pathname}?${search}` : pathname;

  const t = messages[lang];
  const upcoming = nextUiTheme(theme);
  const label = t.action(t.names[theme], t.names[upcoming]);

  return (
    <nav aria-label={t.group} className={cn("shrink-0", className)}>
      <a
        href={themePreferenceHref(upcoming, next)}
        data-theme={theme}
        aria-label={label}
        title={label}
        className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors duration-150 ease-out hover-fine:bg-muted/60 hover-fine:text-foreground"
      >
        <ThemeIcon theme={theme} />
      </a>
    </nav>
  );
}
