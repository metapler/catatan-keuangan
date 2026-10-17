import * as React from "react";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row flex-wrap items-center justify-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

const paginationLinkVariants = cva(
  "inline-flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-lg text-xs font-medium tabular-nums transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",
        outline:
          "border border-border/60 bg-background hover:bg-muted/50 hover:text-foreground",
      },
      size: {
        default: "px-2.5",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
    },
  },
);

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<VariantProps<typeof paginationLinkVariants>, "variant" | "size"> &
  React.ComponentProps<"a">;

function PaginationLink({
  className,
  isActive,
  variant = "ghost",
  size = "default",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        paginationLinkVariants({ variant, size }),
        isActive &&
          "pointer-events-none border-transparent bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  disabled,
  ...props
}: React.ComponentProps<"a"> & { disabled?: boolean }) {
  return (
    <a
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      data-slot="pagination-previous"
      className={cn(
        paginationLinkVariants({ variant: "outline" }),
        "gap-1 pl-2",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function PaginationNext({
  className,
  disabled,
  ...props
}: React.ComponentProps<"a"> & { disabled?: boolean }) {
  return (
    <a
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      data-slot="pagination-next"
      className={cn(
        paginationLinkVariants({ variant: "outline" }),
        "gap-1 pr-2",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      <MoreHorizontal className="size-3.5" />
      <span className="sr-only">Halaman lain</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  // Re-exported so callers can label prev/next with icons without importing lucide directly.
  ChevronLeft as PaginationChevronLeft,
  ChevronRight as PaginationChevronRight,
};
