import type * as React from "react";

const navigationItems = [
  "Inicio",
  "Catálogo",
  "Buscar",
  "Tutor",
  "Progreso",
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-base font-semibold tracking-tight">
            AI Engineering Study Platform
          </p>
          <nav aria-label="Principal">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {navigationItems.map((item) =>
                item === "Inicio" ? (
                  <li key={item}>
                    <span
                      aria-current="page"
                      className="font-medium text-foreground"
                    >
                      {item}
                    </span>
                  </li>
                ) : (
                  <li key={item}>
                    <span
                      aria-disabled="true"
                      className="cursor-not-allowed text-muted-foreground"
                    >
                      {item}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:py-14">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          Fuente: 4GeeksAcademy/ai-engineering-syllabus
        </div>
      </footer>
    </div>
  );
}
