"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createBudgetAction,
  updateBudgetAction,
} from "@/app/(dashboard)/budgets/actions";
import { FormMessage } from "@/components/forms/form-message";
import { AmountInput } from "@/components/forms/wizard/amount-input";
import { OptionList } from "@/components/forms/wizard/option-list";
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
import type { BudgetExpenseCategory, BudgetSummary } from "@/lib/queries/budgets";
import { budgetSchema, type BudgetInput } from "@/lib/validations/budgets";
import {
  sortByUsageDesc,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";
import { formatCurrencyIDR } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Agu" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Okt" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Des" },
];

const monthLong = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const stepLabels = ["Kategori", "Periode", "Nominal"];

function stepForField(field: string): number {
  if (field === "categoryId") return 0;
  if (field === "periodMonth" || field === "periodYear") return 1;
  if (field === "amount") return 2;
  return 2;
}

export function BudgetFormDialog({
  budget,
  expenseCategories,
  selectedMonth,
  selectedYear,
  categoryUsage,
}: {
  budget?: BudgetSummary;
  expenseCategories: BudgetExpenseCategory[];
  selectedMonth: number;
  selectedYear: number;
  categoryUsage?: UsageCount;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [displayAmount, setDisplayAmount] = useState(() =>
    displayFromNumber(budget?.amount ?? 0),
  );

  const isEdit = Boolean(budget);

  const defaultValues = useMemo<BudgetInput>(
    () => ({
      categoryId: budget?.categoryId ?? "",
      periodMonth: budget?.periodMonth ?? selectedMonth,
      periodYear: budget?.periodYear ?? selectedYear,
      amount: budget?.amount ?? 0,
    }),
    [budget, selectedMonth, selectedYear],
  );

  const form = useForm<z.input<typeof budgetSchema>, unknown, BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
      setDisplayAmount(displayFromNumber(budget?.amount ?? 0));
    }
  }, [open, budget, defaultValues, form]);

  const selectedCategoryId = useWatch({ control: form.control, name: "categoryId" });
  const selectedPeriodMonth = useWatch({ control: form.control, name: "periodMonth" });
  const selectedPeriodYear = useWatch({ control: form.control, name: "periodYear" });

  // Kategori diurutkan by frekuensi pemakaian (desc); seri = urutan asal.
  const sortedExpenseCategories = useMemo(
    () => sortByUsageDesc(expenseCategories, (c) => c.id, categoryUsage),
    [expenseCategories, categoryUsage],
  );

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 2));
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (!fields.length) return;
    goTo(Math.min(...fields.map(stepForField)));
    const first = errors[fields[0]];
    setMessage({ tone: "error", text: first?.message ?? "Periksa kembali isian pada langkah ini." });
  };

  const onSubmit = (values: BudgetInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateBudgetAction(budget!.id, values)
        : await createBudgetAction(values);

      if (result.status === "error") {
        setMessage({ tone: "error", text: result.message ?? "Gagal menyimpan budget." });
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
      Tambah budget
    </Button>
  );

  const categoryName = sortedExpenseCategories.find((c) => c.id === selectedCategoryId)?.name ?? "—";
  const watchedAmount = useWatch({ control: form.control, name: "amount" });
  const amount = Number(watchedAmount ?? 0);

  const renderEditForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)} className="space-y-4" noValidate>
      <Field data-invalid={!!form.formState.errors.categoryId}>
        <FieldContent>
          <Select
            value={selectedCategoryId ?? ""}
            onValueChange={(v) => form.setValue("categoryId", v ?? "", { shouldValidate: true })}
          >
            <SelectTrigger className="h-10 w-full rounded-lg text-sm">
              <SelectValue placeholder="Pilih kategori expense">
                {sortedExpenseCategories.find((c) => c.id === selectedCategoryId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortedExpenseCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.categoryId ? (
            <FieldError errors={[form.formState.errors.categoryId]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!form.formState.errors.periodMonth}>
          <FieldContent>
            <Select
              value={selectedPeriodMonth ? String(selectedPeriodMonth) : ""}
              onValueChange={(v) => form.setValue("periodMonth", Number(v ?? selectedMonth), { shouldValidate: true })}
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Bulan">
                  {monthLong[(Number(selectedPeriodMonth) || 1) - 1]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{monthLong[m.value - 1]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.periodMonth ? (
              <FieldError errors={[form.formState.errors.periodMonth]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.periodYear}>
          <FieldContent>
            <Input
              type="number"
              min="2000"
              max="2100"
              className="h-10 rounded-lg text-sm"
              {...form.register("periodYear", { valueAsNumber: true })}
            />
            {form.formState.errors.periodYear ? (
              <FieldError errors={[form.formState.errors.periodYear]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>

      <Field data-invalid={!!form.formState.errors.amount}>
        <FieldContent>
          <AmountInput
            id="budget-amount-edit"
            value={displayAmount}
            onChange={(display, numeric) => {
              setDisplayAmount(display);
              form.setValue("amount", numeric, { shouldValidate: true });
            }}
          />
          {form.formState.errors.amount ? (
            <FieldError errors={[form.formState.errors.amount]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>
    </form>
  );

  const renderStep = () => {
    if (isEdit) return renderEditForm();
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <StepTitle title="Kategori" />
            {sortedExpenseCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                <p className="text-sm font-semibold">Belum ada kategori expense</p>
                <p className="mt-1 text-sm text-muted-foreground">Buat kategori dulu, lalu kembali ke sini.</p>
                <Button type="button" variant="outline" className="mt-4 h-10 rounded-xl" onClick={() => setOpen(false)}>
                  Tutup & buat kategori
                </Button>
              </div>
            ) : (
              <OptionList
                value={selectedCategoryId ?? ""}
                onChange={(id) => {
                  form.setValue("categoryId", id, { shouldValidate: false });
                  if (message) setMessage(null);
                }}
                options={sortedExpenseCategories.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
              />
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <StepTitle title="Periode" />
            <div className="grid grid-cols-4 gap-2">
              {monthOptions.map((m) => {
                const active = selectedPeriodMonth === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => form.setValue("periodMonth", m.value, { shouldValidate: false })}
                    className={cn(
                      "h-11 rounded-xl border text-sm font-semibold transition-all active:scale-95",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-xl"
                aria-label="Kurangi tahun"
                onClick={() => form.setValue("periodYear", Number(selectedPeriodYear ?? selectedYear) - 1, { shouldValidate: false })}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                min="2000"
                max="2100"
                aria-label="Tahun periode"
                className="h-10 rounded-lg text-center text-sm font-semibold"
                {...form.register("periodYear", { valueAsNumber: true })}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-xl"
                aria-label="Tambah tahun"
                onClick={() => form.setValue("periodYear", Number(selectedPeriodYear ?? selectedYear) + 1, { shouldValidate: false })}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {(form.formState.errors.periodMonth || form.formState.errors.periodYear) ? (
              <FieldError
                errors={[form.formState.errors.periodMonth, form.formState.errors.periodYear].filter(Boolean)}
                className="text-xs"
              />
            ) : null}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <StepTitle title="Nominal" />
            <AmountInput
              id="budget-amount"
              autoFocus
              value={displayAmount}
              invalid={!!form.formState.errors.amount}
              onChange={(display, numeric) => {
                setDisplayAmount(display);
                form.setValue("amount", numeric, { shouldValidate: false });
                if (message) setMessage(null);
              }}
              onEnter={() => form.handleSubmit(onSubmit, handleInvalid)()}
            />
            {form.formState.errors.amount ? (
              <FieldError errors={[form.formState.errors.amount]} className="text-xs" />
            ) : null}
            <div className="text-sm">
              <p className="text-lg font-bold">{formatCurrencyIDR(Number.isFinite(amount) ? amount : 0)}</p>
              <dl className="mt-2 divide-y">
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-muted-foreground">Kategori</dt>
                  <dd className="truncate text-right font-medium">{categoryName}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-muted-foreground">Periode</dt>
                  <dd className="truncate text-right font-medium">
                    {monthLong[(Number(selectedPeriodMonth) || selectedMonth) - 1]}{" "}
                    {String(selectedPeriodYear ?? selectedYear)}
                  </dd>
                </div>
              </dl>
            </div>
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
      title={isEdit ? "Edit budget" : "Tambah budget"}
      step={step}
      totalSteps={3}
      stepLabel={stepLabels[step]}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan budget"}
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
