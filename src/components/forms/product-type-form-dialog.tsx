"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createProductTypeAction,
  updateProductTypeAction,
} from "@/app/(dashboard)/sales/actions";
import { FormMessage } from "@/components/forms/form-message";
import { WizardShell } from "@/components/forms/wizard/wizard-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  productTypeSchema,
  type ProductTypeInput,
} from "@/lib/validations/product-types";
import type { ProductTypeSummary } from "@/lib/queries/product-types";
import { cn } from "@/lib/utils";

export function ProductTypeFormDialog({
  productType,
  triggerLabel = "Tambah tipe",
}: {
  productType?: ProductTypeSummary;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const isEdit = Boolean(productType);

  const defaultValues = useMemo<ProductTypeInput>(
    () => ({
      name: productType?.name ?? "",
      isActive: productType?.isActive ?? true,
    }),
    [productType],
  );

  const form = useForm<z.input<typeof productTypeSchema>, unknown, ProductTypeInput>({
    resolver: zodResolver(productTypeSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      form.reset(defaultValues);
    }
  }, [open, productType, defaultValues, form]);

  const watchedActive = form.watch("isActive");

  const onSubmit = (values: ProductTypeInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateProductTypeAction(productType!.id, values)
        : await createProductTypeAction(values);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal menyimpan tipe produk.",
        });
        setPending(false);
        return;
      }

      setPending(false);
      setOpen(false);
      form.reset(defaultValues);
      router.refresh();
    });
  };

  const trigger = isEdit ? (
    <Button variant="ghost" size="sm" className="text-xs">
      <SquarePen className="size-3.5" />
      Edit
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1 rounded-full text-xs"
    >
      <Plus className="size-3.5" />
      {triggerLabel}
    </Button>
  );

  return (
    <WizardShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEdit ? "Edit tipe produk" : "Tambah tipe produk"}
      step={0}
      totalSteps={1}
      stepLabel="Nama"
      direction={1}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan tipe"}
      isEdit
      onBack={() => {}}
      onNext={() => {}}
      message={
        message ? <FormMessage tone={message.tone} message={message.text} /> : undefined
      }
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="space-y-4">
        <Field data-invalid={!!form.formState.errors.name}>
          <FieldContent>
            <Input
              autoFocus={!isEdit}
              className="h-10 rounded-lg text-sm"
              placeholder="mis. Voucher Game"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <FieldError errors={[form.formState.errors.name]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>

        <div className="flex gap-2">
          {(
            [
              { value: true, label: "Aktif" },
              { value: false, label: "Nonaktif" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={watchedActive === opt.value}
              onClick={() => form.setValue("isActive", opt.value)}
              className={cn(
                "h-9 flex-1 rounded-xl border text-xs font-semibold transition-colors",
                watchedActive === opt.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </WizardShell>
  );
}
