// Small line icons (16px, currentColor). No icon library.
import type { ReactElement } from "react";

const paths: Record<string, ReactElement> = {
  grid: <path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6.5 3.5v9" />,
  kanban: <path d="M2.5 3.5h3v9h-3zM6.5 3.5h3v6h-3zM10.5 3.5h3v4h-3z" />,
  calendar: <path d="M2.5 4h11v9h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3" />,
  dashboard: <path d="M2.5 13.5v-4M6.5 13.5v-7M10.5 13.5v-9M13.5 13.5h-11" />,
  table: <path d="M2.5 3h11v10h-11zM2.5 6h11M2.5 9.5h11" />,
  form: <path d="M3.5 2.5h9v11h-9zM5.5 5.5h5M5.5 8h5M5.5 10.5h3" />,
  system: <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />,
  search: <path d="M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 10l3.5 3.5" />,
  plus: <path d="M8 3v10M3 8h10" />,
  filter: <path d="M2.5 3.5h11l-4.2 5v4l-2.6 1v-5z" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
};

export function Icon({ name, className = "nav-icon" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.table}
    </svg>
  );
}
