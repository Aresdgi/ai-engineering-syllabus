import type * as React from "react";

export type UnitListItem = {
  href: string;
  title: string;
  description?: React.ReactNode;
  marker?: string | null;
  order?: number | null;
  meta?: React.ReactNode;
};

export type UnitListSection = {
  heading: string | null;
  items: readonly UnitListItem[];
};

export type UnitListProps = {
  sections: readonly UnitListSection[];
  emptyLabel: string;
};

export function UnitList({ sections, emptyLabel }: UnitListProps) {
  const itemCount = sections.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  if (itemCount === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section, index) => (
        <section
          key={section.heading ?? `section-${index}`}
          className="flex flex-col gap-1.5"
        >
          {section.heading ? (
            <h2 className="text-sm font-semibold tracking-tight">
              {section.heading}
            </h2>
          ) : null}
          <ul className="divide-y divide-border border-y border-border">
            {section.items.map((item) => (
              <li key={item.href}>
                <div className="relative -mx-2 flex items-start gap-3 rounded-md px-2 py-3 transition-colors duration-150 ease-out hover-fine:bg-muted/60">
                  {typeof item.marker === "string" && item.marker.length > 0 ? (
                    <span className="w-8 shrink-0 text-right font-mono text-sm leading-6 tabular-nums text-muted-foreground">
                      {item.marker}
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <a
                        href={item.href}
                        className="rounded-sm text-sm leading-6 font-semibold text-foreground after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {item.title}
                      </a>
                      {item.meta ? (
                        <span className="font-mono text-xs text-muted-foreground max-sm:basis-full">
                          {item.meta}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <div className="relative mt-1 text-sm leading-relaxed text-muted-foreground [&_p]:my-0 [&_p]:text-sm [&_p]:text-muted-foreground">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
