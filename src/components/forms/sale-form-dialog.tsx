"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HandCoins, Plus, ShoppingCart, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createSaleAction,
  updateSaleAction,
} from "@/app/(dashboard)/sales/actions";
import { createDebtAction } from "@/app/(dashboard)/debts/actions";
import { CustomerPicker } from "@/components/forms/customer-picker";
import { FormMessage } from "@/components/forms/form-message";
import { ProductTypePicker } from "@/components/forms/product-type-picker";
import { AmountInput } from "@/components/forms/wizard/amount-input";
import { displayFromNumber } from "@/components/forms/wizard/format";
import { OptionList } from "@/components/forms/wizard/option-list";
import { WizardShell } from "@/components/forms/wizard/wizard-shell";
import { Button } from "@/components/ui/button";
import { ArrowSeparator } from "@/components/ui/arrow-separator";
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
  saleWizardSchema,
  type SaleInput,
  type SaleWizardInput,
} from "@/lib/validations/sales";
import type { CreditSaleInput } from "@/lib/validations/debts";
import {
  sortByUsageDesc,
  type UsageCount,
} from "@/lib/utils/sort-by-usage";
import type { CustomerSummary } from "@/lib/queries/customers";
import type { ProductTypeSummary } from "@/lib/queries/product-types";
import type { SaleSummary } from "@/lib/queries/sales";
import type {
  TransactionOptionAccount,
  TransactionOptionCategory,
} from "@/lib/queries/transactions";
import { formatCurrencyIDR, formatDateID } from "@/lib/utils/format";
import { getAccountTypeMeta } from "@/lib/utils/finance";
import { cn } from "@/lib/utils";

type SaleFormDialogProps = {
  sale?: SaleSummary;
  productTypes: ProductTypeSummary[];
  accounts: TransactionOptionAccount[];
  incomeCategories: TransactionOptionCategory[];
  expenseCategories: TransactionOptionCategory[];
  customers?: CustomerSummary[];
  customerUsage?: UsageCount;
  productTypeUsage?: UsageCount;
  accountUsage?: UsageCount;
  incomeCategoryUsage?: UsageCount;
  expenseCategoryUsage?: UsageCount;
};

type PaymentType = "lunas" | "hutang";

const stepLabels: Record<PaymentType, string[]> = {
  lunas: ["Tipe", "Modal", "Jual", "Kategori", "Tanggal"],
  hutang: ["Tipe", "Pelanggan", "Modal", "Tagihan", "Tanggal"],
};

function stepForField(field: string, paymentType: PaymentType): number {
  if (paymentType === "hutang") {
    if (field === "productTypeId") return 0;
    if (field === "customerId") return 1;
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

  if (field === "productTypeId") return 0;
  if (field === "costAmount" || field === "costAccountId") return 1;
  if (field === "sellAmount" || field === "incomeAccountId") return 2;
  if (
    field === "incomeCategoryId" ||
    field === "expenseCategoryId" ||
    field === "customerRef" ||
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

export function SaleFormDialog({
  sale,
  productTypes,
  accounts,
  incomeCategories,
  expenseCategories,
  customers,
  customerUsage,
  productTypeUsage,
  accountUsage,
  incomeCategoryUsage,
  expenseCategoryUsage,
}: SaleFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Daftar tipe lokal agar inline-add langsung bisa dipilih tanpa refresh.
  // Fallback [] bila prop belum siap (mis. bundle stale) agar .filter/.find tidak crash.
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
    displayFromNumber(sale?.cost_amount ?? 0),
  );
  const [displaySell, setDisplaySell] = useState(() =>
    displayFromNumber(sale?.sell_amount ?? 0),
  );

  const isEdit = Boolean(sale);

  const defaultValues = useMemo<SaleWizardInput>(
    () => ({
      paymentType: "lunas",
      productTypeId: sale?.product_type_id ?? "",
      costAmount: sale?.cost_amount ?? 0,
      sellAmount: sale?.sell_amount ?? 0,
      costAccountId: sale?.cost_account_id ?? "",
      incomeAccountId: sale?.income_account_id ?? "",
      customerId: "",
      incomeCategoryId: sale?.income_category_id ?? "",
      expenseCategoryId: sale?.expense_category_id ?? "",
      saleDate: toDateInputValue(sale?.sale_date),
      customerRef: sale?.customer_ref ?? "",
      description: sale?.description ?? "",
    }),
    [sale],
  );

  const form = useForm<z.input<typeof saleWizardSchema>, unknown, SaleWizardInput>({
    resolver: zodResolver(saleWizardSchema),
    defaultValues,
  });

  // Inisialisasi HANYA pada transisi tertutup -> terbuka.
  // Guard ini mencegah revalidasi server (mis. setelah inline-add tipe produk/pelanggan)
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
    setDisplayCost(displayFromNumber(sale?.cost_amount ?? 0));
    setDisplaySell(displayFromNumber(sale?.sell_amount ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedProductTypeId = useWatch({ control: form.control, name: "productTypeId" });
  const selectedCostAccountId = useWatch({ control: form.control, name: "costAccountId" });
  const selectedIncomeAccountId = useWatch({ control: form.control, name: "incomeAccountId" });
  const selectedIncomeCategoryId = useWatch({ control: form.control, name: "incomeCategoryId" });
  const selectedExpenseCategoryId = useWatch({ control: form.control, name: "expenseCategoryId" });
  const watchedCost = useWatch({ control: form.control, name: "costAmount" });
  const watchedSell = useWatch({ control: form.control, name: "sellAmount" });
  const watchedDate = useWatch({ control: form.control, name: "saleDate" });
  const watchedCustomerRef = useWatch({ control: form.control, name: "customerRef" });
  const watchedDescription = useWatch({ control: form.control, name: "description" });
  const watchedCustomerId = useWatch({ control: form.control, name: "customerId" });
  const watchedPaymentType = useWatch({ control: form.control, name: "paymentType" });
  const paymentType: PaymentType = watchedPaymentType === "hutang" ? "hutang" : "lunas";
  const isCredit = !isEdit && paymentType === "hutang";

  const safeTypes = useMemo(() => localTypes ?? [], [localTypes]);
  // Filter dulu (item nonaktif yang sedang dipilih tetap tampil), lalu urutkan by frekuensi.
  const activeTypes = useMemo(() => {
    const filtered = safeTypes.filter(
      (t) => t.isActive || t.id === selectedProductTypeId,
    );
    return sortByUsageDesc(filtered, (t) => t.id, productTypeUsage);
  }, [safeTypes, selectedProductTypeId, productTypeUsage]);
  const selectedType = safeTypes.find((t) => t.id === selectedProductTypeId);
  const profit = Number(watchedSell ?? 0) - Number(watchedCost ?? 0);

  const safeCustomers = useMemo(() => localCustomers ?? [], [localCustomers]);
  const activeCustomers = useMemo(() => {
    const filtered = safeCustomers.filter(
      (c) => c.isActive || c.id === watchedCustomerId,
    );
    return sortByUsageDesc(filtered, (c) => c.id, customerUsage);
  }, [safeCustomers, watchedCustomerId, customerUsage]);
  const selectedCustomer = safeCustomers.find((c) => c.id === watchedCustomerId);

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

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 4));
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (fields.length === 0) return;
    goTo(Math.min(...fields.map((field) => stepForField(field, paymentType))));
    const first = errors[fields[0]];
    setMessage({
      tone: "error",
      text: first?.message ?? "Periksa kembali isian pada langkah ini.",
    });
  };

  const onSubmit = (values: SaleWizardInput) => {
    setPending(true);
    setMessage(null);

    // Nilai yang disubmit adalah sumber kebenaran, bukan nilai watch di UI.
    const isCreditSubmit = !isEdit && values.paymentType === "hutang";

    const cashPayload: SaleInput = {
      productTypeId: values.productTypeId,
      costAmount: values.costAmount,
      sellAmount: values.sellAmount,
      costAccountId: values.costAccountId,
      incomeAccountId: values.incomeAccountId ?? "",
      incomeCategoryId: values.incomeCategoryId,
      expenseCategoryId: values.expenseCategoryId,
      saleDate: values.saleDate,
      customerRef: values.customerRef ?? "",
      description: values.description ?? "",
    };

    const creditPayload: CreditSaleInput = {
      customerId: values.customerId ?? "",
      productTypeId: values.productTypeId,
      costAmount: values.costAmount,
      sellAmount: values.sellAmount,
      costAccountId: values.costAccountId,
      expenseCategoryId: values.expenseCategoryId,
      incomeCategoryId: values.incomeCategoryId,
      saleDate: values.saleDate,
      description: values.description ?? "",
    };

    startTransition(async () => {
      const result = isCreditSubmit
        ? await createDebtAction(creditPayload)
        : isEdit
          ? await updateSaleAction(sale!.id, cashPayload)
          : await createSaleAction(cashPayload);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text:
            result.message ??
            (isCreditSubmit
              ? "Gagal menyimpan penjualan hutang."
              : "Gagal menyimpan penjualan."),
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
      Tambah penjualan
    </Button>
  );

  const accountName = (id?: string) =>
    sortedAccounts.find((a) => a.id === id)?.name ?? "-";
  const incomeCategoryName = (id?: string) =>
    sortedIncomeCategories.find((c) => c.id === id)?.name ?? "-";
  const expenseCategoryName = (id?: string) =>
    sortedExpenseCategories.find((c) => c.id === id)?.name ?? "-";

  const typeName = (id?: string) =>
    (localTypes ?? []).find((t) => t.id === id)?.name ?? "-";

  const renderEditForm = () => (
    <form
      onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      className="space-y-4"
      noValidate
    >
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
              id="sale-cost-edit"
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
            <label className="text-xs font-medium text-muted-foreground">Harga jual</label>
            <AmountInput
              id="sale-sell-edit"
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

      <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
        Modal dibayar nanti? Pilih akun Hutang Dagang. Lunasi belakangan via
        Transfer (mis. BRI <ArrowSeparator /> Hutang Dagang).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
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
        <Field data-invalid={!!form.formState.errors.incomeAccountId}>
          <FieldContent>
            <Select
              value={selectedIncomeAccountId ?? ""}
              onValueChange={(v) =>
                form.setValue("incomeAccountId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                <SelectValue placeholder="Akun terima">
                  {accountName(selectedIncomeAccountId)}
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
            {form.formState.errors.incomeAccountId ? (
              <FieldError errors={[form.formState.errors.incomeAccountId]} className="text-xs" />
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
        <Field data-invalid={!!form.formState.errors.customerRef}>
          <FieldContent>
            <Input
              className="h-10 rounded-lg text-sm"
              placeholder="Referensi (opsional)"
              {...form.register("customerRef")}
            />
            {form.formState.errors.customerRef ? (
              <FieldError errors={[form.formState.errors.customerRef]} className="text-xs" />
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

      <ProfitPreview profit={profit} />
    </form>
  );

  const renderCostStep = () => (
    <div className="space-y-4">
      <StepTitle title={paymentType === "hutang" ? "Modal" : "Modal"} />
      <AmountInput
        id="sale-cost"
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
          Sumber Akun
        </p>
        <OptionList
          value={selectedCostAccountId ?? ""}
          onChange={(id) => {
            form.setValue("costAccountId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          options={sortedAccounts.map(accountOption)}
          emptyTitle="Belum ada akun"
          emptyDescription="Buat akun dulu sebelum mencatat penjualan."
        />
      </div>
    </div>
  );

  const renderSellStep = () => (
    <div className="space-y-4">
      <StepTitle title="Harga jual" />
      <AmountInput
        id="sale-sell"
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
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Akun Penerima
        </p>
        <OptionList
          value={selectedIncomeAccountId ?? ""}
          onChange={(id) => {
            form.setValue("incomeAccountId", id, { shouldValidate: false });
            if (message) setMessage(null);
          }}
          options={sortedAccounts.map(accountOption)}
          emptyTitle="Belum ada akun"
          emptyDescription="Buat akun dulu sebelum mencatat penjualan."
        />
      </div>
      <ProfitPreview profit={profit} />
    </div>
  );

  const renderCustomerStep = () => (
    <div className="space-y-4">
      <StepTitle title="Pelanggan" />
      <CustomerPicker
        value={watchedCustomerId ?? ""}
        customers={activeCustomers}
        fieldError={form.formState.errors.customerId}
        onChange={(id) => {
          form.setValue("customerId", id, { shouldValidate: false });
          if (message) setMessage(null);
        }}
        onCustomersChanged={mergeLocalCustomers}
      />
    </div>
  );

  const renderExpenseCategoryPicker = () => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        Kategori (Expense)
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
        emptyDescription="Buat kategori HPP / Modal Penjualan dulu."
      />
    </div>
  );

  const renderIncomeCategoryPicker = ({ credit }: { credit: boolean }) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        {credit ? "Kategori Penjualan (Income)" : "Kategori Penjualan (Income)"}
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
  );

  const renderDescriptionField = () => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Deskripsi (opsional)
      </label>
      <Input
        className="h-10 rounded-lg text-sm"
        placeholder="mis. Wowo"
        {...form.register("description")}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            goTo(4);
          }
        }}
      />
      {form.formState.errors.description ? (
        <FieldError errors={[form.formState.errors.description]} className="text-xs" />
      ) : null}
    </div>
  );

  const renderStep = () => {
    if (isEdit) return renderEditForm();

    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Cara Pembayaran
              </p>
              <OptionList
                value={paymentType}
                onChange={(id) => {
                  form.setValue("paymentType", id === "hutang" ? "hutang" : "lunas", {
                    shouldValidate: false,
                  });
                  if (message) setMessage(null);
                }}
                options={[
                  {
                    id: "lunas",
                    label: "Lunas",
                    hint: "Bayar langsung",
                    icon: <ShoppingCart className="size-5 shrink-0 text-muted-foreground" />,
                  },
                  {
                    id: "hutang",
                    label: "Hutang",
                    hint: "Bayar nanti",
                    icon: <HandCoins className="size-5 shrink-0 text-muted-foreground" />,
                  },
                ]}
              />
            </div>
            <div className="space-y-2">
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
          </div>
        );
      case 1:
        return paymentType === "hutang" ? renderCustomerStep() : renderCostStep();
      case 2:
        return paymentType === "hutang" ? renderCostStep() : renderSellStep();
      case 3:
        if (paymentType === "hutang") {
          return (
            <div className="space-y-4">
              <StepTitle title="Tagihan & kategori" />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Harga Jual
                </label>
                <AmountInput
                  id="sale-sell-credit"
                  autoFocus
                  value={displaySell}
                  invalid={!!form.formState.errors.sellAmount}
                  onChange={(display, numeric) => {
                    setDisplaySell(display);
                    form.setValue("sellAmount", numeric, { shouldValidate: false });
                    if (message) setMessage(null);
                  }}
                  onEnter={() => goTo(4)}
                />
                {form.formState.errors.sellAmount ? (
                  <FieldError errors={[form.formState.errors.sellAmount]} className="text-xs" />
                ) : null}
              </div>
              <div className="grid gap-3">
                {renderExpenseCategoryPicker()}
                {renderIncomeCategoryPicker({ credit: true })}
              </div>
              {renderDescriptionField()}
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <StepTitle title="Kategori & info" />
            <div className="grid gap-3">
              {renderExpenseCategoryPicker()}
              {renderIncomeCategoryPicker({ credit: false })}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Referensi (opsional)
              </label>
              <Input
                className="h-10 rounded-lg text-sm"
                placeholder="mis. 0812xxxx / no. meter / ID pelanggan"
                {...form.register("customerRef")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goTo(4);
                  }
                }}
              />
            </div>
            {renderDescriptionField()}
          </div>
        );
      case 4: {
        const cost = Number(watchedCost ?? 0);
        const sell = Number(watchedSell ?? 0);
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
                {formatCurrencyIDR(Number.isFinite(sell) ? sell : 0)}
              </p>
              <dl className="mt-3 divide-y text-sm">
                {paymentType === "hutang" ? (
                  <SummaryRow label="Pelanggan" value={selectedCustomer?.name ?? "-"} />
                ) : null}
                <SummaryRow label="Tipe" value={selectedType?.name ?? "-"} />
                <SummaryRow
                  label="Modal"
                  value={`${formatCurrencyIDR(Number.isFinite(cost) ? cost : 0)} · ${accountName(selectedCostAccountId)}`}
                />
                {paymentType === "lunas" ? (
                  <SummaryRow
                    label="Terima di"
                    value={accountName(selectedIncomeAccountId)}
                  />
                ) : null}
                <SummaryRow
                  label="Laba"
                  value={formatCurrencyIDR(Number.isFinite(profit) ? profit : 0)}
                />
                <SummaryRow
                  label="Tanggal"
                  value={watchedDate ? formatDateID(watchedDate) : "-"}
                />
                {watchedCustomerRef && paymentType === "lunas" ? (
                  <SummaryRow label="Ref" value={watchedCustomerRef} />
                ) : null}
                {watchedDescription ? (
                  <SummaryRow label="Catatan" value={watchedDescription} />
                ) : null}
              </dl>
              {paymentType === "hutang" ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {formatCurrencyIDR(Number.isFinite(sell) ? sell : 0)} belum masuk
                  saldo — tercatat sebagai Hutang.
                </p>
              ) : null}
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
      title={isEdit ? "Edit penjualan" : "Tambah penjualan"}
      step={step}
      totalSteps={5}
      stepLabel={stepLabels[paymentType][step] ?? ""}
      direction={direction}
      pending={pending}
      submitLabel={
        isEdit
          ? "Simpan perubahan"
          : isCredit
            ? "Simpan penjualan hutang"
            : "Simpan penjualan"
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

function ProfitPreview({ profit }: { profit: number }) {
  const safe = Number.isFinite(profit) ? profit : 0;
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
      <span className="text-muted-foreground">Laba</span>
      <span
        className={cn(
          "font-bold",
          safe >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-status-expense dark:text-rose-400",
        )}
      >
        {formatCurrencyIDR(safe)}
      </span>
    </div>
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
