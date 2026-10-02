import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { AppShell } from "@/components/app-shell";
import { EmptySourceState } from "@/components/empty-source-state";

function renderShell() {
  return render(
    <AppShell>
      <EmptySourceState />
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("muestra el estado de fuente vacío con el texto exacto", () => {
    renderShell();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "La plataforma mostrará el syllabus real del repositorio cuando se implemente la ingesta (Hito 1). Hasta entonces no se muestra contenido educativo.",
      ),
    ).toBeInTheDocument();
  });

  it("expone los landmarks principales", () => {
    renderShell();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("marca la navegación estructural sin enlaces reales", () => {
    renderShell();

    const nav = screen.getByRole("navigation", { name: "Principal" });

    expect(screen.getByText("Inicio")).toHaveAttribute("aria-current", "page");

    for (const item of ["Catálogo", "Buscar", "Tutor", "Progreso"]) {
      expect(screen.getByText(item)).toHaveAttribute("aria-disabled", "true");
    }

    expect(nav.querySelectorAll("a")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("usa utilidades Tailwind en el contenedor raíz", () => {
    const { container } = renderShell();
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root?.className).toContain("flex");
    expect(root?.className).toContain("min-h-dvh");
  });

  it("muestra la procedencia en el footer", () => {
    renderShell();

    expect(
      screen.getByText("Fuente: 4GeeksAcademy/ai-engineering-syllabus"),
    ).toBeInTheDocument();
  });
});
