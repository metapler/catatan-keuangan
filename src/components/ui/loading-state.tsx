import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  title?: string;
  description?: string;
};

export function LoadingState({
  title = "Memuat data",
  description = "Tunggu sebentar, kami sedang menyiapkan tampilan Anda.",
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/60 ring-1 ring-primary/10">
        <LoaderCircle className="size-6 animate-spin" />
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
