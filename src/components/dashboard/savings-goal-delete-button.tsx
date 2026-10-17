"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteSavingsGoalAction } from "@/app/(dashboard)/savings-goals/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SavingsGoalDeleteButton({
  goalId,
}: {
  goalId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = () => {
    setPending(true);

    startTransition(async () => {
      try {
        await deleteSavingsGoalAction(goalId);
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
      title="Hapus target tabungan?"
      description="Target tabungan yang dihapus akan hilang dari ringkasan dan progress Anda."
      confirmLabel="Hapus target"
      onConfirm={handleDelete}
    />
  );
}
