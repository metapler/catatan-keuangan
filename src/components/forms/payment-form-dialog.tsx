"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, HandCoins, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createPaymentAction,
  updatePaymentAction,
} from "@/app/(dashboard)/debts/actions";
import { FormMessage } from "@/components/forms/form-message";
import { AmountInput } from "@/components/forms/wizard/amount-input";
import { displayFromNumber } from "@/components/forms/wizard/format";
import { OptionList } from "@/components/forms/wizard/option-list";
import { WizardShell } from "@/components/forms/wizard/wizard-shell";
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
import { paymentSchema, type PaymentInput } from "@/lib/validations/debts";
import type { DebtSummary, PaymentSummary } from "@/lib/queries/debts";
import type { TransactionOptionAccount } from "@/lib/queries/transactions";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { getAccountTypeMeta } from "@/lib/utils/finance";

type PaymentFormDialogProps = {
  debt: DebtSummary;
  payment?: PaymentSummary;
  accounts: TransactionOptionAccount[];
};

const stepLabels = ["Nominal & akun", "Tanggal"];

function stepForField(field: string): number {
  if (field === "amount" || field === "accountId") return 0;
  if (field === "paymentDate" || field === "note") return 1;
  return 1;
}

function toDateInputValue(dateValue?: string | null) {
  if (!dateValue) {
    return new Date().toISOString().slice(0, 10);
  }
  return dateValue.slice(0, 10);
}

export function PaymentFormDialog({ debt, payment, accounts }: PaymentFormDialogProps) {
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
    displayFromNumber(payment?.amount ?? 0),
  );

  const isEdit = Boolean(payment);

  const defaultValues = useMemo<PaymentInput>(
    () => ({
      amount: payment?.amount ?? 0,
      accountId: payment?.accountId ?? "",
      paymentDate: toDateInputValue(payment?.paymentDate),
      note: payment?.note ?? "",
    }),
    [payment],
  );

  const form = useForm<z.input<typeof paymentSchema>, unknown, PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
      setDisplayAmount(displayFromNumber(payment?.amount ?? 0));
    }
  }, [open, payment, defaultValues, form]);

  const selectedAccountId = useWatch({ control: form.control, name: "accountId" });
  const watchedAmount = useWatch({ control: form.control, name: "amount" });
  const watchedDate = useWatch({ control: form.control, name: "paymentDate" });
  const watchedNote = useWatch({ control: form.control, name: "note" });

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 1));
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (fields.length === 0) return;
    goTo(Math.min(...fields.map(stepForField)));
    const first = errors[fields[0]];
    setMessage({
      tone: "error",
      text: first?.message ?? "Periksa kembali isian pada langkah ini.",
    });
  };

  const onSubmit = (values: PaymentInput) => {
    // Guard di klien sekadar bantuan; penegakan sisa ada di server.
    if (!isEdit && values.amount > debt.remainingAmount) {
      setMessage({
        tone: "error",
        text: `Nominal melebihi sisa hutang ${formatCurrencyIDR(debt.remainingAmount)}.`,
      });
      return;
    }

    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updatePaymentAction(payment!.id, values)
        : await createPaymentAction(debt.id, values);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal menyimpan pembayaran.",
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
  ) : debt.status === "lunas" ? null : (
    <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg text-xs">
      <HandCoins className="size-3.5" />
      Bayar
    </Button>
  );

  if (!trigger) return null;

  // Fallback [] bila prop belum siap agar .find/.map tidak crash.
  const safeAccounts = accounts ?? [];
  const accountName = (id?: string) =>
    safeAccounts.find((a) => a.id === id)?.name ?? "-";

  /** Isi nominal dengan sisa hutang sekaligus (tanpa ketik manual). */
  const fillRemaining = () => {
    if (debt.remainingAmount <= 0) return;
    setDisplayAmount(displayFromNumber(debt.remainingAmount));
    form.setValue("amount", debt.remainingAmount, { shouldValidate: true });
    if (message) setMessage(null);
  };

  const renderEditForm = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      className="space-y-4"
      noValidate
    >
      <Field data-invalid={!!form.formState.errors.amount}>
        <FieldContent>
          <AmountInput
            id={`payment-amount-edit-${payment?.id ?? debt.id}`}
            value={displayAmount}
            invalid={!!form.formState.errors.amount}
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

      <Field data-invalid={!!form.formState.errors.accountId}>
        <FieldContent>
          <Select
            value={selectedAccountId ?? ""}
            onValueChange={(v) =>
              form.setValue("accountId", v ?? "", { shouldValidate: true })
            }
          >
            <SelectTrigger className="h-10 w-full rounded-lg text-sm">
              <SelectValue placeholder="Akun penerima">
                {accountName(selectedAccountId)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {safeAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.accountId ? (
            <FieldError errors={[form.formState.errors.accountId]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.paymentDate}>
          <FieldContent>
            <Input
              type="date"
              className="h-10 rounded-lg text-sm"
              {...form.register("paymentDate")}
            />
            {form.formState.errors.paymentDate ? (
              <FieldError errors={[form.formState.errors.paymentDate]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.note}>
          <FieldContent>
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Catatan (opsional)"
              {...form.register("note")}
            />
            {form.formState.errors.note ? (
              <FieldError errors={[form.formState.errors.note]} className="text-xs" />
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
            <StepTitle title={`${debt.customerName} bayar hutang`} />
            <p className="text-xs text-muted-foreground">
              Sisa:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrencyIDR(debt.remainingAmount)}
              </span>{" "}
              dari total {formatCurrencyIDR(debt.totalAmount)}
            </p>
            <AmountInput
              id={`payment-amount-${debt.id}`}
              autoFocus
              value={displayAmount}
              invalid={!!form.formState.errors.amount}
              onChange={(display, numeric) => {
                setDisplayAmount(display);
                form.setValue("amount", numeric, { shouldValidate: false });
                if (message) setMessage(null);
              }}
              onEnter={() => goTo(1)}
            />
            {form.formState.errors.amount ? (
              <FieldError errors={[form.formState.errors.amount]} className="text-xs" />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-xl text-xs"
              disabled={debt.remainingAmount <= 0}
              onClick={fillRemaining}
            >
              <Check className="size-3.5" />
              Tandai Lunas
            </Button>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Akun Penerima
              </p>
              <OptionList
                value={selectedAccountId ?? ""}
                onChange={(id) => {
                  form.setValue("accountId", id, { shouldValidate: false });
                  if (message) setMessage(null);
                }}
                options={safeAccounts.map((a) => {
                  const meta = getAccountTypeMeta(a.type);
                  const Icon = meta.icon;
                  return {
                    id: a.id,
                    label: a.name,
                    hint: meta.label,
                    icon: <Icon className="size-5 shrink-0 text-muted-foreground" />,
                  };
                })}
                emptyTitle="Belum ada akun"
                emptyDescription="Buat akun dulu sebelum mencatat pembayaran."
              />
            </div>
          </div>
        );
      case 1: {
        const amount = Number(watchedAmount ?? 0);
        return (
          <div className="space-y-4">
            <StepTitle title="Tanggal & catatan" />
            <Input
              type="date"
              className="h-10 rounded-lg text-sm"
              {...form.register("paymentDate")}
            />
            {form.formState.errors.paymentDate ? (
              <FieldError errors={[form.formState.errors.paymentDate]} className="text-xs" />
            ) : null}
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Catatan (opsional)"
              {...form.register("note")}
            />
            <div>
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrencyIDR(Number.isFinite(amount) ? amount : 0)}
              </p>
              <dl className="mt-3 divide-y text-sm">
                <SummaryRow label="Pelanggan" value={debt.customerName} />
                <SummaryRow label="Masuk ke" value={accountName(selectedAccountId)} />
                <SummaryRow
                  label="Sisa setelah bayar"
                  value={formatCurrencyIDR(
                    Math.max(0, debt.remainingAmount - (Number.isFinite(amount) ? amount : 0)),
                  )}
                />
                <SummaryRow
                  label="Tanggal"
                  value={watchedDate ? formatDateID(watchedDate) : "-"}
                />
                {watchedNote ? <SummaryRow label="Catatan" value={watchedNote} /> : null}
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
      title={isEdit ? "Edit pembayaran" : "Catat pembayaran"}
      step={step}
      totalSteps={2}
      stepLabel={stepLabels[step] ?? ""}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan pembayaran"}
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
