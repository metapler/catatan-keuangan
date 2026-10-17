"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { updateSavingsGoalProgressAction } from "@/app/(dashboard)/savings-goals/actions";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SavingsGoalSummary } from "@/lib/queries/savings-goals";
import { createSavingsProgressSchema } from "@/lib/validations/savings-goals";

export function SavingsProgressDialog({
  goal,
}: {
  goal: SavingsGoalSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const defaultValues = useMemo<ProgressInput>(
    () => ({
      currentAmount: goal.currentAmount,
    }),
    [goal.currentAmount],
  );
  const progressSchema = useMemo(
    () => createSavingsProgressSchema(goal.targetAmount),
    [goal.targetAmount],
  );

  type ProgressInput = z.infer<typeof progressSchema>;

  const form = useForm<z.input<typeof progressSchema>, unknown, ProgressInput>({
    resolver: zodResolver(progressSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const onSubmit = (values: ProgressInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = await updateSavingsGoalProgressAction(goal.id, values.currentAmount);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal memperbarui progress.",
        });
        setPending(false);
        return;
      }

      setPending(false);
      setOpen(false);
      form.reset(defaultValues);
      toast.success("Progress tabungan diperbarui.");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-xs">
            <Coins className="size-3.5" />
            Update progress
          </Button>
        }
      />
      <DialogContent className="max-w-md rounded-xl p-4">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-sm">Update progress tabungan</DialogTitle>
          <DialogDescription className="text-xs">
            Ubah nominal terkumpul untuk target &quot;{goal.name}&quot; secara
            langsung.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field data-invalid={!!form.formState.errors.currentAmount}>
            <FieldLabel htmlFor="goal-progress" className="text-xs">Nominal terkumpul</FieldLabel>
            <FieldContent>
              <div className="flex gap-2">
                <Input
                  id="goal-progress"
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 rounded-lg text-xs flex-1"
                  {...form.register("currentAmount", { valueAsNumber: true })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs px-2.5"
                  onClick={() => {
                    const current = Number(form.getValues("currentAmount") ?? 0);
                    form.setValue("currentAmount", current * 1000, { shouldValidate: true });
                  }}
                >
                  000
                </Button>
              </div>
              {form.formState.errors.currentAmount ? (
                <FieldError errors={[form.formState.errors.currentAmount]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>

          {message ? <FormMessage tone={message.tone} message={message.text} /> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs h-7"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" className="rounded-lg text-xs h-7" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan progress"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
