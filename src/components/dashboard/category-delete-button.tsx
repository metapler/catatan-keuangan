"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteCategoryAction } from "@/app/(dashboard)/categories/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type CategoryDeleteButtonProps = {
  categoryId: string;
  disabled?: boolean;
};

export function CategoryDeleteButton({
  categoryId,
  disabled = false,
}: CategoryDeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = () => {
    setPending(true);

    startTransition(async () => {
      try {
        await deleteCategoryAction(categoryId);
        router.refresh();
      } finally {
        setPending(false);
      }
    });
  };

  if (disabled) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-[11px]">
        <Trash2 className="size-3.5" />
        Dipakai transaksi
      </Button>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" disabled={pending} className="text-[11px]">
          <Trash2 className="size-3.5" />
          {pending ? "Menghapus..." : "Hapus"}
        </Button>
      }
      title="Hapus kategori?"
      description="Kategori yang dihapus tidak bisa dikembalikan. Pastikan kategori ini belum dipakai transaksi."
      confirmLabel="Hapus kategori"
      onConfirm={handleDelete}
    />
  );
}
