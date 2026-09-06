interface ComingSoonProps {
  title: string;
  message: string;
}

/**
 * Generic "module not yet implemented" placeholder used by the Bottom
 * Navigation Bar destinations (SRS 24.8) whose real feature module
 * (SRS Chapters 8–19: Dashboard, Announcements, Gallery, Library, Settings)
 * has not been built yet.
 *
 * Intentionally content-free — no devotional text, lyrics, or feature
 * behaviour belongs here. This exists purely so the navigation structure
 * has somewhere valid to route to while each module is implemented in its
 * own task.
 */
export function ComingSoon({ title, message }: ComingSoonProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <h1 className="text-app-xl font-bold text-saffron">{title}</h1>
      <p className="max-w-xs text-app-base text-text-secondary">{message}</p>
    </section>
  );
}
