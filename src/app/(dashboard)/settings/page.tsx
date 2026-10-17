import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/app/(dashboard)/settings/settings-form";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default function SettingsPage() {
  return (
    <section className="space-y-1">
      <PageHeader
        title="Pengaturan"
        description="Kelola ekspor data dan tindakan destruktif pada akunmu."
      />
      <SettingsForm />
    </section>
  );
}
