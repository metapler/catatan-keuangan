"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createSavingsGoalAction,
  updateSavingsGoalAction,
} from "@/app/(dashboard)/savings-goals/actions";
import { FormMessage } from "@/components/forms/form-message";
import { AmountInput } from "@/components/forms/wizard/amount-input";
import { WizardShell } from "@/components/forms/wizard/wizard-shell";
import { displayFromNumber } from "@/components/forms/wizard/format";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SavingsGoalSummary } from "@/lib/queries/savings-goals";
import {
  savingsGoalSchema,
  savingsGoalStatuses,
  type SavingsGoalInput,
} from "@/lib/validations/savings-goals";
import { formatCurrencyIDR } from "@/lib/utils/format";

const statusLabels: Record<(typeof savingsGoalStatuses)[number], string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const stepLabels = ["Nama", "Target", "Terkumpul", "Tanggal"];

function stepForField(field: string): number {
  if (field === "name") return 0;
  if (field === "targetAmount") return 1;
  if (field === "currentAmount") return 2;
  if (field === "targetDate" || field === "status") return 3;
  return 3;
}

export function SavingsGoalFormDialog({ goal }: { goal?: SavingsGoalSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [displayTargetAmount, setDisplayTargetAmount] = useState(() =>
    displayFromNumber(goal?.targetAmount ?? 0),
  );
  const [displayCurrentAmount, setDisplayCurrentAmount] = useState(() =>
    displayFromNumber(goal?.currentAmount ?? 0),
  );

  const isEdit = Boolean(goal);

  const defaultValues = useMemo<SavingsGoalInput>(
    () => ({
      name: goal?.name ?? "",
      targetAmount: goal?.targetAmount ?? 0,
      currentAmount: goal?.currentAmount ?? 0,
      targetDate: goal?.targetDate ?? "",
      status: goal?.status ?? "active",
    }),
    [goal],
  );

  const form = useForm<z.input<typeof savingsGoalSchema>, unknown, SavingsGoalInput>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
      setDisplayTargetAmount(displayFromNumber(goal?.targetAmount ?? 0));
      setDisplayCurrentAmount(displayFromNumber(goal?.currentAmount ?? 0));
    }
  }, [open, goal, defaultValues, form]);

  const selectedStatus = useWatch({ control: form.control, name: "status" });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedTarget = useWatch({ control: form.control, name: "targetAmount" });
  const watchedCurrent = useWatch({ control: form.control, name: "currentAmount" });

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 3));
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (!fields.length) return;
    goTo(Math.min(...fields.map(stepForField)));
    const first = errors[fields[0]];
    setMessage({ tone: "error", text: first?.message ?? "Periksa kembali isian pada langkah ini." });
  };

  const onSubmit = (values: SavingsGoalInput) => {
    const payload: SavingsGoalInput = isEdit
      ? values
      : { ...values, status: "active" as const };
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateSavingsGoalAction(goal!.id, payload)
        : await createSavingsGoalAction(payload);

      if (result.status === "error") {
        setMessage({ tone: "error", text: result.message ?? "Gagal menyimpan target tabungan." });
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
    <Button size="sm" className="h-8 gap-1 rounded-full text-xs">
      <Plus className="size-3.5" />
      Tambah target
    </Button>
  );

  const target = Number(watchedTarget ?? 0);
  const current = Number(watchedCurrent ?? 0);
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  const renderEditForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)} className="space-y-4" noValidate>
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldContent>
          <Input
            placeholder="Dana darurat"
            className="h-10 rounded-lg text-sm"
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <FieldError errors={[form.formState.errors.name]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <Field data-invalid={!!form.formState.errors.targetAmount}>
        <FieldContent>
          <AmountInput
            id="goal-target-edit"
            value={displayTargetAmount}
            onChange={(display, numeric) => {
              setDisplayTargetAmount(display);
              form.setValue("targetAmount", numeric, { shouldValidate: true });
            }}
          />
          {form.formState.errors.targetAmount ? (
            <FieldError errors={[form.formState.errors.targetAmount]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <Field data-invalid={!!form.formState.errors.currentAmount}>
        <FieldContent>
          <AmountInput
            id="goal-current-edit"
            value={displayCurrentAmount}
            onChange={(display, numeric) => {
              setDisplayCurrentAmount(display);
              form.setValue("currentAmount", numeric, { shouldValidate: true });
            }}
          />
          {form.formState.errors.currentAmount ? (
            <FieldError errors={[form.formState.errors.currentAmount]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.targetDate}>
          <FieldContent>
            <Input type="date" className="h-10 rounded-lg text-sm" {...form.register("targetDate")} />
            {form.formState.errors.targetDate ? (
              <FieldError errors={[form.formState.errors.targetDate]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.status}>
          <FieldContent>
            <Select
              value={selectedStatus ?? "active"}
              onValueChange={(v) => form.setValue("status", (v ?? "active") as SavingsGoalInput["status"], { shouldValidate: true })}
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Status">{statusLabels[selectedStatus]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {savingsGoalStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.status ? (
              <FieldError errors={[form.formState.errors.status]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>
    </form>
  );

  const renderStep = () => {
    if (isEdit) return renderEditForm();
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <StepTitle title="Nama" />
            <Input
              autoFocus
              className="h-10 rounded-lg text-sm"
              placeholder="Dana darurat"
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
            <StepTitle title="Target" />
            <AmountInput
              id="goal-target"
              autoFocus
              value={displayTargetAmount}
              invalid={!!form.formState.errors.targetAmount}
              onChange={(display, numeric) => {
                setDisplayTargetAmount(display);
                form.setValue("targetAmount", numeric, { shouldValidate: false });
                if (message) setMessage(null);
              }}
              onEnter={() => goTo(2)}
            />
            {form.formState.errors.targetAmount ? (
              <FieldError errors={[form.formState.errors.targetAmount]} className="text-xs" />
            ) : null}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <StepTitle title="Terkumpul" />
            <AmountInput
              id="goal-current"
              autoFocus
              value={displayCurrentAmount}
              invalid={!!form.formState.errors.currentAmount}
              onChange={(display, numeric) => {
                setDisplayCurrentAmount(display);
                form.setValue("currentAmount", numeric, { shouldValidate: false });
                if (message) setMessage(null);
              }}
              onEnter={() => goTo(3)}
            />
            {form.formState.errors.currentAmount ? (
              <FieldError errors={[form.formState.errors.currentAmount]} className="text-xs" />
            ) : null}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm">
                {formatCurrencyIDR(Number.isFinite(current) ? current : 0)}
                <span className="text-muted-foreground">
                  {" "}dari {formatCurrencyIDR(Number.isFinite(target) ? target : 0)}
                </span>
              </p>
            </div>
          </div>
        );
      case 3: {
        return (
          <div className="space-y-4">
            <StepTitle title="Tanggal" />
            <Input
              type="date"
              className="h-10 rounded-lg text-sm"
              {...form.register("targetDate")}
            />
            {form.formState.errors.targetDate ? (
              <FieldError errors={[form.formState.errors.targetDate]} className="text-xs" />
            ) : null}
            <div className="text-sm">
              <p className="text-lg font-bold">{formatCurrencyIDR(Number.isFinite(target) ? target : 0)}</p>
              <dl className="mt-2 divide-y">
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-muted-foreground">Nama</dt>
                  <dd className="truncate text-right font-medium">{watchedName || "—"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-muted-foreground">Terkumpul</dt>
                  <dd className="truncate text-right font-medium">{formatCurrencyIDR(Number.isFinite(current) ? current : 0)}</dd>
                </div>
              </dl>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <WizardShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEdit ? "Edit target tabungan" : "Tambah target tabungan"}
      step={step}
      totalSteps={4}
      stepLabel={stepLabels[step]}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan target"}
      isEdit={isEdit}
      message={message ? <FormMessage tone={message.tone} message={message.text} /> : undefined}
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
