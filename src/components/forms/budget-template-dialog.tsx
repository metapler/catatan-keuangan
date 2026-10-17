"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Plus,
    Power,
    PowerOff,
    Pencil,
    Settings,
    Trash2,
} from "lucide-react";
import { z } from "zod";

import {
    createBudgetTemplateAction,
    deleteBudgetTemplateAction,
    toggleBudgetTemplateAction,
    updateBudgetTemplateAction,
} from "@/app/(dashboard)/budgets/actions";
import { CategoryColorDot } from "@/components/dashboard/category-color-dot";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import {
    budgetTemplateSchema,
    type BudgetTemplateInput,
} from "@/lib/validations/budgets";
import type {
    BudgetExpenseCategory,
    BudgetTemplate,
} from "@/lib/queries/budgets";
import { formatCurrencyIDR } from "@/lib/utils/format";

type BudgetTemplateDialogProps = {
    templates: BudgetTemplate[];
    expenseCategories: BudgetExpenseCategory[];
};

export function BudgetTemplateDialog({
    templates,
    expenseCategories,
}: BudgetTemplateDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<{
        tone: "success" | "error";
        text: string;
    } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [displayAmount, setDisplayAmount] = useState("");

    const defaultValues = useMemo<BudgetTemplateInput>(
        () => ({
            categoryId: "",
            amount: 0,
            isActive: true,
        }),
        [],
    );

    const form = useForm<z.input<typeof budgetTemplateSchema>, unknown, BudgetTemplateInput>({
        resolver: zodResolver(budgetTemplateSchema),
        defaultValues,
    });

    const selectedCategoryId = form.watch("categoryId");
    const isActive = form.watch("isActive");

    useEffect(() => {
        if (open) {
            form.reset(defaultValues);
            setEditingId(null);
            setDisplayAmount("");
            setMessage(null);
        }
    }, [open, defaultValues, form]);

    const onSubmit = (values: BudgetTemplateInput) => {
        setPending(true);
        setMessage(null);

        startTransition(async () => {
            const result = editingId
                ? await updateBudgetTemplateAction(editingId, values)
                : await createBudgetTemplateAction(values);

            if (result.status === "error") {
                setMessage({
                    tone: "error",
                    text: result.message ?? "Gagal menyimpan template.",
                });
                setPending(false);
                return;
            }

            setPending(false);
            form.reset(defaultValues);
            setEditingId(null);
            setDisplayAmount("");
            setMessage({ tone: "success", text: result.message ?? "Template tersimpan." });
            router.refresh();
        });
    };

    const handleEdit = (template: BudgetTemplate) => {
        setEditingId(template.id);
        form.setValue("categoryId", template.categoryId, { shouldValidate: true });
        form.setValue("amount", template.amount, { shouldValidate: true });
        form.setValue("isActive", template.isActive, { shouldValidate: true });
        setDisplayAmount(
            template.amount > 0
                ? template.amount.toLocaleString("id-ID").replace(/,/g, ".")
                : "",
        );
        setMessage(null);
    };

    const handleDelete = async (templateId: string) => {
        try {
            await deleteBudgetTemplateAction(templateId);
            router.refresh();
        } catch (err) {
            console.error("Delete template error:", err);
            setMessage({
                tone: "error",
                text: err instanceof Error ? err.message : "Gagal menghapus template.",
            });
        }
    };

    const handleToggle = (templateId: string, currentActive: boolean) => {
        startTransition(async () => {
            const result = await toggleBudgetTemplateAction(templateId, !currentActive);
            if (result.status === "error") {
                setMessage({ tone: "error", text: result.message ?? "Gagal mengubah status." });
            } else {
                router.refresh();
            }
        });
    };

    const availableCategories = editingId
        ? expenseCategories
        : expenseCategories.filter(
            (cat) => !templates.some((t) => t.categoryId === cat.id),
        );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button
                        size="sm"
                        className="rounded-full text-[11px] h-7 w-7 p-0 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-400"
                        title="Kelola budget otomatis"
                    >
                        <Settings className="size-3.5" />
                    </Button>
                }
            />
            <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-xl p-4">
                <DialogHeader className="gap-1.5">
                    <DialogTitle className="text-sm">Kelola Budget Otomatis</DialogTitle>
                    <DialogDescription className="text-[11px]">
                        Template budget akan otomatis dibuat setiap bulan untuk kategori
                        yang dipilih.
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-3"
                    noValidate
                >
                    <Field data-invalid={!!form.formState.errors.categoryId}>
                        <FieldLabel className="text-[11px]">Kategori expense</FieldLabel>
                        <FieldContent>
                            <Select
                                value={selectedCategoryId ?? ""}
                                onValueChange={(value) =>
                                    form.setValue("categoryId", value ?? "", {
                                        shouldValidate: Boolean(value),
                                    })
                                }
                            >
                                <SelectTrigger className="h-8 w-full rounded-lg text-[11px]">
                                    <SelectValue placeholder="Pilih kategori expense">
                                        {availableCategories.find((c) => c.id === selectedCategoryId)
                                            ?.name}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCategories.map((category) => (
                                        <SelectItem
                                            key={category.id}
                                            value={category.id}
                                            className="text-[11px]"
                                        >
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.categoryId ? (
                                <FieldError
                                    errors={[form.formState.errors.categoryId]}
                                    className="text-[11px]"
                                />
                            ) : null}
                        </FieldContent>
                    </Field>

                    <Field data-invalid={!!form.formState.errors.amount}>
                        <FieldLabel htmlFor="template-amount" className="text-[11px]">
                            Nominal budget
                        </FieldLabel>
                        <FieldContent>
                            <div className="flex gap-2">
                                <Input
                                    id="template-amount"
                                    type="text"
                                    inputMode="numeric"
                                    className="h-8 rounded-lg text-[11px] flex-1"
                                    placeholder="0"
                                    value={displayAmount}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, "");
                                        const formatted = raw
                                            ? Number(raw).toLocaleString("id-ID").replace(/,/g, ".")
                                            : "";
                                        setDisplayAmount(formatted);
                                        const numeric = formatted.replace(/\./g, "");
                                        form.setValue(
                                            "amount",
                                            numeric ? Number(numeric) : 0,
                                            { shouldValidate: true },
                                        );
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg text-[11px] px-2.5"
                                    onClick={() => {
                                        const raw = displayAmount.replace(/\./g, "");
                                        const num = raw ? Number(raw) * 1000 : 0;
                                        const formatted = num
                                            ? num.toLocaleString("id-ID").replace(/,/g, ".")
                                            : "";
                                        setDisplayAmount(formatted);
                                        form.setValue("amount", num, { shouldValidate: true });
                                    }}
                                >
                                    000
                                </Button>
                            </div>
                            {form.formState.errors.amount ? (
                                <FieldError
                                    errors={[form.formState.errors.amount]}
                                    className="text-[11px]"
                                />
                            ) : null}
                        </FieldContent>
                    </Field>

                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5">
                        <span className="text-[11px] font-medium">Aktifkan template</span>
                        <Button
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            className="h-7 gap-1 rounded-lg text-[11px]"
                            onClick={() =>
                                form.setValue("isActive", !isActive, { shouldValidate: true })
                            }
                        >
                            {isActive ? (
                                <>
                                    <Power className="size-3" />
                                    Aktif
                                </>
                            ) : (
                                <>
                                    <PowerOff className="size-3" />
                                    Nonaktif
                                </>
                            )}
                        </Button>
                    </div>

                    {message ? (
                        <FormMessage tone={message.tone} message={message.text} />
                    ) : null}

                    <div className="flex gap-2">
                        {editingId ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-lg text-[11px] flex-1"
                                onClick={() => {
                                    setEditingId(null);
                                    form.reset(defaultValues);
                                    setDisplayAmount("");
                                    setMessage(null);
                                }}
                            >
                                Batal edit
                            </Button>
                        ) : null}
                        <Button
                            type="submit"
                            size="sm"
                            className="h-7 rounded-lg text-[11px] flex-1"
                            disabled={pending}
                        >
                            <Plus className="size-3.5 mr-1" />
                            {pending
                                ? "Menyimpan..."
                                : editingId
                                    ? "Simpan perubahan"
                                    : "Tambah template"}
                        </Button>
                    </div>
                </form>

                {templates.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                            Template tersimpan
                        </p>
                        <div className="space-y-1.5">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="flex items-center gap-2 rounded-lg border border-border/40 bg-card p-2"
                                >
                                    <div className="flex flex-1 items-center gap-2 min-w-0">
                                        <CategoryColorDot color={template.categoryColor} />
                                        <div className="min-w-0">
                                            <p
                                                className={`truncate text-[11px] font-medium ${template.isActive
                                                    ? "text-foreground"
                                                    : "text-muted-foreground line-through"
                                                    }`}
                                            >
                                                {template.categoryName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatCurrencyIDR(template.amount)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className={`h-6 w-6 rounded-md p-0 text-[10px] ${template.isActive
                                                ? "text-emerald-600"
                                                : "text-muted-foreground"
                                                }`}
                                            title={
                                                template.isActive
                                                    ? "Nonaktifkan template"
                                                    : "Aktifkan template"
                                            }
                                            onClick={() =>
                                                handleToggle(template.id, template.isActive)
                                            }
                                        >
                                            {template.isActive ? (
                                                <Power className="size-3" />
                                            ) : (
                                                <PowerOff className="size-3" />
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 rounded-md p-0 text-[10px] text-sky-600"
                                            title="Edit template"
                                            onClick={() => handleEdit(template)}
                                        >
                                            <Pencil className="size-3" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 rounded-md p-0 text-[10px] text-rose-600"
                                            title="Hapus template"
                                            onClick={() => handleDelete(template.id)}
                                        >
                                            <Trash2 className="size-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
