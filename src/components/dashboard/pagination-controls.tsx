import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationChevronLeft,
  PaginationChevronRight,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  basePath: string;
  searchParams: Record<string, string>;
  /** Noun for the count line, e.g. "transaksi", "hutang". Defaults to "data". */
  entityLabel?: string;
  /** Query param that carries the page number; defaults to "page". */
  pageParam?: string;
};

function createPageHref(
  basePath: string,
  searchParams: Record<string, string>,
  pageParam: string,
  page: number,
) {
  const params = new URLSearchParams(searchParams);

  if (page <= 1) {
    params.delete(pageParam);
  } else {
    params.set(pageParam, String(page));
  }

  const query = params.toString();

  return query ? `${basePath}?${query}` : basePath;
}

/** Numbered page window: 1 … (page-1) page (page+1) … last, no ellipsis when it fits. */
function getPageItems(
  page: number,
  totalPages: number,
): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(totalPages - 1, page + 1);

  if (windowStart > 2) {
    items.push("ellipsis-start");
  }
  for (let p = windowStart; p <= windowEnd; p += 1) {
    items.push(p);
  }
  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-end");
  }

  items.push(totalPages);
  return items;
}

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  basePath,
  searchParams,
  entityLabel = "data",
  pageParam = "page",
}: PaginationControlsProps) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-xs text-muted-foreground tabular-nums">
        Halaman {page} dari {totalPages} &middot; {totalCount} {entityLabel}
      </p>
      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={createPageHref(basePath, searchParams, pageParam, page - 1)}
              disabled={!hasPrev}
            >
              <PaginationChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </PaginationPrevious>
          </PaginationItem>

          {getPageItems(page, totalPages).map((item) => (
            <PaginationItem key={item}>
              {item === "ellipsis-start" || item === "ellipsis-end" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href={createPageHref(
                    basePath,
                    searchParams,
                    pageParam,
                    item,
                  )}
                  isActive={item === page}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href={createPageHref(basePath, searchParams, pageParam, page + 1)}
              disabled={!hasNext}
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <PaginationChevronRight className="size-3.5" />
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
