"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

type DashboardErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({
  error,
  reset,
}: DashboardErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Halaman belum berhasil dimuat"
        description="Kami menjaga area dashboard tetap jelas saat terjadi gangguan data atau koneksi."
      />

      <DataTableCard
        title="Terjadi kendala saat memuat halaman"
        description="Anda bisa mencoba memuat ulang data tanpa meninggalkan halaman saat ini."
        action={
          <Button type="button" className="rounded-xl" onClick={reset}>
            <RotateCcw className="size-4" />
            Coba lagi
          </Button>
        }
      >
        <ErrorState
          description={
            error.message || "Data tidak dapat dimuat. Silakan coba lagi."
          }
        />
      </DataTableCard>
    </section>
  );
}
