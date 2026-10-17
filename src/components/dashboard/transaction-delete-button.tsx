"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteTransactionAction } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function TransactionDeleteButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = () => {
    setPending(true);

    startTransition(async () => {
      try {
        await deleteTransactionAction(transactionId);
        router.refresh();
      } finally {
        setPending(false);
      }
    });
  };

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" disabled={pending} className="text-[11px]">
          <Trash2 className="size-3.5" />
          {pending ? "Menghapus..." : "Hapus"}
        </Button>
      }
      title="Hapus transaksi?"
      description="Transaksi yang dihapus akan langsung memengaruhi saldo akun dan ringkasan dashboard."
      confirmLabel="Hapus transaksi"
      onConfirm={handleDelete}
    />
  );
}
