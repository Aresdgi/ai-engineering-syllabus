import { redirect } from "next/navigation";

import { projectsIndexHref } from "@/course/routes";

/**
 * Placeholder del Hito 3: el inicio redirige al catálogo de proyectos.
 * Todavía no existe un dashboard; no se inventa contenido.
 */
export default function Home() {
  redirect(projectsIndexHref());
}
