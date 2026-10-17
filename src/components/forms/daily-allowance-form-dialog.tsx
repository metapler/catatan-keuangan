"use client";

import { startTransition, useEffect, useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Plus, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createDailyAllowanceAction,
  updateDailyAllowanceAction,
} from "@/app/(dashboard)/budgets/daily-actions";
import { CategoryColorDot } from "@/components/dashboard/category-color-dot";
import { FormMessage } from "@/components/forms/form-message";
import { AmountInput } from "@/components/forms/wizard/amount-input";
import { displayFromNumber } from "@/components/forms/wizard/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { BudgetExpenseCategory } from "@/lib/queries/budgets";
import type { DailyAllowanceSummary } from "@/lib/queries/daily-allowances";
import {
  dailyAllowanceSchema,
  type DailyAllowanceInput,
} from "@/lib/validations/daily-allowances";
import { cn } from "@/lib/utils";

type DailyAllowanceFormDialogProps = {
  allowance?: DailyAllowanceSummary;
  expenseCategories: BudgetExpenseCategory[];
  existingCategoryIds?: string[];
  trigger?: ReactElement;
};

export function DailyAllowanceFormDialog({
  allowance,
  expenseCategories,
  existingCategoryIds = [],
  trigger: customTrigger,
}: DailyAllowanceFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const isEdit = Boolean(allowance);

  const [displayAmount, setDisplayAmount] = useState(() =>
    displayFromNumber(allowance?.dailyAmount ?? 0),
  );

  const defaultValues = useMemo<DailyAllowanceInput>(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      categoryId: allowance?.categoryId ?? "",
      dailyAmount: allowance?.dailyAmount ?? 0,
      startDate: allowance?.startDate ?? todayStr,
      rolloverEnabled: allowance?.rolloverEnabled ?? true,
      isActive: allowance?.isActive ?? true,
      note: allowance?.note ?? "",
    };
  }, [allowance]);

  const form = useForm<z.input<typeof dailyAllowanceSchema>, unknown, DailyAllowanceInput>({
    resolver: zodResolver(dailyAllowanceSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      form.reset(defaultValues);
      setDisplayAmount(displayFromNumber(allowance?.dailyAmount ?? 0));
    }
  }, [open, allowance, defaultValues, form]);

  const selectedCategoryId = form.watch("categoryId");
  const rolloverEnabled = form.watch("rolloverEnabled");

  const availableCategories = useMemo(() => {
    if (isEdit) return expenseCategories;
    const existingSet = new Set(existingCategoryIds);
    return expenseCategories.filter((c) => !existingSet.has(c.id));
  }, [expenseCategories, existingCategoryIds, isEdit]);

  const onSubmit = (values: DailyAllowanceInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateDailyAllowanceAction(allowance!.id, values)
        : await createDailyAllowanceAction(values);

      if (result.status === "error") {
        setMessage({
          tone: "error",
          text: result.message ?? "Gagal menyimpan Anggaran Harian.",
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
    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
      <SquarePen className="size-3.5" />
      Edit
    </Button>
  ) : (
    <Button size="sm" className="h-8 gap-1 rounded-full text-xs">
      <Plus className="size-3.5" />
      Tambah Anggaran Harian
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={customTrigger ?? trigger} />
      <DialogContent className="max-w-md rounded-2xl p-5 sm:p-6">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-base font-bold">
            {isEdit ? "Edit Anggaran Harian" : "Tambah Anggaran Harian"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1" noValidate>
          {/* Pilih Kategori */}
          <Field data-invalid={!!form.formState.errors.categoryId}>
            <FieldLabel className="text-xs font-semibold">Kategori Pengeluaran</FieldLabel>
            <FieldContent>
              <Select
                value={selectedCategoryId ?? ""}
                onValueChange={(val) =>
                  form.setValue("categoryId", val ?? "", { shouldValidate: true })
                }
              >
                <SelectTrigger className="h-10 w-full rounded-xl text-xs sm:text-sm">
                  <SelectValue placeholder="Pilih kategori">
                    {(() => {
                      const found = expenseCategories.find((c) => c.id === selectedCategoryId);
                      if (!found) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <CategoryColorDot color={found.color} />
                          <span>{found.name}</span>
                        </div>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <CategoryColorDot color={c.color} />
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId ? (
                <FieldError errors={[form.formState.errors.categoryId]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>

          {/* Nominal per Hari */}
          <Field data-invalid={!!form.formState.errors.dailyAmount}>
            <FieldLabel htmlFor="daily-amount-input" className="text-xs font-semibold">
              Anggaran per Hari
            </FieldLabel>
            <FieldContent>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <AmountInput
                  id="daily-amount-input"
                  autoFocus
                  value={displayAmount}
                  onChange={(display, numeric) => {
                    setDisplayAmount(display);
                    form.setValue("dailyAmount", numeric, { shouldValidate: true });
                  }}
                />
              </div>
              {form.formState.errors.dailyAmount ? (
                <FieldError errors={[form.formState.errors.dailyAmount]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>

          {/* Tanggal Mulai */}
          <Field data-invalid={!!form.formState.errors.startDate}>
            <FieldLabel htmlFor="start-date-input" className="text-xs font-semibold">
              Mulai Tanggal
            </FieldLabel>
            <FieldContent>
              <div className="relative">
                <Input
                  id="start-date-input"
                  type="date"
                  className="h-10 rounded-xl pr-9 text-xs sm:text-sm"
                  {...form.register("startDate")}
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {form.formState.errors.startDate ? (
                <FieldError errors={[form.formState.errors.startDate]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>

          {/* Opsi Rollover / Akumulasi Sisa */}
          <div
            className={cn(
              "flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors",
              rolloverEnabled
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 bg-muted/20",
            )}
          >
            <label
              htmlFor="rollover-switch"
              className="flex-1 cursor-pointer space-y-0.5 text-xs"
            >
              <span className="block font-semibold text-foreground">
                Akumulasikan sisa anggaran (Rollover)
              </span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">
                Sisa yang tidak terpakai akan ditambahkan ke celengan.
              </span>
            </label>
            <Switch
              id="rollover-switch"
              checked={rolloverEnabled}
              onCheckedChange={(checked) =>
                form.setValue("rolloverEnabled", checked, { shouldValidate: true })
              }
              className="mt-0.5 shrink-0"
            />
          </div>

          {/* Catatan Tambahan */}
          <Field data-invalid={!!form.formState.errors.note}>
            <FieldLabel htmlFor="note-input" className="text-xs font-semibold">
              Catatan (Opsional)
            </FieldLabel>
            <FieldContent>
              <Input
                id="note-input"
                placeholder="Jatah makan siang & malam"
                className="h-10 rounded-xl text-xs sm:text-sm"
                {...form.register("note")}
              />
              {form.formState.errors.note ? (
                <FieldError errors={[form.formState.errors.note]} className="text-xs" />
              ) : null}
            </FieldContent>
          </Field>

          {message ? (
            <FormMessage tone={message.tone} message={message.text} />
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="h-9 rounded-xl text-xs"
            >
              {pending
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan perubahan"
                  : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
