import { cn } from "@/lib/utils";

export type DocumentNavItem = {
  href: string;
  label: string;
  current: boolean;
  hint?: string;
};

export type DocumentNavProps = {
  label: string;
  items: readonly DocumentNavItem[];
};

/**
 * Separa una ruta literal en nombre de archivo y directorio relativo (D-13):
 * el basename se muestra en una línea y el directorio como línea secundaria
 * muted, sin cortar el nombre por la mitad. Para etiquetas sin `/` el nombre
 * es la etiqueta completa y no hay línea secundaria.
 */
function splitDocumentLabel(label: string): {
  name: string;
  directory: string | null;
} {
  const separator = label.lastIndexOf("/");
  if (separator <= 0 || separator === label.length - 1) {
    return { name: label, directory: null };
  }
  return {
    name: label.slice(separator + 1),
    directory: label.slice(0, separator),
  };
}

export function DocumentNav({ label, items }: DocumentNavProps) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold tracking-tight text-muted-foreground">
        {label}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const { name, directory } = splitDocumentLabel(item.label);
          const secondaryClass = cn(
            "mt-0.5 block break-words text-xs font-normal",
            item.current
              ? "text-secondary-foreground/70"
              : "text-muted-foreground",
          );
          return (
            <li key={item.href}>
              <a
                href={item.href}
                title={item.label}
                aria-current={item.current ? "true" : undefined}
                className={cn(
                  "block rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ease-out",
                  item.current
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover-fine:bg-muted/60 hover-fine:text-foreground",
                )}
              >
                {directory ? (
                  <>
                    <span className="sr-only">{item.label}</span>
                    <span aria-hidden="true" className="block break-words">
                      {name}
                    </span>
                    <span aria-hidden="true" className={secondaryClass}>
                      {directory}
                    </span>
                  </>
                ) : (
                  <span className="block break-words">{name}</span>
                )}
                {item.hint ? (
                  <span className={secondaryClass}>{item.hint}</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
