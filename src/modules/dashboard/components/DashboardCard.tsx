import type { ReactNode } from 'react';

interface DashboardCardProps {
  title?: string;
  /** Optional tap handler — renders the card as a <button> when provided, a <div> otherwise. */
  onSelect?: () => void;
  children: ReactNode;
}

/**
 * Shared visual chrome for every Home Dashboard section (SRS 8.3): a
 * rounded, elevated card matching the design tokens already used by
 * WelcomeScreen/MoreScreen (rounded-card, --shadow-card, cream/surface
 * backgrounds). Kept local to the dashboard module since no other module
 * has adopted this exact card style yet.
 */
export function DashboardCard({ title, onSelect, children }: DashboardCardProps) {
  const classes =
    'w-full rounded-card border border-black/10 bg-surface-light p-4 text-left shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-surface-dark';

  const content = (
    <>
      {title ? (
        <h2 className="mb-2 text-app-base font-semibold text-text-primary">
          {title}
        </h2>
      ) : null}
      {children}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
