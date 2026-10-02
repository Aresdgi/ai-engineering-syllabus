import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentNav } from "@/components/document-nav";

afterEach(cleanup);

const items = [
  {
    href: "/destino/uno",
    label: "Documento uno",
    current: false,
    hint: "Pista uno",
  },
  { href: "/destino/dos", label: "Documento dos", current: true },
  { href: "/destino/tres", label: "Documento tres", current: false },
];

describe("DocumentNav", () => {
  it("marca con aria-current solo el documento actual", () => {
    render(<DocumentNav label="Documentos" items={items} />);

    expect(
      screen.getByRole("navigation", { name: "Documentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Documentos" }),
    ).toBeInTheDocument();

    const current = screen.getByRole("link", { name: "Documento dos" });
    expect(current).toHaveAttribute("aria-current", "true");

    for (const label of ["Documento uno", "Documento tres"]) {
      expect(
        screen.getByRole("link", { name: new RegExp(label) }),
      ).not.toHaveAttribute("aria-current");
    }
  });

  it("muestra las pistas cuando existen", () => {
    render(<DocumentNav label="Documentos" items={items} />);

    expect(screen.getByText("Pista uno")).toBeInTheDocument();
  });

  it("D-13: separa basename y directorio, con la ruta completa en title", () => {
    render(
      <DocumentNav
        label="Documentos"
        items={[
          {
            href: "/destino/gamma",
            label: "alpha/beta/gamma.md",
            current: true,
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: /gamma\.md/ });
    expect(link).toHaveAttribute("title", "alpha/beta/gamma.md");
    expect(screen.getByText("gamma.md")).toBeInTheDocument();
    expect(screen.getByText("alpha/beta")).toBeInTheDocument();
  });

  it("D-13: deja la etiqueta intacta cuando no hay directorio", () => {
    render(<DocumentNav label="Documentos" items={[items[0]]} />);

    const link = screen.getByRole("link", { name: /Documento uno/ });
    expect(link).toHaveAttribute("title", "Documento uno");
    expect(screen.getByText("Documento uno")).toBeInTheDocument();
  });
});
