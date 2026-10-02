import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmptySourceState() {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1>Contenido todavía no sincronizado</h1>
        </CardTitle>
        <CardDescription>
          {
            "La plataforma mostrará el syllabus real del repositorio cuando se implemente la ingesta (Hito 1). Hasta entonces no se muestra contenido educativo."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled>Sincronizar (próximamente)</Button>
      </CardContent>
    </Card>
  );
}
