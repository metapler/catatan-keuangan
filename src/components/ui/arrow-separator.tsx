import { ArrowRight } from "lucide-react";

/** Decorative arrow between two labels, e.g. source account → destination account. */
export function ArrowSeparator() {
  return (
    <span aria-hidden="true" className="mx-1 inline-flex shrink-0 items-center">
      <ArrowRight className="size-3 text-muted-foreground/70" />
    </span>
  );
}
