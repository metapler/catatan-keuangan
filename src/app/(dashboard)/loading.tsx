import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <section className="space-y-5">
      {/* PageHeader skeleton */}
      <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-6 w-64 rounded-lg sm:w-80" />
          <Skeleton className="h-4 w-72 rounded-lg sm:w-96" />
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60 bg-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-lg" />
                  <Skeleton className="h-3 w-32 rounded-full" />
                </div>
                <Skeleton className="size-9 shrink-0 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data table card skeleton */}
      <Card className="overflow-hidden border-border/60 bg-card">
        <div className="flex flex-col gap-2 px-4 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-lg" />
            <Skeleton className="h-3 w-56 rounded-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="space-y-3 px-4 pb-4">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    </section>
  );
}
