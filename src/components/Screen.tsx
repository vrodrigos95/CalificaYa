import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface Props {
  title: string;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Screen({ title, back, actions, children, footer }: Props) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-blue-700 px-3 py-3 text-white shadow">
        {back && (
          <Link to={back} className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-blue-600" aria-label="Regresar">
            ←
          </Link>
        )}
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        {actions}
      </header>
      <main className="flex-1 p-4">{children}</main>
      {footer && <footer className="sticky bottom-0 border-t border-slate-200 bg-white p-3">{footer}</footer>}
    </div>
  );
}

export const btn = {
  primary: 'rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm active:bg-blue-800 disabled:opacity-40',
  secondary: 'rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 active:bg-slate-100',
  danger: 'rounded-xl border border-red-300 bg-white px-4 py-3 font-medium text-red-700 active:bg-red-50',
  small: 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-100',
};
