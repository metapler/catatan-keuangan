"use server";

import { createClient } from "@/lib/supabase/server";

function toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (val: unknown) => {
        const str = String(val ?? "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const lines = [
        headers.join(","),
        ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
    ];
    return lines.join("\n");
}

type ExportResult =
    | { status: "success"; csv: string; filename: string }
    | { status: "error"; message: string };

export async function exportDataAction(): Promise<ExportResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { status: "error", message: "Autentikasi gagal." };
    }

    const userId = user.id;

    const [accounts, categories, transactions, budgets, savingsGoals] =
        await Promise.all([
            supabase.from("accounts").select("*").eq("user_id", userId),
            supabase.from("categories").select("*").eq("user_id", userId),
            supabase.from("transactions").select("*").eq("user_id", userId),
            supabase.from("budgets").select("*").eq("user_id", userId),
            supabase.from("savings_goals").select("*").eq("user_id", userId),
        ]);

    const sections: string[] = [];

    sections.push("# ACCOUNTS\n" + toCsv(accounts.data ?? []));
    sections.push("# CATEGORIES\n" + toCsv(categories.data ?? []));
    sections.push("# TRANSACTIONS\n" + toCsv(transactions.data ?? []));
    sections.push("# BUDGETS\n" + toCsv(budgets.data ?? []));
    sections.push("# SAVINGS_GOALS\n" + toCsv(savingsGoals.data ?? []));

    const csv = sections.join("\n\n");
    const now = new Date().toISOString().slice(0, 10);

    return {
        status: "success",
        csv,
        filename: `catatan-keuangan-${now}.csv`,
    };
}

type ResetResult = { status: "success"; message: string } | { status: "error"; message: string };

export async function resetDataAction(): Promise<ResetResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { status: "error", message: "Autentikasi gagal." };
    }

    const userId = user.id;

    // Hapus dalam urutan yang benar untuk menghindari foreign key constraint
    const tables = [
        "transactions",
        "budgets",
        "savings_goals",
        "categories",
        "accounts",
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq("user_id", userId);
        if (error) {
            return {
                status: "error",
                message: `Gagal menghapus data dari ${table}: ${error.message}`,
            };
        }
    }

    return { status: "success", message: "Semua data berhasil dihapus." };
}
