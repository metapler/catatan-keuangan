"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteBudgetAction } from "@/app/(dashboard)/budgets/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function BudgetDeleteButton({ budgetId }: { budgetId: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    await deleteBudgetAction(budgetId);
    router.refresh();
  };

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-[11px]">
          <Trash2 className="size-3.5" />
          Hapus
        </Button>
      }
      title="Hapus budget?"
      description="Budget yang dihapus akan hilang dari ringkasan periode ini."
      confirmLabel="Hapus budget"
      onConfirm={handleDelete}
    />
  );
}
