import Link from "next/link";

import { projectsIndexHref } from "@/course/routes";
import type { UiLanguage } from "@/lib/i18n";
import { getUiLanguage } from "@/lib/i18n/server";

type NotFoundMessages = {
  title: string;
  description: string;
  back: string;
};

const messages: Record<UiLanguage, NotFoundMessages> = {
  es: {
    title: "Página no encontrada",
    description:
      "La dirección solicitada no corresponde a ninguna página del catálogo importado desde el repositorio fuente.",
    back: "Volver a Proyectos",
  },
  en: {
    title: "Page not found",
    description:
      "The requested address does not match any page in the catalog imported from the source repository.",
    back: "Back to Projects",
  },
};

const linkClass =
  "w-fit rounded-sm text-sm font-medium underline decoration-muted-foreground underline-offset-4 transition-colors duration-150 ease-out hover-fine:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default async function NotFound() {
  const lang = await getUiLanguage();
  const t = messages[lang];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {t.description}
        </p>
      </div>
      <Link href={projectsIndexHref()} className={linkClass}>
        {t.back}
      </Link>
    </div>
  );
}
