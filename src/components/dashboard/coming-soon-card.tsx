import { ArrowUpRight, Construction } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { SectionTitle } from "@/components/layout/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ComingSoonCardProps = {
  title: string;
  description: string;
};

export function ComingSoonCard({
  title,
  description,
}: ComingSoonCardProps) {
  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Module"
        title={title}
        description={description}
      />

      <Card className="rounded-[2rem] border-emerald-100 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Construction className="size-5" />
            </div>
            <ArrowUpRight className="size-5 text-slate-300" />
          </div>
          <div>
            <CardTitle className="text-xl tracking-tight text-slate-950">
              Fondasi modul sudah siap
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Halaman ini sekarang sudah mengikuti pola layout, breadcrumb, dan design
              system yang sama dengan route dashboard lainnya.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <SectionTitle
            title="Empty state"
            description="Komponen standar ini bisa dipakai ulang saat data belum ada."
          />
          <EmptyState
            title={`${title} masih kosong`}
            description="Struktur route sudah siap, jadi implementasi CRUD, table, loading, dan error state bisa dilanjutkan langsung di task modul terkait."
          />
        </CardContent>
      </Card>
    </section>
  );
}
