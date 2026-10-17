"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Plus,
  SquarePen,
} from "lucide-react";
import { z } from "zod";

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/app/(dashboard)/transactions/actions";
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
import {
  transactionSchema,
  type TransactionInput,
} from "@/lib/validations/transactions";
import type {
  TransactionOptionAccount,
  TransactionOptionCategory,
  TransactionSummary,
} from "@/lib/queries/transactions";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { getAccountTypeMeta } from "@/lib/utils/finance";
import {
  sortByUsageDesc,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";
import { cn } from "@/lib/utils";

type TransactionFormDialogProps = {
  transaction?: TransactionSummary;
  accounts: TransactionOptionAccount[];
  incomeCategories: TransactionOptionCategory[];
  expenseCategories: TransactionOptionCategory[];
  accountUsage?: UsageCount;
  categoryUsage?: UsageCount;
};

const typeCards = [
  {
    value: "expense",
    title: "Pengeluaran",
    icon: ArrowDownRight,
    badgeClass: "bg-rose-500/10 text-status-expense dark:text-rose-400",
    activeClass: "border-rose-500/50 bg-rose-500/5",
  },
  {
    value: "income",
    title: "Pemasukan",
    icon: ArrowUpRight,
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    activeClass: "border-emerald-500/50 bg-emerald-500/5",
  },
  {
    value: "transfer",
    title: "Transfer",
    icon: ArrowRightLeft,
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    activeClass: "border-amber-500/50 bg-amber-500/5",
  },
] as const;

function accountOption(account: TransactionOptionAccount) {
  const meta = getAccountTypeMeta(account.type);
  const Icon = meta.icon;
  return {
    id: account.id,
    label: account.name,
    hint: meta.label,
    icon: <Icon className="size-5 shrink-0 text-muted-foreground" />,
  };
}

function toDateInputValue(dateValue?: string | null) {
  if (!dateValue) {
    return new Date().toISOString().slice(0, 10);
  }

  return dateValue.slice(0, 10);
}

function stepForField(field: string, isTransfer: boolean): number {
  if (field === "type") return 0;
  if (field === "amount") return 1;
  if (field === "description") return 2;
  if (field === "accountId" || field === "fromAccountId" || field === "toAccountId") return 3;
  if (field === "categoryId") return isTransfer ? 3 : 4;
  if (field === "transactionDate") return isTransfer ? 4 : 5;
  return isTransfer ? 4 : 5;
}

export function TransactionFormDialog({
  transaction,
  accounts,
  incomeCategories,
  expenseCategories,
  accountUsage,
  categoryUsage,
}: TransactionFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [displayAmount, setDisplayAmount] = useState(() =>
    displayFromNumber(transaction?.amount ?? 0),
  );

  const isEdit = Boolean(transaction);

  const defaultValues = useMemo<TransactionInput>(
    () => ({
      type: transaction?.type ?? "expense",
      amount: transaction?.amount ?? 0,
      transactionDate: toDateInputValue(transaction?.transactionDate),
      description: transaction?.description ?? "",
      accountId: transaction?.accountId ?? "",
      categoryId: transaction?.categoryId ?? "",
      fromAccountId: transaction?.fromAccountId ?? "",
      toAccountId: transaction?.toAccountId ?? "",
    }),
    [transaction],
  );

  const form = useForm<z.input<typeof transactionSchema>, unknown, TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
      setDisplayAmount(displayFromNumber(transaction?.amount ?? 0));
    }
  }, [open, transaction, defaultValues, form]);

  const selectedType = useWatch({ control: form.control, name: "type" });
  const selectedAccountId = useWatch({ control: form.control, name: "accountId" });
  const selectedCategoryId = useWatch({ control: form.control, name: "categoryId" });
  const selectedFromAccountId = useWatch({ control: form.control, name: "fromAccountId" });
  const selectedToAccountId = useWatch({ control: form.control, name: "toAccountId" });
  const watchedDate = useWatch({ control: form.control, name: "transactionDate" });
  const watchedDescription = useWatch({ control: form.control, name: "description" });
  const watchedAmount = useWatch({ control: form.control, name: "amount" });

  const isTransfer = selectedType === "transfer";
  const totalSteps = isTransfer ? 5 : 6;
  const stepLabels = isTransfer
    ? ["Tipe", "Nominal", "Deskripsi", "Akun", "Tanggal"]
    : ["Tipe", "Nominal", "Deskripsi", "Akun", "Kategori", "Tanggal"];

  // Opsi diurutkan by frekuensi pemakaian (desc); seri = urutan asal.
  const sortedAccounts = useMemo(
    () => sortByUsageDesc(accounts, (a) => a.id, accountUsage),
    [accounts, accountUsage],
  );
  const activeCategories = useMemo(() => {
    const base =
      selectedType === "income" ? incomeCategories : expenseCategories;
    return sortByUsageDesc(base, (c) => c.id, categoryUsage);
  }, [selectedType, incomeCategories, expenseCategories, categoryUsage]);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), totalSteps - 1));
  };

  const setType = (value: TransactionInput["type"]) => {
    form.setValue("type", value, { shouldValidate: true });
    if (value === "transfer") {
      form.setValue("accountId", "");
      form.setValue("categoryId", "");
    } else {
      form.setValue("fromAccountId", "");
      form.setValue("toAccountId", "");
    }
    if (isTransfer !== (value === "transfer")) {
      setStep((s) => Math.min(s, (value === "transfer" ? 5 : 6) - 1));
    }
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (fields.length === 0) return;
    const target = Math.min(...fields.map((f) => stepForField(f, isTransfer)));
    goTo(target);
    const first = errors[fields[0]];
    setMessage({
      tone: "error",
      text: first?.message ?? "Periksa kembali isian pada langkah ini.",
    });
  };

  const onSubmit = (values: TransactionInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateTransactionAction(transaction!.id, values)
        : await createTransactionAction(values);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal menyimpan transaksi.",
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
    <Button size="sm" className="h-8 gap-1 rounded-full text-xs">
      <Plus className="size-3.5" />
      Tambah transaksi
    </Button>
  );

  const accountName = (id?: string) => sortedAccounts.find((a) => a.id === id)?.name ?? "-";
  const categoryName = (id?: string) =>
    [...incomeCategories, ...expenseCategories].find((c) => c.id === id)?.name ?? "-";

  const renderEditForm = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-3 gap-2">
        {typeCards.map((card) => {
          const Icon = card.icon;
          const active = selectedType === card.value;
          return (
            <button
              key={card.value}
              type="button"
              onClick={() => setType(card.value)}
              aria-pressed={active}
              className={cn(
                "flex min-h-[52px] flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-colors",
                active ? card.activeClass : "border-border bg-card",
              )}
            >
              <span className={cn("flex size-8 items-center justify-center rounded-lg", card.badgeClass)}>
                <Icon className="size-4" />
              </span>
              <p className="text-xs font-semibold">{card.title}</p>
            </button>
          );
        })}
      </div>

      <Field data-invalid={!!form.formState.errors.amount}>
        <FieldContent>
          <AmountInput
            id="transaction-amount-edit"
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

      <Field data-invalid={!!form.formState.errors.description}>
        <FieldContent>
          <Input
            className="h-10 rounded-lg text-sm"
            placeholder="Makan siang"
            {...form.register("description")}
          />
          {form.formState.errors.description ? (
            <FieldError errors={[form.formState.errors.description]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      {isTransfer ? (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bayar hutang: asal = akun bayar (mis. BRI), tujuan = akun Hutang Dagang.
            Arah sebaliknya justru menambah hutang.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={!!form.formState.errors.fromAccountId}>
              <FieldContent>
                <Select
                  value={selectedFromAccountId ?? ""}
                  onValueChange={(v) => form.setValue("fromAccountId", v ?? "", { shouldValidate: true })}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                    <SelectValue placeholder="Akun asal">
                      {accountName(selectedFromAccountId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.fromAccountId ? (
                  <FieldError errors={[form.formState.errors.fromAccountId]} className="text-xs" />
                ) : null}
              </FieldContent>
            </Field>
            <Field data-invalid={!!form.formState.errors.toAccountId}>
              <FieldContent>
                <Select
                  value={selectedToAccountId ?? ""}
                  onValueChange={(v) => form.setValue("toAccountId", v ?? "", { shouldValidate: true })}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                    <SelectValue placeholder="Akun tujuan">
                      {accountName(selectedToAccountId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.toAccountId ? (
                  <FieldError errors={[form.formState.errors.toAccountId]} className="text-xs" />
                ) : null}
              </FieldContent>
            </Field>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={!!form.formState.errors.accountId}>
            <FieldContent>
              <Select
                value={selectedAccountId ?? ""}
                onValueChange={(v) => form.setValue("accountId", v ?? "", { shouldValidate: true })}
              >
                <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                  <SelectValue placeholder="Pilih akun">{accountName(selectedAccountId)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortedAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.accountId ? (
                <FieldError errors={[form.formState.errors.accountId]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>
          <Field data-invalid={!!form.formState.errors.categoryId}>
            <FieldContent>
              <Select
                value={selectedCategoryId ?? ""}
                onValueChange={(v) => form.setValue("categoryId", v ?? "", { shouldValidate: true })}
              >
                <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                  <SelectValue placeholder="Pilih kategori">{categoryName(selectedCategoryId)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId ? (
                <FieldError errors={[form.formState.errors.categoryId]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>
        </div>
      )}

      <Field data-invalid={!!form.formState.errors.transactionDate}>
        <FieldContent>
          <Input
            type="date"
            className="h-10 rounded-lg text-sm"
            {...form.register("transactionDate")}
          />
          {form.formState.errors.transactionDate ? (
            <FieldError errors={[form.formState.errors.transactionDate]} className="text-xs" />
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
          <div className="space-y-3">
            <StepTitle title="Tipe" />
            <div className="grid gap-2">
              {typeCards.map((card) => {
                const Icon = card.icon;
                const active = selectedType === card.value;
                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={(e) => {
                      setType(card.value);
                      e.currentTarget.blur();
                      goTo(1);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      active
                        ? card.activeClass
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span className={cn("flex size-10 items-center justify-center rounded-xl", card.badgeClass)}>
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-semibold">{card.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <StepTitle title="Nominal" />
            <AmountInput
              id="transaction-amount"
              autoFocus
              value={displayAmount}
              invalid={!!form.formState.errors.amount}
              onChange={(display, numeric) => {
                setDisplayAmount(display);
                form.setValue("amount", numeric, { shouldValidate: false });
                if (message) setMessage(null);
              }}
              onEnter={() => goTo(2)}
            />
            {form.formState.errors.amount ? (
              <FieldError errors={[form.formState.errors.amount]} className="text-xs" />
            ) : null}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <StepTitle title="Catatan" />
            <Input
              autoFocus
              className="h-10 rounded-lg text-sm"
              placeholder="Makan siang"
              {...form.register("description")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goTo(3);
                }
              }}
            />
          </div>
        );
      case 3:
        if (isTransfer) {
          return (
            <div className="space-y-4">
              <StepTitle title="Akun" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">ASAL</p>
                <OptionList
                  value={selectedFromAccountId ?? ""}
                  onChange={(id) => {
                    form.setValue("fromAccountId", id, { shouldValidate: false });
                    if (message) setMessage(null);
                  }}
                  options={sortedAccounts.map((a) => ({
                    ...accountOption(a),
                    disabled: a.id === selectedToAccountId,
                  }))}
                  emptyTitle="Belum ada akun"
                  emptyDescription="Buat akun dulu sebelum mencatat transfer."
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">TUJUAN</p>
                <OptionList
                  value={selectedToAccountId ?? ""}
                  onChange={(id) => {
                    form.setValue("toAccountId", id, { shouldValidate: false });
                    if (message) setMessage(null);
                  }}
                  options={sortedAccounts.map((a) => ({
                    ...accountOption(a),
                    disabled: a.id === selectedFromAccountId,
                  }))}
                  emptyTitle="Belum ada akun tujuan"
                  emptyDescription="Butuh minimal 2 akun untuk transfer."
                />
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <StepTitle title="Akun" />
            {sortedAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                <p className="text-sm font-semibold">Belum ada akun</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buat akun dulu, lalu kembali ke sini.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-10 rounded-xl"
                  onClick={() => setOpen(false)}
                >
                  Tutup & buat akun
                </Button>
              </div>
            ) : (
              <OptionList
                value={selectedAccountId ?? ""}
                onChange={(id) => {
                  form.setValue("accountId", id, { shouldValidate: false });
                  if (message) setMessage(null);
                }}
                options={sortedAccounts.map(accountOption)}
              />
            )}
          </div>
        );
      case 4:
        if (isTransfer) {
          return renderDateSummary();
        }
        return (
          <div className="space-y-4">
            <StepTitle title="Kategori" />
            {activeCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                <p className="text-sm font-semibold">Belum ada kategori</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buat kategori dulu, lalu kembali ke sini.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-10 rounded-xl"
                  onClick={() => setOpen(false)}
                >
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
                options={activeCategories.map((c) => ({
                  id: c.id,
                  label: c.name,
                  color: c.color,
                }))}
              />
            )}
          </div>
        );
      case 5:
        return renderDateSummary();
      default:
        return null;
    }
  };

  const renderDateSummary = () => {
    const amount = Number(watchedAmount ?? 0);
    const dateValue = watchedDate;
    const desc = watchedDescription;
    const fromType = sortedAccounts.find((a) => a.id === selectedFromAccountId)?.type;
    const toType = sortedAccounts.find((a) => a.id === selectedToAccountId)?.type;
    const isDebtPayment =
      isTransfer && fromType !== "hutang" && toType === "hutang";
    const isDebtIncrease =
      isTransfer && fromType === "hutang" && toType !== "hutang";
    return (
      <div className="space-y-4">
        <StepTitle title="Tanggal" />
        <Input
          type="date"
          className="h-10 rounded-lg text-sm"
          {...form.register("transactionDate")}
        />
        {isTransfer && (isDebtPayment || isDebtIncrease) ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {isDebtPayment
              ? "Transfer ini melunasi hutang: saldo akun Hutang bertambah menuju 0."
              : "Transfer ini menambah hutang: saldo akun Hutang makin negatif."}
          </p>
        ) : null}
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {formatCurrencyIDR(Number.isFinite(amount) ? amount : 0)}
          </p>
          <dl className="mt-3 divide-y text-sm">
            <SummaryRow
              label="Tipe"
              value={typeCards.find((t) => t.value === selectedType)?.title ?? selectedType}
            />
            {isTransfer ? (
              <>
                <SummaryRow label="Dari" value={accountName(selectedFromAccountId)} />
                <SummaryRow label="Ke" value={accountName(selectedToAccountId)} />
              </>
            ) : (
              <>
                <SummaryRow label="Akun" value={accountName(selectedAccountId)} />
                <SummaryRow label="Kategori" value={categoryName(selectedCategoryId)} />
              </>
            )}
            <SummaryRow
              label="Tanggal"
              value={dateValue ? formatDateID(dateValue) : "-"}
            />
            {desc ? <SummaryRow label="Catatan" value={desc} /> : null}
          </dl>
        </div>
      </div>
    );
  };

  return (
    <WizardShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEdit ? "Edit transaksi" : "Tambah transaksi"}
      step={step}
      totalSteps={totalSteps}
      stepLabel={stepLabels[step] ?? ""}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan transaksi"}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
