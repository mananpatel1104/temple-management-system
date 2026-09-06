import type { SpiritualQuote } from '@modules/dashboard/types/dashboard.types';

interface SpiritualQuoteSectionProps {
  /** Supreme-Administrator-configured (FR-DASH-018). No configuration UI exists yet. */
  quote?: SpiritualQuote;
}

/**
 * Daily Spiritual Quote (SRS 8.13, FR-DASH-018): "If no quote has been
 * configured, this section shall remain hidden." Since no quote
 * configuration exists yet, this always returns null — implementing the
 * spec's own default exactly, not a placeholder.
 */
export function SpiritualQuoteSection({ quote }: SpiritualQuoteSectionProps) {
  if (!quote) return null;

  return (
    <figure className="px-2 text-center">
      <blockquote className="text-app-base italic text-text-primary">
        “{quote.text}”
      </blockquote>
      {quote.attribution ? (
        <figcaption className="mt-1 text-app-sm text-text-secondary">
          — {quote.attribution}
        </figcaption>
      ) : null}
    </figure>
  );
}
