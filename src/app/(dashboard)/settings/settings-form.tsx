"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, TriangleAlert } from "lucide-react";

import { exportDataAction, resetDataAction } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/forms/form-message";

type SettingsFormProps = {
  onClose?: () => void;
};

export function SettingsForm({ onClose }: SettingsFormProps) {
  const router = useRouter();
  const [exportPending, setExportPending] = useState(false);
  const [exportMessage, setExportMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [resetPending, setResetPending] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetMessage, setResetMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const handleExport = () => {
    setExportPending(true);
    setExportMessage(null);

    startTransition(async () => {
      const result = await exportDataAction();
      setExportPending(false);

      if (result.status === "error") {
        setExportMessage({ tone: "error", text: result.message });
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportMessage({ tone: "success", text: "Data berhasil diekspor." });
    });
  };

  const handleReset = () => {
    if (confirmText !== "HAPUS") {
      setResetMessage({
        tone: "error",
        text: "Ketik 'HAPUS' untuk mengkonfirmasi.",
      });
      return;
    }

    setResetPending(true);
    setResetMessage(null);

    startTransition(async () => {
      const result = await resetDataAction();
      setResetPending(false);

      if (result.status === "error") {
        setResetMessage({ tone: "error", text: result.message });
        return;
      }

      setResetOpen(false);
      setConfirmText("");
      setResetMessage({ tone: "success", text: result.message });
      onClose?.();
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Export */}
      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Download className="size-4 text-primary" />
            Ekspor Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Unduh semua data keuangan Anda (akun, kategori, transaksi, budget,
            dan target tabungan) dalam format CSV.
          </p>
          {exportMessage ? (
            <FormMessage tone={exportMessage.tone} message={exportMessage.text} />
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={exportPending}
          >
            <Download className="size-3.5" />
            {exportPending ? "Mengekspor..." : "Unduh CSV"}
          </Button>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Trash2 className="size-4" />
            Reset Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Hapus semua data secara permanen. Tindakan ini tidak bisa
            dibatalkan.
          </p>
          {resetMessage && !resetOpen ? (
            <FormMessage tone={resetMessage.tone} message={resetMessage.text} />
          ) : null}
          {!resetOpen ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setResetOpen(true);
                setResetMessage(null);
              }}
            >
              <Trash2 className="size-3.5" />
              Reset Semua Data
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  Semua data Anda akan dihapus permanen. Ketik{" "}
                  <strong>HAPUS</strong> di bawah untuk konfirmasi.
                </p>
              </div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ketik HAPUS"
                aria-label="Konfirmasi hapus"
                className="h-8 bg-background text-xs"
              />
              {resetMessage ? (
                <FormMessage tone={resetMessage.tone} message={resetMessage.text} />
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResetOpen(false);
                    setConfirmText("");
                    setResetMessage(null);
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleReset}
                  disabled={resetPending}
                >
                  {resetPending ? "Menghapus..." : "Hapus Permanen"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
