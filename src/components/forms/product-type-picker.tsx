"use client";

import { startTransition, useState } from "react";
import { Check, Globe, Layers, Plus, Smartphone, Wifi, Zap } from "lucide-react";

import { createProductTypeAction } from "@/app/(dashboard)/sales/actions";
import { FormMessage } from "@/components/forms/form-message";
import { OptionList } from "@/components/forms/wizard/option-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductTypeSummary } from "@/lib/queries/product-types";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Smartphone> = {
  Pulsa: Smartphone,
  Kuota: Globe,
  "Token Listrik": Zap,
  Wifi: Wifi,
};

function iconFor(name: string) {
  return typeIcons[name] ?? Layers;
}

type ProductTypePickerProps = {
  value: string;
  productTypes: ProductTypeSummary[];
  fieldError?: { message?: string };
  onChange: (id: string) => void;
  onTypesChanged?: (types: ProductTypeSummary[]) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * Pemilih tipe produk + tambah cepat inline.
 * Dipakai langkah "Tipe" di form penjualan dan form hutang.
 */
export function ProductTypePicker({
  value,
  productTypes,
  fieldError,
  onChange,
  onTypesChanged,
  emptyTitle = "Belum ada tipe",
  emptyDescription = "Tambahkan tipe baru di bawah.",
}: ProductTypePickerProps) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeTypes = productTypes ?? [];

  const handleAdd = () => {
    if (adding) return;
    const name = newName.trim();
    if (!name) {
      setError("Isi nama tipe dulu.");
      return;
    }
    if (name.length > 50) {
      setError("Nama tipe terlalu panjang (maks 50 karakter).");
      return;
    }

    setAdding(true);
    setError(null);

    startTransition(async () => {
      const result = await createProductTypeAction({ name, isActive: true });

      if (result.status === "error" || !result.id) {
        setError(result.message ?? "Gagal menambahkan tipe.");
        setAdding(false);
        return;
      }

      setNewName("");
      setAdding(false);
      onTypesChanged?.([
        ...safeTypes,
        { id: result.id, name, isBuiltin: false, isActive: true, createdAt: "" },
      ]);
      onChange(result.id);
    });
  };

  return (
    <div className="space-y-3">
      <OptionList
        value={value}
        onChange={onChange}
        options={safeTypes.map((t) => {
          const Icon = iconFor(t.name);
          return {
            id: t.id,
            label: t.name,
            hint: t.isBuiltin ? "Bawaan" : "Custom",
            icon: <Icon className="size-5 shrink-0 text-muted-foreground" />,
          };
        })}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
      {fieldError?.message ? (
        <p className="text-xs text-destructive">{fieldError.message}</p>
      ) : null}

      <div className="rounded-2xl border border-dashed p-3">
        <p className="text-xs font-semibold">Tipe baru</p>
        <div className="mt-2 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="mis. Voucher Game"
            className="h-10 rounded-lg text-sm"
          />
          <Button
            type="button"
            variant="outline"
            disabled={adding}
            onClick={handleAdd}
            className="h-10 shrink-0 gap-1 rounded-xl text-xs"
          >
            {adding ? <Check className="size-3.5 animate-pulse" /> : <Plus className="size-3.5" />}
            {adding ? "Menyimpan..." : "Tambah"}
          </Button>
        </div>
        {error ? (
          <div className="mt-2">
            <FormMessage tone="error" message={error} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductTypeStepIcon({ name }: { name: string }) {
  const Icon = iconFor(name);
  return (
    <span
      className={cn(
        "flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
