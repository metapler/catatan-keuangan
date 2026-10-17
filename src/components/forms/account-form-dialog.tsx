"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Banknote,
  Bitcoin,
  Landmark,
  Layers,
  PiggyBank,
  Plus,
  ReceiptText,
  SquarePen,
  Wallet,
} from "lucide-react";
import { z } from "zod";

import {
  createAccountAction,
  updateAccountAction,
} from "@/app/(dashboard)/accounts/actions";
import { FormMessage } from "@/components/forms/form-message";
import { AmountInput } from "@/components/forms/wizard/amount-input";
import { WizardShell } from "@/components/forms/wizard/wizard-shell";
import { displayFromNumber } from "@/components/forms/wizard/format";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  accountSchema,
  type AccountInput,
} from "@/lib/validations/accounts";
import {
  sortByUsageDesc,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";
import {
  accountTypeLabel,
  BUILTIN_ACCOUNT_TYPE_OPTIONS,
  type AccountTypeOption,
} from "@/lib/utils/account-types";
import type { AccountSummary } from "@/lib/queries/accounts";
import { formatCurrencyIDR } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const builtinTypeIcons: Record<string, typeof Banknote> = {
  cash: Banknote,
  bank: Landmark,
  ewallet: Wallet,
  savings: PiggyBank,
  crypto: Bitcoin,
  hutang: ReceiptText,
};

function iconForType(option: AccountTypeOption) {
  return builtinTypeIcons[option.value] ?? Layers;
}

const stepLabels = ["Nama", "Tipe", "Saldo"];

function stepForField(field: string): number {
  if (field === "name") return 0;
  if (field === "type") return 1;
  if (field === "initialBalance") return 2;
  return 2;
}

export function AccountFormDialog({
  account,
  typeUsage,
  accountTypes,
}: {
  account?: AccountSummary;
  typeUsage?: UsageCount;
  accountTypes?: AccountTypeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [displayBalance, setDisplayBalance] = useState(() =>
    displayFromNumber(account?.initialBalance ?? 0),
  );
  const [localTypes, setLocalTypes] = useState<AccountTypeOption[]>(
    () => accountTypes ?? BUILTIN_ACCOUNT_TYPE_OPTIONS,
  );
  const [newTypeName, setNewTypeName] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);

  const isEdit = Boolean(account);

  const defaultValues = useMemo<AccountInput>(
    () => ({
      name: account?.name ?? "",
      type: account?.type ?? "cash",
      initialBalance: account?.initialBalance ?? 0,
    }),
    [account],
  );

  const form = useForm<z.input<typeof accountSchema>, unknown, AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
      setDisplayBalance(displayFromNumber(account?.initialBalance ?? 0));
      setLocalTypes(accountTypes ?? BUILTIN_ACCOUNT_TYPE_OPTIONS);
      setNewTypeName("");
      setTypeError(null);
    }
  }, [open, account, defaultValues, form, accountTypes]);

  const selectedType = useWatch({ control: form.control, name: "type" });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedBalance = useWatch({ control: form.control, name: "initialBalance" });

  // Tipe akun diurutkan by jumlah pemakaian (desc); tipe baru ikut ke daftar.
  const sortedTypeOptions = useMemo(
    () => sortByUsageDesc(localTypes, (option) => option.value, typeUsage),
    [localTypes, typeUsage],
  );

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 2));
  };

  const pickType = (value: string) => {
    form.setValue("type", value, { shouldValidate: true });
    setTypeError(null);
    if (message) setMessage(null);
  };

  const handleAddType = () => {
    const name = newTypeName.trim();
    if (!name) {
      setTypeError("Isi nama tipe dulu.");
      return;
    }
    if (name.length > 50) {
      setTypeError("Nama tipe terlalu panjang (maks 50 karakter).");
      return;
    }
    const key = name.toLowerCase();
    const exists = localTypes.some(
      (option) =>
        option.value.toLowerCase() === key ||
        option.label.toLowerCase() === key,
    );
    if (exists) {
      setTypeError("Tipe akun sudah ada.");
      return;
    }

    setTypeError(null);
    setLocalTypes((prev) => [
      ...prev,
      { value: name, label: accountTypeLabel(name), isBuiltin: false },
    ]);
    form.setValue("type", name, { shouldValidate: true });
    form.clearErrors("type");
    setNewTypeName("");
    if (message) setMessage(null);
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (!fields.length) return;
    goTo(Math.min(...fields.map(stepForField)));
    const first = errors[fields[0]];
    setMessage({ tone: "error", text: first?.message ?? "Periksa kembali isian pada langkah ini." });
  };

  const onSubmit = (values: AccountInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateAccountAction(account!.id, values)
        : await createAccountAction(values);

      if (result.status === "error") {
        setMessage({ tone: "error", text: result.message ?? "Gagal menyimpan akun." });
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
      Tambah akun
    </Button>
  );

  const typeLabel = accountTypeLabel(selectedType ?? "");

  const renderTypeCreator = () => (
    <div className="rounded-2xl border border-dashed p-3">
      <p className="text-xs font-semibold">Tipe baru</p>
      <div className="mt-2 flex gap-2">
        <Input
          value={newTypeName}
          onChange={(e) => {
            setNewTypeName(e.target.value);
            if (typeError) setTypeError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddType();
            }
          }}
          placeholder="mis. Investasi"
          className="h-10 rounded-lg text-sm"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddType}
          className="h-10 shrink-0 gap-1 rounded-xl text-xs"
        >
          <Plus className="size-3.5" />
          Tambah
        </Button>
      </div>
      {typeError ? (
        <div className="mt-2">
          <FormMessage tone="error" message={typeError} />
        </div>
      ) : null}
    </div>
  );

  const renderEditForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)} className="space-y-4" noValidate>
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldContent>
          <Input
            placeholder="BCA Utama"
            className="h-10 rounded-lg text-sm"
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <FieldError errors={[form.formState.errors.name]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        {sortedTypeOptions.map((option) => {
          const Icon = iconForType(option);
          const active = selectedType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => pickType(option.value)}
              className={cn(
                "flex min-h-[52px] items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="text-xs font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
      {renderTypeCreator()}
      {form.formState.errors.type ? (
        <FieldError errors={[form.formState.errors.type]} className="text-xs" />
      ) : null}

      <Field data-invalid={!!form.formState.errors.initialBalance}>
        <FieldContent>
          <AmountInput
            id="account-balance-edit"
            value={displayBalance}
            onChange={(display, numeric) => {
              setDisplayBalance(display);
              form.setValue("initialBalance", numeric, { shouldValidate: true });
            }}
          />
          {form.formState.errors.initialBalance ? (
            <FieldError errors={[form.formState.errors.initialBalance]} className="text-xs" />
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
            <StepTitle title="Nama akun" />
            <Input
              autoFocus
              className="h-10 rounded-lg text-sm"
              placeholder="BCA Utama"
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
            <StepTitle title="Tipe akun" />
            <div className="grid gap-2">
              {sortedTypeOptions.map((option) => {
                const Icon = iconForType(option);
                const active = selectedType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => pickType(option.value)}
                    className={cn(
                      "flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="text-sm font-semibold">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {renderTypeCreator()}
            {form.formState.errors.type ? (
              <FieldError errors={[form.formState.errors.type]} className="text-xs" />
            ) : null}
          </div>
        );
      case 2: {
        const balance = Number(watchedBalance ?? 0);
        return (
          <div className="space-y-4">
            <StepTitle title="Saldo awal" />
            <AmountInput
              id="account-balance"
              autoFocus
              value={displayBalance}
              invalid={!!form.formState.errors.initialBalance}
              onChange={(display, numeric) => {
                setDisplayBalance(display);
                form.setValue("initialBalance", numeric, { shouldValidate: false });
                if (message) setMessage(null);
              }}
              onEnter={() => form.handleSubmit(onSubmit, handleInvalid)()}
            />
            {form.formState.errors.initialBalance ? (
              <FieldError errors={[form.formState.errors.initialBalance]} className="text-xs" />
            ) : null}
            <div className="text-sm">
              <p className="text-lg font-bold">{formatCurrencyIDR(Number.isFinite(balance) ? balance : 0)}</p>
              <dl className="mt-2 divide-y">
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-muted-foreground">Nama</dt>
                  <dd className="truncate text-right font-medium">{watchedName || "—"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <dt className="shrink-0 text-muted-foreground">Tipe</dt>
                  <dd className="truncate text-right font-medium">{typeLabel}</dd>
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
      title={isEdit ? "Edit akun" : "Tambah akun"}
      step={step}
      totalSteps={3}
      stepLabel={stepLabels[step]}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan akun"}
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
