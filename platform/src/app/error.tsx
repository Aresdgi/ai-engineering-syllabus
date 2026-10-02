"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { projectsIndexHref } from "@/course/routes";
import type { UiLanguage } from "@/lib/i18n";

type ErrorMessages = {
  title: string;
  description: string;
  retry: string;
  back: string;
};

const messages: Record<UiLanguage, ErrorMessages> = {
  es: {
    title: "No se pudo cargar el catálogo",
    description:
      "Hubo un problema al consultar el contenido importado. Puedes reintentar la carga.",
    retry: "Reintentar",
    back: "Volver a Proyectos",
  },
  en: {
    title: "Could not load the catalog",
    description:
      "There was a problem loading the imported content. You can retry the load.",
    retry: "Retry",
    back: "Back to Projects",
  },
};

const linkClass =
  "w-fit rounded-sm text-sm font-medium underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover-fine:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const subscribeToDocumentLanguage = () => () => {};

// `error.tsx` es cliente y no puede leer la cookie en servidor: el `<html>` del
// layout ya lleva el idioma global, así que se lee de ahí con
// `useSyncExternalStore` (sin desajuste de hidratación: el snapshot servidor es
// el idioma por defecto).
function readDocumentLanguage(): UiLanguage {
  return document.documentElement.lang === "en" ? "en" : "es";
}

function readServerLanguage(): UiLanguage {
  return "es";
}

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const lang = useSyncExternalStore(
    subscribeToDocumentLanguage,
    readDocumentLanguage,
    readServerLanguage,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = messages[lang];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {t.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => retry()}>
          {t.retry}
        </Button>
        <Link href={projectsIndexHref()} className={linkClass}>
          {t.back}
        </Link>
      </div>
    </div>
  );
}
