import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "AI Engineering Study Platform",
  description:
    "Plataforma de estudio para el repositorio ai-engineering-syllabus. La interfaz permanece vacía hasta que se implemente la ingesta del contenido fuente.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="antialiased">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
