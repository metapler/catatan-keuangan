"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createCustomerAction,
  updateCustomerAction,
} from "@/app/(dashboard)/debts/actions";
import { FormMessage } from "@/components/forms/form-message";
import { WizardShell } from "@/components/forms/wizard/wizard-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  customerSchema,
  type CustomerInput,
} from "@/lib/validations/customers";
import type { CustomerSummary } from "@/lib/queries/customers";
import { cn } from "@/lib/utils";

const stepLabels = ["Nama", "Kontak"];

function stepForField(field: string): number {
  if (field === "name") return 0;
  if (field === "phone" || field === "notes") return 1;
  return 1;
}

export function CustomerFormDialog({
  customer,
  triggerLabel = "Tambah pelanggan",
}: {
  customer?: CustomerSummary;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const isEdit = Boolean(customer);

  const defaultValues = useMemo<CustomerInput>(
    () => ({
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      notes: customer?.notes ?? "",
      isActive: customer?.isActive ?? true,
    }),
    [customer],
  );

  const form = useForm<z.input<typeof customerSchema>, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
    }
  }, [open, customer, defaultValues, form]);

  const watchedActive = form.watch("isActive");

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 1));
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (!fields.length) return;
    goTo(Math.min(...fields.map(stepForField)));
    const first = errors[fields[0]];
    setMessage({
      tone: "error",
      text: first?.message ?? "Periksa kembali isian pada langkah ini.",
    });
  };

  const onSubmit = (values: CustomerInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateCustomerAction(customer!.id, values)
        : await createCustomerAction(values);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal menyimpan pelanggan.",
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

  const renderEditForm = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      className="space-y-4"
      noValidate
    >
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldContent>
          <Input
            className="h-10 rounded-lg text-sm"
            placeholder="Nama pelanggan"
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <FieldError errors={[form.formState.errors.name]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.phone}>
          <FieldContent>
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="No. HP (opsional)"
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <FieldError errors={[form.formState.errors.phone]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.notes}>
          <FieldContent>
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Catatan (opsional)"
              {...form.register("notes")}
            />
            {form.formState.errors.notes ? (
              <FieldError errors={[form.formState.errors.notes]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>

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
    </form>
  );

  const renderStep = () => {
    if (isEdit) return renderEditForm();

    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <StepTitle title="Nama pelanggan" />
            <Input
              autoFocus
              className="h-10 rounded-lg text-sm"
              placeholder="Budi"
              {...form.register("name")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goTo(1);
                }
              }}
            />
            {form.formState.errors.name ? (
              <FieldError errors={[form.formState.errors.name]} className="text-xs" />
            ) : null}
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <StepTitle title="Kontak (opsional)" />
            <Input
              autoFocus
              className="h-10 rounded-lg text-sm"
              placeholder="No. HP"
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <FieldError errors={[form.formState.errors.phone]} className="text-xs" />
            ) : null}
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Catatan"
              {...form.register("notes")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  form.handleSubmit(onSubmit, handleInvalid)();
                }
              }}
            />
            {form.formState.errors.notes ? (
              <FieldError errors={[form.formState.errors.notes]} className="text-xs" />
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <WizardShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEdit ? "Edit pelanggan" : "Tambah pelanggan"}
      step={step}
      totalSteps={2}
      stepLabel={stepLabels[step] ?? ""}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan pelanggan"}
      isEdit={isEdit}
      message={
        message ? <FormMessage tone={message.tone} message={message.text} /> : undefined
      }
      onBack={() => goTo(step - 1)}
      onNext={() => goTo(step + 1)}
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
    >
      {renderStep()}
    </WizardShell>
  );
}

function StepTitle({ title }: { title: string }) {
  return <h3 className="text-base font-semibold">{title}</h3>;
}
