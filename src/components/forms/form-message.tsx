import { cn } from "@/lib/utils";

type FormMessageProps = {
  tone: "success" | "error" | "info";
  message: string;
};

export function FormMessage({ tone, message }: FormMessageProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-2 py-1 text-xs font-medium",
        tone === "success" &&
          "border border-status-income-border bg-status-income-bg text-status-income",
        tone === "error" &&
          "border border-status-expense-border bg-status-expense-bg text-status-expense",
        tone === "info" &&
          "border border-status-transfer-border bg-status-transfer-bg text-status-transfer",
      )}
    >
      {message}
    </div>
  );
}
