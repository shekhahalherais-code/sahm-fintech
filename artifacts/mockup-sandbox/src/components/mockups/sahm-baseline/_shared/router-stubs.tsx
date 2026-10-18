import type { ComponentProps, ReactNode } from "react";

export function useLocation(): [string, (path: string) => void] {
  return ["/", () => undefined];
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return { reportId: "baseline-preview" } as unknown as T;
}

export function Link({
  href,
  to,
  children,
  ...props
}: ComponentProps<"a"> & { to?: string; children?: ReactNode }) {
  return (
    <a href={href ?? to ?? "#"} {...props}>
      {children}
    </a>
  );
}
