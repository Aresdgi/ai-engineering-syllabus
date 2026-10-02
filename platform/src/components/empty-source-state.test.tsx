import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptySourceState } from "@/components/empty-source-state";
import { SourceUnavailableState } from "@/components/source-unavailable-state";

afterEach(cleanup);

describe("estado vacío del catálogo", () => {
  it("por defecto usa los copys neutros en español", () => {
    render(<EmptySourceState />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Contenido todavía no sincronizado",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/La plataforma mostrará aquí/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sincronizar (próximamente)" }),
    ).toBeDisabled();
  });

  it("en inglés cambia todos los copys", () => {
    render(<EmptySourceState lang="en" />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Content not synced yet",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The platform will show content/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sync (coming soon)" }),
    ).toBeDisabled();
  });

  it("SourceUnavailableState propaga el idioma", () => {
    render(<SourceUnavailableState lang="en" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Content not synced yet" }),
    ).toBeInTheDocument();
  });
});
