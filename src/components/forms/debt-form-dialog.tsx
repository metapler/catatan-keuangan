"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HandCoins, Plus, ShoppingCart, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createDebtAction,
  createLoanAction,
  updateDebtAction,
  updateLoanAction,
} from "@/app/(dashboard)/debts/actions";
import { CustomerPicker } from "@/components/forms/customer-picker";
import { FormMessage } from "@/components/forms/form-message";
import { ProductTypePicker } from "@/components/forms/product-type-picker";
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
import {
  debtWizardSchema,
  type CreditSaleInput,
  type DebtWizardInput,
  type LoanInput,
} from "@/lib/validations/debts";
import {
  sortByUsageDesc,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";
import type { CustomerSummary } from "@/lib/queries/customers";
import type { DebtSummary } from "@/lib/queries/debts";
import type { ProductTypeSummary } from "@/lib/queries/product-types";
import type {
  TransactionOptionAccount,
  TransactionOptionCategory,
} from "@/lib/queries/transactions";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { getAccountTypeMeta } from "@/lib/utils/finance";

type DebtFormDialogProps = {
  debt?: DebtSummary;
  customers: CustomerSummary[];
  productTypes: ProductTypeSummary[];
  accounts: TransactionOptionAccount[];
  incomeCategories: TransactionOptionCategory[];
  expenseCategories: TransactionOptionCategory[];
  customerUsage?: UsageCount;
  productTypeUsage?: UsageCount;
  accountUsage?: UsageCount;
  incomeCategoryUsage?: UsageCount;
  expenseCategoryUsage?: UsageCount;
};

type DebtKind = "sale" | "loan";

const stepLabels: Record<DebtKind, string[]> = {
  sale: ["Pelanggan", "Tipe", "Modal", "Kategori", "Tanggal"],
  loan: ["Pelanggan", "Jumlah", "Kategori", "Tanggal"],
};

function stepForField(field: string, kind: DebtKind): number {
  if (kind === "loan") {
    if (field === "customerId") return 0;
    if (field === "loanAmount" || field === "costAccountId") return 1;
    if (
      field === "incomeCategoryId" ||
      field === "expenseCategoryId" ||
      field === "description"
    )
      return 2;
    if (field === "saleDate") return 3;
    return 3;
  }

  if (field === "customerId") return 0;
  if (field === "productTypeId") return 1;
  if (field === "costAmount" || field === "costAccountId") return 2;
  if (
    field === "sellAmount" ||
    field === "incomeCategoryId" ||
    field === "expenseCategoryId" ||
    field === "description"
  )
    return 3;
  if (field === "saleDate") return 4;
  return 4;
}

function toDateInputValue(dateValue?: string | null) {
  if (!dateValue) {
    return new Date().toISOString().slice(0, 10);
  }
  return dateValue.slice(0, 10);
}

export function DebtFormDialog({
  debt,
  customers,
  productTypes,
  accounts,
  incomeCategories,
  expenseCategories,
  customerUsage,
  productTypeUsage,
  accountUsage,
  incomeCategoryUsage,
  expenseCategoryUsage,
}: DebtFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Daftar lokal agar inline-add langsung bisa dipilih tanpa refresh.
  // Fallback [] bila prop belum siap agar .filter/.find tidak crash.
  const [localTypes, setLocalTypes] = useState<ProductTypeSummary[]>(productTypes ?? []);
  const [localCustomers, setLocalCustomers] = useState<CustomerSummary[]>(customers ?? []);

  // Merge by-id (bukan replace): picker mengirim subset terfilter + item baru,
  // sehingga item nonaktif yang ada di state lokal tidak boleh hilang.
  const mergeLocalTypes = (next: ProductTypeSummary[]) => {
    setLocalTypes((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      for (const t of next) map.set(t.id, t);
      return Array.from(map.values());
    });
  };
  const mergeLocalCustomers = (next: CustomerSummary[]) => {
    setLocalCustomers((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const c of next) map.set(c.id, c);
      return Array.from(map.values());
    });
  };

  const [displayCost, setDisplayCost] = useState(() =>
    displayFromNumber(debt?.costAmount ?? 0),
  );
  const [displaySell, setDisplaySell] = useState(() =>
    displayFromNumber(debt?.totalAmount ?? 0),
  );
  const [displayLoan, setDisplayLoan] = useState(() =>
    displayFromNumber(debt?.kind === "loan" ? debt.totalAmount : 0),
  );

  const isEdit = Boolean(debt);
  const editKind: DebtKind = debt?.kind === "loan" ? "loan" : "sale";

  const defaultValues = useMemo<DebtWizardInput>(
    () => ({
      kind: editKind,
      customerId: debt?.customerId ?? "",
      productTypeId: debt?.productTypeId ?? "",
      costAmount: debt?.costAmount ?? 0,
      sellAmount: debt?.totalAmount ?? 0,
      loanAmount: editKind === "loan" ? (debt?.totalAmount ?? 0) : 0,
      costAccountId: debt?.costAccountId ?? "",
      expenseCategoryId: debt?.expenseCategoryId ?? "",
      incomeCategoryId: debt?.incomeCategoryId ?? "",
      saleDate: toDateInputValue(debt?.saleDate),
      description: debt?.description ?? "",
    }),
    [debt, editKind],
  );

  const form = useForm<z.input<typeof debtWizardSchema>, unknown, DebtWizardInput>({
    resolver: zodResolver(debtWizardSchema),
    defaultValues,
  });

  // Inisialisasi HANYA pada transisi tertutup -> terbuka.
  // Guard ini mencegah revalidasi server (mis. setelah inline-add pelanggan/tipe)
  // yang mengalirkan props baru ikut me-reset step + form yang sedang diisi.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    setMessage(null);
    setStep(0);
    setDirection(1);
    form.reset(defaultValues);
    setLocalTypes(productTypes ?? []);
    setLocalCustomers(customers ?? []);
    setDisplayCost(displayFromNumber(debt?.costAmount ?? 0));
    setDisplaySell(displayFromNumber(debt?.totalAmount ?? 0));
    setDisplayLoan(displayFromNumber(debt?.kind === "loan" ? debt.totalAmount : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedCustomerId = useWatch({ control: form.control, name: "customerId" });
  const selectedProductTypeId = useWatch({ control: form.control, name: "productTypeId" });
  const selectedCostAccountId = useWatch({ control: form.control, name: "costAccountId" });
  const selectedIncomeCategoryId = useWatch({ control: form.control, name: "incomeCategoryId" });
  const selectedExpenseCategoryId = useWatch({ control: form.control, name: "expenseCategoryId" });
  const watchedCost = useWatch({ control: form.control, name: "costAmount" });
  const watchedSell = useWatch({ control: form.control, name: "sellAmount" });
  const watchedLoan = useWatch({ control: form.control, name: "loanAmount" });
  const watchedDate = useWatch({ control: form.control, name: "saleDate" });
  const watchedDescription = useWatch({ control: form.control, name: "description" });
  const watchedKind = useWatch({ control: form.control, name: "kind" });

  const kind: DebtKind = watchedKind === "loan" ? "loan" : "sale";
  const isLoan = kind === "loan";
  const totalSteps = isLoan ? 4 : 5;

  const safeCustomers = useMemo(() => localCustomers ?? [], [localCustomers]);
  const safeTypes = useMemo(() => localTypes ?? [], [localTypes]);
  const selectedCustomer = safeCustomers.find((c) => c.id === selectedCustomerId);
  // Filter dulu (item nonaktif yang sedang dipilih tetap tampil), lalu urutkan by frekuensi.
  const activeTypes = useMemo(() => {
    const filtered = safeTypes.filter(
      (t) => t.isActive || t.id === selectedProductTypeId,
    );
    return sortByUsageDesc(filtered, (t) => t.id, productTypeUsage);
  }, [safeTypes, selectedProductTypeId, productTypeUsage]);
  const activeCustomers = useMemo(() => {
    const filtered = safeCustomers.filter(
      (c) => c.isActive || c.id === selectedCustomerId,
    );
    return sortByUsageDesc(filtered, (c) => c.id, customerUsage);
  }, [safeCustomers, selectedCustomerId, customerUsage]);

  const sortedAccounts = useMemo(
    () => sortByUsageDesc(accounts ?? [], (a) => a.id, accountUsage),
    [accounts, accountUsage],
  );
  const sortedIncomeCategories = useMemo(
    () => sortByUsageDesc(incomeCategories ?? [], (c) => c.id, incomeCategoryUsage),
    [incomeCategories, incomeCategoryUsage],
  );
  const sortedExpenseCategories = useMemo(
    () => sortByUsageDesc(expenseCategories ?? [], (c) => c.id, expenseCategoryUsage),
    [expenseCategories, expenseCategoryUsage],
  );
  const selectedType = safeTypes.find((t) => t.id === selectedProductTypeId);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), totalSteps - 1));
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (fields.length === 0) return;
    goTo(Math.min(...fields.map((field) => stepForField(field, kind))));
    const first = errors[fields[0]];
    setMessage({
      tone: "error",
      text: first?.message ?? "Periksa kembali isian pada langkah ini.",
    });
  };

  const onSubmit = (values: DebtWizardInput) => {
    setPending(true);
    setMessage(null);

    // Nilai yang disubmit adalah sumber kebenaran, bukan nilai watch di UI.
    const isLoanSubmit = values.kind === "loan";

    if (isLoanSubmit) {
      const loanPayload: LoanInput = {
        customerId: values.customerId,
        loanAmount: values.loanAmount,
        sourceAccountId: values.costAccountId ?? "",
        expenseCategoryId: values.expenseCategoryId ?? "",
        incomeCategoryId: values.incomeCategoryId ?? "",
        loanDate: values.saleDate,
        description: values.description ?? "",
      };

      startTransition(async () => {
        const result = isEdit
          ? await updateLoanAction(debt!.id, loanPayload)
          : await createLoanAction(loanPayload);

        if (result.status === "error") {
          setMessage({
            tone: "error",
            text: result.message ?? "Gagal menyimpan pinjaman.",
          });
          setPending(false);
          return;
        }

        setPending(false);
        setOpen(false);
        form.reset(defaultValues);
        router.refresh();
      });
      return;
    }

    const creditPayload: CreditSaleInput = {
      customerId: values.customerId,
      productTypeId: values.productTypeId ?? "",
      costAmount: values.costAmount,
      sellAmount: values.sellAmount,
      costAccountId: values.costAccountId ?? "",
      expenseCategoryId: values.expenseCategoryId ?? "",
      incomeCategoryId: values.incomeCategoryId ?? "",
      saleDate: values.saleDate,
      description: values.description ?? "",
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateDebtAction(debt!.id, creditPayload)
        : await createDebtAction(creditPayload);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal menyimpan hutang.",
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
      Tambah hutang
    </Button>
  );

  const accountName = (id?: string) =>
    sortedAccounts.find((a) => a.id === id)?.name ?? "-";
  const incomeCategoryName = (id?: string) =>
    sortedIncomeCategories.find((c) => c.id === id)?.name ?? "-";
  const expenseCategoryName = (id?: string) =>
    sortedExpenseCategories.find((c) => c.id === id)?.name ?? "-";
  const typeName = (id?: string) =>
    safeTypes.find((t) => t.id === id)?.name ?? "-";

  const renderCustomerField = () => (
    <Field data-invalid={!!form.formState.errors.customerId}>
      <FieldContent>
        <Select
          value={selectedCustomerId ?? ""}
          onValueChange={(v) =>
            form.setValue("customerId", v ?? "", { shouldValidate: true })
          }
        >
          <SelectTrigger className="h-10 w-full rounded-lg text-sm">
            <SelectValue placeholder="Pilih pelanggan">
              {selectedCustomerId ? (selectedCustomer?.name ?? "-") : "Pilih pelanggan"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {activeCustomers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.customerId ? (
          <FieldError errors={[form.formState.errors.customerId]} className="text-xs" />
        ) : null}
      </FieldContent>
    </Field>
  );

  const renderEditForm = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      className="space-y-4"
      noValidate
    >
      {renderCustomerField()}

      <Field data-invalid={!!form.formState.errors.productTypeId}>
        <FieldContent>
          <Select
            value={selectedProductTypeId ?? ""}
            onValueChange={(v) =>
              form.setValue("productTypeId", v ?? "", { shouldValidate: true })
            }
          >
            <SelectTrigger className="h-10 w-full rounded-lg text-sm">
              <SelectValue placeholder="Pilih tipe">
                {selectedProductTypeId ? typeName(selectedProductTypeId) : "Pilih tipe"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {activeTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.productTypeId ? (
            <FieldError errors={[form.formState.errors.productTypeId]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.costAmount}>
          <FieldContent>
            <label className="text-xs font-medium text-muted-foreground">Modal</label>
            <AmountInput
              id={`debt-cost-edit-${debt?.id ?? "new"}`}
              value={displayCost}
              invalid={!!form.formState.errors.costAmount}
              onChange={(display, numeric) => {
                setDisplayCost(display);
                form.setValue("costAmount", numeric, { shouldValidate: true });
              }}
            />
            {form.formState.errors.costAmount ? (
              <FieldError errors={[form.formState.errors.costAmount]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.sellAmount}>
          <FieldContent>
            <label className="text-xs font-medium text-muted-foreground">
              Harga jual (= tagihan)
            </label>
            <AmountInput
              id={`debt-sell-edit-${debt?.id ?? "new"}`}
              value={displaySell}
              invalid={!!form.formState.errors.sellAmount}
              onChange={(display, numeric) => {
                setDisplaySell(display);
                form.setValue("sellAmount", numeric, { shouldValidate: true });
              }}
            />
            {form.formState.errors.sellAmount ? (
              <FieldError errors={[form.formState.errors.sellAmount]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>

      <Field data-invalid={!!form.formState.errors.costAccountId}>
        <FieldContent>
          <Select
            value={selectedCostAccountId ?? ""}
            onValueChange={(v) =>
              form.setValue("costAccountId", v ?? "", { shouldValidate: true })
            }
          >
            <SelectTrigger className="h-10 w-full rounded-lg text-sm">
              <SelectValue placeholder="Akun Sumber">
                {accountName(selectedCostAccountId)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortedAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.costAccountId ? (
            <FieldError errors={[form.formState.errors.costAccountId]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.expenseCategoryId}>
          <FieldContent>
            <Select
              value={selectedExpenseCategoryId ?? ""}
              onValueChange={(v) =>
                form.setValue("expenseCategoryId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Kategori modal">
                  {expenseCategoryName(selectedExpenseCategoryId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedExpenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.expenseCategoryId ? (
              <FieldError errors={[form.formState.errors.expenseCategoryId]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.incomeCategoryId}>
          <FieldContent>
            <Select
              value={selectedIncomeCategoryId ?? ""}
              onValueChange={(v) =>
                form.setValue("incomeCategoryId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Kategori jual">
                  {incomeCategoryName(selectedIncomeCategoryId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedIncomeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.incomeCategoryId ? (
              <FieldError errors={[form.formState.errors.incomeCategoryId]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.description}>
          <FieldContent>
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Deskripsi (opsional)"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <FieldError errors={[form.formState.errors.description]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.saleDate}>
          <FieldContent>
            <Input
              type="date"
              className="h-10 rounded-lg text-sm"
              {...form.register("saleDate")}
            />
            {form.formState.errors.saleDate ? (
              <FieldError errors={[form.formState.errors.saleDate]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>
    </form>
  );

  const renderLoanEditForm = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      className="space-y-4"
      noValidate
    >
      {renderCustomerField()}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.loanAmount}>
          <FieldContent>
            <label className="text-xs font-medium text-muted-foreground">
              Jumlah pinjaman (= tagihan)
            </label>
            <AmountInput
              id={`debt-loan-edit-${debt?.id ?? "new"}`}
              value={displayLoan}
              invalid={!!form.formState.errors.loanAmount}
              onChange={(display, numeric) => {
                setDisplayLoan(display);
                form.setValue("loanAmount", numeric, { shouldValidate: true });
              }}
            />
            {form.formState.errors.loanAmount ? (
              <FieldError errors={[form.formState.errors.loanAmount]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.costAccountId}>
          <FieldContent>
            <label className="text-xs font-medium text-muted-foreground">Akun sumber</label>
            <Select
              value={selectedCostAccountId ?? ""}
              onValueChange={(v) =>
                form.setValue("costAccountId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Akun sumber">
                  {accountName(selectedCostAccountId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.costAccountId ? (
              <FieldError errors={[form.formState.errors.costAccountId]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.expenseCategoryId}>
          <FieldContent>
            <Select
              value={selectedExpenseCategoryId ?? ""}
              onValueChange={(v) =>
                form.setValue("expenseCategoryId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Kategori pinjaman">
                  {expenseCategoryName(selectedExpenseCategoryId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedExpenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.expenseCategoryId ? (
              <FieldError errors={[form.formState.errors.expenseCategoryId]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.incomeCategoryId}>
          <FieldContent>
            <Select
              value={selectedIncomeCategoryId ?? ""}
              onValueChange={(v) =>
                form.setValue("incomeCategoryId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Kategori cicilan">
                  {incomeCategoryName(selectedIncomeCategoryId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedIncomeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.incomeCategoryId ? (
              <FieldError errors={[form.formState.errors.incomeCategoryId]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!form.formState.errors.description}>
          <FieldContent>
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Deskripsi (opsional)"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <FieldError errors={[form.formState.errors.description]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.saleDate}>
          <FieldContent>
            <Input
              type="date"
              className="h-10 rounded-lg text-sm"
              {...form.register("saleDate")}
            />
            {form.formState.errors.saleDate ? (
              <FieldError errors={[form.formState.errors.saleDate]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
      </div>
    </form>
  );

  const renderKindStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Jenis Hutang</p>
        <OptionList
          value={kind}
          onChange={(id) => {
            form.setValue("kind", id === "loan" ? "loan" : "sale", {
              shouldValidate: false,
            });
            if (message) setMessage(null);
          }}
          options={[
            {
              id: "sale",
              label: "Produk",
              icon: <ShoppingCart className="size-5 shrink-0 text-muted-foreground" />,
            },
            {
              id: "loan",
              label: "Pinjaman Uang",
              icon: <HandCoins className="size-5 shrink-0 text-muted-foreground" />,
            },
          ]}
        />
      </div>
      <div className="space-y-2">
        <StepTitle title="Pelanggan" />
        <CustomerPicker
          value={selectedCustomerId ?? ""}
          customers={activeCustomers}
          fieldError={form.formState.errors.customerId}
          onChange={(id) => {
            form.setValue("customerId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          onCustomersChanged={mergeLocalCustomers}
        />
      </div>
    </div>
  );

  const renderSaleTypeStep = () => (
    <div className="space-y-4">
      <StepTitle title="Tipe produk" />
      <ProductTypePicker
        value={selectedProductTypeId ?? ""}
        productTypes={activeTypes}
        fieldError={form.formState.errors.productTypeId}
        onChange={(id) => {
          form.setValue("productTypeId", id, { shouldValidate: false });
          if (message) setMessage(null);
        }}
        onTypesChanged={mergeLocalTypes}
      />
    </div>
  );

  const renderSaleModalStep = () => (
    <div className="space-y-4">
      <StepTitle title="Modal" />
      <AmountInput
        id={`debt-cost-${debt?.id ?? "new"}`}
        autoFocus
        value={displayCost}
        invalid={!!form.formState.errors.costAmount}
        onChange={(display, numeric) => {
          setDisplayCost(display);
          form.setValue("costAmount", numeric, { shouldValidate: false });
          if (message) setMessage(null);
        }}
        onEnter={() => goTo(step + 1)}
      />
      {form.formState.errors.costAmount ? (
        <FieldError errors={[form.formState.errors.costAmount]} className="text-xs" />
      ) : null}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Akun Sumber
        </p>
        <OptionList
          value={selectedCostAccountId ?? ""}
          onChange={(id) => {
            form.setValue("costAccountId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          options={sortedAccounts.map((a) => {
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
          emptyDescription="Buat akun dulu sebelum mencatat hutang."
        />
      </div>
    </div>
  );

  const renderLoanAmountStep = () => (
    <div className="space-y-4">
      <StepTitle title="Jumlah pinjaman" />
      <AmountInput
        id={`debt-loan-${debt?.id ?? "new"}`}
        autoFocus
        value={displayLoan}
        invalid={!!form.formState.errors.loanAmount}
        onChange={(display, numeric) => {
          setDisplayLoan(display);
          form.setValue("loanAmount", numeric, { shouldValidate: false });
          if (message) setMessage(null);
        }}
        onEnter={() => goTo(step + 1)}
      />
      {form.formState.errors.loanAmount ? (
        <FieldError errors={[form.formState.errors.loanAmount]} className="text-xs" />
      ) : null}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          AKUN SUMBER
        </p>
        <OptionList
          value={selectedCostAccountId ?? ""}
          onChange={(id) => {
            form.setValue("costAccountId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          options={sortedAccounts.map((a) => {
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
          emptyDescription="Buat akun dulu sebelum mencatat pinjaman."
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Uang langsung keluar dari akun ini saat pinjaman diserahkan.
      </p>
    </div>
  );

  const renderCategoryPickers = ({ credit }: { credit: boolean }) => (
    <div className="grid gap-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {credit ? "Kategori (Expanse)" : "Kategori (Expanse)"}
        </p>
        <OptionList
          value={selectedExpenseCategoryId ?? ""}
          onChange={(id) => {
            form.setValue("expenseCategoryId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          options={sortedExpenseCategories.map((c) => ({
            id: c.id,
            label: c.name,
            color: c.color,
          }))}
          emptyTitle="Belum ada kategori expense"
          emptyDescription="Buat kategori HPP / Modal dulu."
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {credit ? "Kategori (Income)" : "Kategori (Income)"}
        </p>
        <OptionList
          value={selectedIncomeCategoryId ?? ""}
          onChange={(id) => {
            form.setValue("incomeCategoryId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          options={sortedIncomeCategories.map((c) => ({
            id: c.id,
            label: c.name,
            color: c.color,
          }))}
          emptyTitle="Belum ada kategori income"
          emptyDescription="Buat kategori Penjualan dulu."
        />
      </div>
    </div>
  );

  const renderDescriptionField = () => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Deskripsi (opsional)
      </label>
      <Input
        className="h-10 rounded-lg text-sm"
        placeholder="Cicilan"
        {...form.register("description")}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            goTo(totalSteps - 1);
          }
        }}
      />
      {form.formState.errors.description ? (
        <FieldError errors={[form.formState.errors.description]} className="text-xs" />
      ) : null}
    </div>
  );

  const renderSaleCategoryStep = () => (
    <div className="space-y-4">
      <StepTitle title="Tagihan & kategori" />
      <div>
        <AmountInput
          id={`debt-sell-${debt?.id ?? "new"}`}
          autoFocus
          value={displaySell}
          invalid={!!form.formState.errors.sellAmount}
          onChange={(display, numeric) => {
            setDisplaySell(display);
            form.setValue("sellAmount", numeric, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          onEnter={() => goTo(step + 1)}
        />
        {form.formState.errors.sellAmount ? (
          <FieldError errors={[form.formState.errors.sellAmount]} className="text-xs" />
        ) : null}
      </div>
      {renderCategoryPickers({ credit: false })}
      {renderDescriptionField()}
    </div>
  );

  const renderLoanCategoryStep = () => (
    <div className="space-y-4">
      <StepTitle title="Kategori" />
      {renderCategoryPickers({ credit: true })}
      {renderDescriptionField()}
    </div>
  );

  const renderDateSummaryStep = () => {
    const sale = Number(watchedSell ?? 0);
    const loan = Number(watchedLoan ?? 0);
    const displayTotal = isLoan ? loan : sale;

    return (
      <div className="space-y-4">
        <StepTitle title="Tanggal & ringkasan" />
        <Input
          type="date"
          className="h-10 rounded-lg text-sm"
          {...form.register("saleDate")}
        />
        {form.formState.errors.saleDate ? (
          <FieldError errors={[form.formState.errors.saleDate]} className="text-xs" />
        ) : null}
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {formatCurrencyIDR(Number.isFinite(displayTotal) ? displayTotal : 0)}
          </p>
          <dl className="mt-3 divide-y text-sm">
            <SummaryRow label="Jenis" value={isLoan ? "Pinjaman Uang" : "Produk"} />
            <SummaryRow label="Pelanggan" value={selectedCustomer?.name ?? "-"} />
            {!isLoan ? (
              <SummaryRow label="Tipe" value={selectedType?.name ?? "-"} />
            ) : null}
            <SummaryRow
              label={isLoan ? "Akun sumber" : "Modal"}
              value={
                isLoan
                  ? accountName(selectedCostAccountId)
                  : `${formatCurrencyIDR(Number.isFinite(Number(watchedCost)) ? Number(watchedCost) : 0)} · ${accountName(selectedCostAccountId)}`
              }
            />
            <SummaryRow
              label="Tanggal"
              value={watchedDate ? formatDateID(watchedDate) : "-"}
            />
            {watchedDescription ? (
              <SummaryRow label="Catatan" value={watchedDescription} />
            ) : null}
          </dl>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    if (isEdit) {
      return editKind === "loan" ? renderLoanEditForm() : renderEditForm();
    }

    switch (step) {
      case 0:
        return renderKindStep();
      case 1:
        return isLoan ? renderLoanAmountStep() : renderSaleTypeStep();
      case 2:
        return isLoan ? renderLoanCategoryStep() : renderSaleModalStep();
      case 3:
        return isLoan ? renderDateSummaryStep() : renderSaleCategoryStep();
      case 4:
        return renderDateSummaryStep();
      default:
        return null;
    }
  };

  return (
    <WizardShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={isEdit ? "Edit hutang" : "Tambah hutang"}
      step={step}
      totalSteps={totalSteps}
      stepLabel={stepLabels[kind][step] ?? ""}
      direction={direction}
      pending={pending}
      submitLabel={
        isEdit ? "Simpan perubahan" : isLoan ? "Simpan pinjaman" : "Simpan hutang"
      }
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
