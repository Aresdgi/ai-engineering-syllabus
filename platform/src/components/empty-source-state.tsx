import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UiLanguage } from "@/lib/i18n";

type EmptySourceMessages = {
  title: string;
  description: string;
  action: string;
};

const messages: Record<UiLanguage, EmptySourceMessages> = {
  es: {
    title: "Contenido todavía no sincronizado",
    description:
      "La plataforma mostrará aquí el contenido del repositorio fuente cuando haya un snapshot activo. Todavía no hay nada que mostrar.",
    action: "Sincronizar (próximamente)",
  },
  en: {
    title: "Content not synced yet",
    description:
      "The platform will show content from the source repository here once there is an active snapshot. There is nothing to display yet.",
    action: "Sync (coming soon)",
  },
};

export type EmptySourceStateProps = {
  /** Idioma de interfaz (cookie global); por defecto `"es"`. */
  lang?: UiLanguage;
};

export function EmptySourceState({ lang = "es" }: EmptySourceStateProps) {
  const t = messages[lang];

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1>{t.title}</h1>
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled>{t.action}</Button>
      </CardContent>
    </Card>
  );
}
