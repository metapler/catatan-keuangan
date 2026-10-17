"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteAccountAction } from "@/app/(dashboard)/accounts/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type AccountDeleteButtonProps = {
  accountId: string;
  disabled?: boolean;
};

export function AccountDeleteButton({
  accountId,
  disabled = false,
}: AccountDeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = () => {
    setPending(true);

    startTransition(async () => {
      try {
        await deleteAccountAction(accountId);
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
      title="Hapus akun?"
      description="Akun yang dihapus tidak bisa dikembalikan. Pastikan akun ini belum dipakai transaksi."
      confirmLabel="Hapus akun"
      onConfirm={handleDelete}
    />
  );
}
