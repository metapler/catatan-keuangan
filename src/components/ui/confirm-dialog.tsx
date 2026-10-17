"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!onConfirm) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent className="rounded-xl p-4">
        <AlertDialogHeader className="gap-1.5">
          <AlertDialogTitle className="text-sm">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-xs text-status-expense">{error}</p>
        ) : null}
        <AlertDialogFooter className="mt-3">
          <AlertDialogCancel
            className="text-xs h-7 rounded-lg"
            disabled={pending}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            size="sm"
            className="text-xs h-7 rounded-lg"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Memproses..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
