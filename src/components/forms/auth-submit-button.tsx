"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type AuthSubmitButtonProps = {
  label: string;
  loadingLabel: string;
  pending: boolean;
};

export function AuthSubmitButton({
  label,
  loadingLabel,
  pending,
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      className="h-10 w-full text-sm font-semibold"
      disabled={pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
