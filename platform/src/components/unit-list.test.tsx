import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UnitList } from "@/components/unit-list";

afterEach(cleanup);

describe("UnitList", () => {
  it("respeta el orden recibido de items y secciones", () => {
    render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: "Sección beta",
            items: [
              { href: "/destino/tres", title: "Tercero", marker: "3" },
              { href: "/destino/uno", title: "Primero", marker: "1" },
            ],
          },
          {
            heading: null,
            items: [{ href: "/destino/dos", title: "Segundo" }],
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sección beta" }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Tercero",
      "Primero",
      "Segundo",
    ]);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Sin contenido")).not.toBeInTheDocument();
  });

  it("muestra emptyLabel y ningún enlace cuando no hay items", () => {
    render(<UnitList emptyLabel="Sin contenido" sections={[]} />);

    expect(screen.getByText("Sin contenido")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("muestra emptyLabel cuando todas las secciones están vacías", () => {
    render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[{ heading: "Sección vacía", items: [] }]}
      />,
    );

    expect(screen.getByText("Sin contenido")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renderiza descripción y meta opcionales", () => {
    render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [
              {
                href: "/destino/alpha",
                title: "Alpha",
                description: "Descripción de ejemplo",
                meta: "slug-alpha",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Descripción de ejemplo")).toBeInTheDocument();
    const meta = screen.getByText("slug-alpha");
    expect(meta).toBeInTheDocument();
    expect(meta.className).toContain("font-mono");
    expect(meta.className).toContain("text-xs");
  });

  it("el enlace de la fila solo envuelve el título y no anida otros enlaces", () => {
    const { container } = render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [
              {
                href: "/destino/alpha",
                title: "Alpha",
                description: (
                  <>
                    Texto con{" "}
                    <a href="/destino/beta" className="font-medium">
                      enlace interno
                    </a>
                  </>
                ),
              },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelectorAll("a a")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "/destino/alpha",
    );
    expect(
      screen.getByRole("link", { name: "enlace interno" }),
    ).toHaveAttribute("href", "/destino/beta");
    expect(
      screen.getByRole("link", { name: "Alpha" }).textContent,
    ).not.toContain("enlace interno");
  });

  it("D-11: la fila ofrece una sola señal de hover basada en fondo", () => {
    const { container } = render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [{ href: "/destino/alpha", title: "Alpha" }],
          },
        ]}
      />,
    );

    const row = container.querySelector("li > div");
    expect(row?.className).toContain("hover-fine:bg-muted/60");
    const link = screen.getByRole("link", { name: "Alpha" });
    expect(link.className).not.toContain("hover-fine:underline");
  });

  it("D-11: el enlace del título se estira sobre la fila sin anidar enlaces", () => {
    const { container } = render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [
              {
                href: "/destino/alpha",
                title: "Alpha",
                description: (
                  <p>
                    Descripción con <a href="/destino/beta">enlace interno</a>
                  </p>
                ),
              },
            ],
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: "Alpha" });
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    expect(container.querySelectorAll("a a")).toHaveLength(0);
    const description = screen.getByText(/Descripción con/).closest("div");
    expect(description?.className).toContain("relative");
  });

  it("D-14: el marcador comparte línea base con el título y usa números tabulares", () => {
    render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [{ href: "/destino/alpha", title: "Alpha", marker: "0" }],
          },
        ]}
      />,
    );

    const marker = screen.getByText("0");
    const link = screen.getByRole("link", { name: "Alpha" });
    expect(marker.className).toContain("text-sm");
    expect(marker.className).toContain("leading-6");
    expect(marker.className).toContain("tabular-nums");
    expect(link.className).toContain("leading-6");
  });

  it("D-14: el campo order ya no se muestra en la fila", () => {
    render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [
              {
                href: "/destino/alpha",
                title: "Alpha",
                marker: "0",
                order: 3,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("D-03: el título pesa más que la descripción subordinada", () => {
    render(
      <UnitList
        emptyLabel="Sin contenido"
        sections={[
          {
            heading: null,
            items: [
              {
                href: "/destino/alpha",
                title: "Alpha",
                description: "Descripción de ejemplo",
              },
            ],
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: "Alpha" });
    expect(link.className).toContain("font-semibold");
    const description = screen.getByText("Descripción de ejemplo");
    expect(description.className).toContain("text-sm");
    expect(description.className).toContain("text-muted-foreground");
    expect(description.className).toContain("[&_p]:text-sm");
  });
});
