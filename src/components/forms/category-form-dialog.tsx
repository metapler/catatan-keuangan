"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownRight, ArrowUpRight, Plus, SquarePen } from "lucide-react";
import { z } from "zod";

import {
  createCategoryAction,
  updateCategoryAction,
} from "@/app/(dashboard)/categories/actions";
import { FormMessage } from "@/components/forms/form-message";
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
  categorySchema,
  categoryTypes,
  type CategoryInput,
} from "@/lib/validations/categories";
import type { CategorySummary } from "@/lib/queries/categories";
import { cn } from "@/lib/utils";

const typeLabels: Record<(typeof categoryTypes)[number], string> = {
  income: "Income",
  expense: "Expense",
};

const presetColors = [
  "#F43F5E",
  "#F97316",
  "#F59E0B",
  "#10B981",
  "#0D9488",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

const stepLabels = ["Tipe", "Nama", "Tampilan"];

function stepForField(field: string): number {
  if (field === "type") return 0;
  if (field === "name") return 1;
  if (field === "color" || field === "icon") return 2;
  return 2;
}

export function CategoryFormDialog({
  category,
  defaultType = "expense",
}: {
  category?: CategorySummary;
  defaultType?: CategoryInput["type"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const isEdit = Boolean(category);

  const defaultValues = useMemo<CategoryInput>(
    () => ({
      name: category?.name ?? "",
      type: category?.type ?? defaultType,
      color: category?.color ?? (defaultType === "income" ? "#10B981" : "#F43F5E"),
      icon: category?.icon ?? "",
    }),
    [category, defaultType],
  );

  const form = useForm<z.input<typeof categorySchema>, unknown, CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setMessage(null);
      setStep(0);
      setDirection(1);
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const selectedType = useWatch({ control: form.control, name: "type" });
  const selectedColor = useWatch({ control: form.control, name: "color" });
  const selectedName = useWatch({ control: form.control, name: "name" });
  const selectedIcon = useWatch({ control: form.control, name: "icon" });

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.min(Math.max(next, 0), 2));
  };

  const pickType = (value: CategoryInput["type"]) => {
    form.setValue("type", value, { shouldValidate: true });
    if (!category) {
      form.setValue("color", value === "income" ? "#10B981" : "#F43F5E", {
        shouldValidate: false,
      });
    }
    if (message) setMessage(null);
  };

  const handleInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (!fields.length) return;
    goTo(Math.min(...fields.map(stepForField)));
    const first = errors[fields[0]];
    setMessage({ tone: "error", text: first?.message ?? "Periksa kembali isian pada langkah ini." });
  };

  const onSubmit = (values: CategoryInput) => {
    setPending(true);
    setMessage(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateCategoryAction(category!.id, values)
        : await createCategoryAction(values);

      if (result.status === "error") {
        setMessage({ tone: "error", text: result.message ?? "Gagal menyimpan kategori." });
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
      Tambah kategori
    </Button>
  );

  const renderEditForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)} className="space-y-4" noValidate>
      <Field data-invalid={!!form.formState.errors.name}>
        <FieldContent>
          <Input
            placeholder="Makan siang"
            className="h-10 rounded-lg text-sm"
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <FieldError errors={[form.formState.errors.name]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <Field data-invalid={!!form.formState.errors.type}>
        <FieldContent>
          <Select
            value={selectedType}
            onValueChange={(v) => form.setValue("type", v as CategoryInput["type"], { shouldValidate: true })}
          >
              <SelectTrigger className="h-10 w-full rounded-lg text-sm">
              <SelectValue placeholder="Pilih tipe">
                {selectedType ? typeLabels[selectedType as keyof typeof typeLabels] : "Pilih tipe"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categoryTypes.map((t) => (
                <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.type ? (
            <FieldError errors={[form.formState.errors.type]} className="text-xs" />
          ) : null}
        </FieldContent>
      </Field>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <Field data-invalid={!!form.formState.errors.color}>
          <FieldContent>
            <Input type="color" className="h-10 rounded-lg p-1" {...form.register("color")} />
            {form.formState.errors.color ? (
              <FieldError errors={[form.formState.errors.color]} className="text-xs" />
            ) : null}
          </FieldContent>
        </Field>
        <Field data-invalid={!!form.formState.errors.icon}>
          <FieldContent>
            <Input
              placeholder="Ikon (opsional)"
              className="h-10 rounded-lg text-sm"
              {...form.register("icon")}
            />
            {form.formState.errors.icon ? (
              <FieldError errors={[form.formState.errors.icon]} className="text-xs" />
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
            <StepTitle title="Tipe" />
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "expense", title: "Pengeluaran", icon: ArrowDownRight },
                  { value: "income", title: "Pemasukan", icon: ArrowUpRight },
                ] as const
              ).map((card) => {
                const Icon = card.icon;
                const active = selectedType === card.value;
                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => {
                      pickType(card.value);
                      goTo(1);
                    }}
                    className={cn(
                      "flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <p className="text-sm font-semibold">{card.title}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <StepTitle title="Nama" />
            <Input
              autoFocus
              className="h-10 rounded-lg text-sm"
              placeholder="Makan siang"
              {...form.register("name")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goTo(2);
                }
              }}
            />
            {form.formState.errors.name ? (
              <FieldError errors={[form.formState.errors.name]} className="text-xs" />
            ) : null}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <StepTitle title="Warna" />
            <div className="grid grid-cols-8 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Warna ${color}`}
                  onClick={() => form.setValue("color", color, { shouldValidate: false })}
                  className={cn(
                    "size-10 rounded-full ring-offset-2 ring-offset-background transition-colors",
                    selectedColor === color ? "ring-2 ring-primary" : "ring-1 ring-black/10",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                aria-label="Warna kustom"
                className="h-10 w-16 rounded-lg p-1"
                {...form.register("color")}
              />
              <Input
                placeholder="food"
                className="h-10 flex-1 rounded-lg text-sm"
                {...form.register("icon")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    form.handleSubmit(onSubmit, handleInvalid)();
                  }
                }}
              />
            </div>
            {form.formState.errors.color ? (
              <FieldError errors={[form.formState.errors.color]} className="text-xs" />
            ) : null}
            <div className="flex items-center gap-3 py-1">
              <span
                className="size-10 shrink-0 rounded-xl"
                style={{ backgroundColor: selectedColor || "#F43F5E" }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedName || "Nama kategori"}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedType ? typeLabels[selectedType as keyof typeof typeLabels] : ""}
                  {selectedIcon ? ` · ${selectedIcon}` : ""}
                </p>
              </div>
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
      title={isEdit ? "Edit kategori" : "Tambah kategori"}
      step={step}
      totalSteps={3}
      stepLabel={stepLabels[step]}
      direction={direction}
      pending={pending}
      submitLabel={isEdit ? "Simpan perubahan" : "Simpan kategori"}
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
