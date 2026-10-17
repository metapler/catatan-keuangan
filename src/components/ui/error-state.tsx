import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description: string;
  className?: string;
};

export function ErrorState({
  title = "Terjadi kendala",
  description,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
        <TriangleAlert className="size-6" />
      </div>
      <h3 className="mt-5 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
