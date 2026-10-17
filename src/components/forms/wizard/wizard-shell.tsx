"use client";

import type { ReactElement, ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type WizardShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
  direction: 1 | -1;
  pending: boolean;
  submitLabel: string;
  isEdit: boolean;
  children: ReactNode;
  message?: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onSubmit?: () => void;
};

export function WizardShell({
  open,
  onOpenChange,
  trigger,
  title,
  step,
  totalSteps,
  stepLabel,
  direction,
  pending,
  submitLabel,
  isEdit,
  children,
  message,
  onBack,
  onNext,
  onSubmit,
}: WizardShellProps) {
  const isLast = step >= totalSteps - 1;
  const progress = Math.min(100, ((step + 1) / Math.max(totalSteps, 1)) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none",
          "max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none",
          "max-sm:border-t max-sm:data-open:animate-in max-sm:data-open:slide-in-from-bottom-8 max-sm:data-open:fade-in-0",
          "max-sm:data-closed:animate-out max-sm:data-closed:slide-out-to-bottom-8 max-sm:data-closed:fade-out-0",
          "sm:mx-auto sm:w-full sm:max-w-md sm:rounded-2xl",
        )}
      >
        <DialogHeader className="gap-0 px-5 pt-5 text-left sm:px-6">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted sm:hidden" aria-hidden />
          <DialogTitle className="pt-1 text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{stepLabel}</DialogDescription>
        </DialogHeader>

        {!isEdit ? (
          <div className="px-5 pt-3 sm:px-6">
            <div
              className="h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={totalSteps}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div
            key={isEdit ? "edit" : step}
            className={cn(
              "motion-reduce:animate-none",
              !isEdit && direction === 1 && "animate-in slide-in-from-right-4 fade-in-0 duration-200 ease-out",
              !isEdit && direction === -1 && "animate-in slide-in-from-left-4 fade-in-0 duration-200 ease-out",
            )}
          >
            {children}
          </div>
          {message ? <div className="mt-4">{message}</div> : null}
        </div>

        <div className="border-t bg-card px-5 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] sm:px-6">
          {isEdit ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl text-sm"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl text-sm"
                disabled={pending}
                onClick={onSubmit}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {pending ? "Menyimpan..." : submitLabel}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-4 text-sm"
                disabled={step === 0}
                onClick={onBack}
              >
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              {isLast ? (
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl text-sm font-semibold"
                  disabled={pending}
                  onClick={onSubmit}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {pending ? "Menyimpan..." : submitLabel}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl text-sm font-semibold"
                  onClick={onNext}
                >
                  Lanjut
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
