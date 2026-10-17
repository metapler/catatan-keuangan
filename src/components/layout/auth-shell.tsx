import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  PiggyBank,
  Wallet,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-1/2 flex-col justify-between border-r border-border/60 bg-muted/20 p-8 lg:flex xl:p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-1/4 left-1/4 size-[300px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 size-[200px] rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
          >
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/20">
              CK
            </div>
            <span className="text-sm">Catatan Keuangan</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <div className="h-px w-4 bg-primary/60" />
            <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.12em]">
              {eyebrow}
            </p>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>

          <div className="mt-8 space-y-4">
            {[
              {
                icon: Wallet,
                title: "Saldo lintas akun",
                description: "Pantau uang tunai, bank, e-wallet, dan tabungan.",
              },
              {
                icon: BarChart3,
                title: "Insight bulanan",
                description: "Ritme pemasukan dan pengeluaran jelas terlihat.",
              },
              {
                icon: PiggyBank,
                title: "Target tabungan",
                description: "Atur sasaran finansial dan cek progresnya.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background shadow-sm">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="size-3" />
            <span>Supabase Auth</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Zap className="size-3" />
            <span>Next.js 16</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="size-3" />
            <span>Real-time</span>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-5 lg:w-1/2 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 font-bold tracking-tight text-foreground"
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/20">
                CK
              </div>
              <span className="text-sm">Catatan Keuangan</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
