"use client";

import { startTransition, useState } from "react";
import { Check, Plus } from "lucide-react";

import { createCustomerAction } from "@/app/(dashboard)/debts/actions";
import { FormMessage } from "@/components/forms/form-message";
import { OptionList } from "@/components/forms/wizard/option-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerSummary } from "@/lib/queries/customers";

type CustomerPickerProps = {
  value: string;
  customers: CustomerSummary[];
  fieldError?: { message?: string };
  onChange: (id: string) => void;
  onCustomersChanged?: (customers: CustomerSummary[]) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * Pemilih pelanggan + tambah cepat inline (nama + HP opsional).
 * Dipakai langkah "Pelanggan" di form hutang.
 */
export function CustomerPicker({
  value,
  customers,
  fieldError,
  onChange,
  onCustomersChanged,
  emptyTitle = "Belum ada pelanggan",
  emptyDescription = "Tambahkan pelanggan baru di bawah.",
}: CustomerPickerProps) {
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeCustomers = customers ?? [];

  const handleAdd = () => {
    if (adding) return;
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name) {
      setError("Isi nama pelanggan dulu.");
      return;
    }
    if (name.length > 100) {
      setError("Nama pelanggan terlalu panjang (maks 100 karakter).");
      return;
    }
    if (phone.length > 30) {
      setError("Nomor telepon terlalu panjang (maks 30 karakter).");
      return;
    }

    setAdding(true);
    setError(null);

    startTransition(async () => {
      const result = await createCustomerAction({
        name,
        phone,
        notes: "",
        isActive: true,
      });

      if (result.status === "error" || !result.id) {
        setError(result.message ?? "Gagal menambahkan pelanggan.");
        setAdding(false);
        return;
      }

      setNewName("");
      setNewPhone("");
      setAdding(false);
      onCustomersChanged?.([
        ...safeCustomers,
        {
          id: result.id,
          name,
          phone: phone || null,
          notes: null,
          isActive: true,
          createdAt: "",
        },
      ]);
      onChange(result.id);
    });
  };

  return (
    <div className="space-y-3">
      <OptionList
        value={value}
        onChange={onChange}
        options={safeCustomers.map((c) => ({
          id: c.id,
          label: c.name,
          hint: c.phone || undefined,
        }))}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
      {fieldError?.message ? (
        <p className="text-xs text-destructive">{fieldError.message}</p>
      ) : null}

      <div className="rounded-2xl border border-dashed p-3">
        <p className="text-xs font-semibold">Pelanggan baru</p>
        <div className="mt-2 space-y-2">
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
            placeholder="mis. Budi"
            className="h-10 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <Input
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="No. HP (opsional)"
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
