import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/60 ring-1 ring-primary/10">
        <Compass className="size-6" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          404
        </p>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Halaman yang kamu cari mungkin sudah dipindahkan atau alamatnya salah.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />}>
        Kembali ke Dashboard
      </Button>
    </div>
  );
}
