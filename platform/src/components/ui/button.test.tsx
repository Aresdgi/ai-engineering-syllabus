import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

const transitionAllUtility = ["transition", "all"].join("-");

afterEach(cleanup);

describe("Button", () => {
  it("D-15: transición acotada a color/transform durante 150ms", () => {
    render(<Button>Guardar</Button>);

    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button.className).not.toContain(transitionAllUtility);
    expect(button.className).toContain("duration-150");
    expect(button.className).toContain(
      "transition-[color,background-color,border-color,transform]",
    );
  });

  it("D-15: cada variante gatea su hover con puntero fino", () => {
    const variants = [
      "default",
      "outline",
      "secondary",
      "ghost",
      "destructive",
      "link",
    ] as const;

    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>Acción</Button>);
      const button = screen.getByRole("button", { name: "Acción" });
      expect(button.className).toContain("hover-fine:");
      expect(button.className).not.toMatch(/(^|\s)hover:/);
      unmount();
    }
  });
});
