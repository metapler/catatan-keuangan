"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, TriangleAlert, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type DeleteButtonProps = {
  /** Server action (bind the id at the call site). Errors surface inside the dialog. */
  action: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel?: string;
  successMessage?: string;
  /** When set, renders a disabled button with this label instead of the dialog. */
  disabled?: boolean;
  disabledLabel?: string;
  /** Custom trigger element; defaults to a ghost trash button. */
  trigger?: React.ReactElement;
  icon?: LucideIcon;
  className?: string;
};

export function DeleteButton({
  action,
  title,
  description,
  confirmLabel = "Hapus",
  triggerLabel = "Hapus",
  successMessage,
  disabled = false,
  disabledLabel,
  trigger,
  icon: Icon = Trash2,
  className,
}: DeleteButtonProps) {
  const router = useRouter();

  const handleConfirm = async () => {
    await action();
    startTransition(() => router.refresh());
    if (successMessage) {
      toast.success(successMessage);
    }
  };

  if (disabled && disabledLabel) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <Icon className="size-3.5" />
        {disabledLabel}
      </Button>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        trigger ?? (
          <Button variant="ghost" size="sm" className={className}>
            <Icon className="size-3.5" />
            {triggerLabel}
          </Button>
        )
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={handleConfirm}
    />
  );
}

export function OrphanCleanupButton({
  action,
  className,
}: {
  action: () => Promise<void>;
  className?: string;
}) {
  return (
    <DeleteButton
      action={action}
      className={className}
      icon={TriangleAlert}
      triggerLabel="Yatim"
      title="Bersihkan cicilan yatim?"
      description="Transaksi pemasukan cicilan ini sudah dihapus manual dari halaman Transaksi. Baris cicilan yatim akan dihapus agar sisa hutang akurat."
      confirmLabel="Hapus baris yatim"
      successMessage="Cicilan yatim dibersihkan."
    />
  );
}
