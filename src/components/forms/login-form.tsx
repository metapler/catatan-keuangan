"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

import { loginAction } from "@/app/(auth)/actions";
import { AuthSubmitButton } from "@/components/forms/auth-submit-button";
import { FormMessage } from "@/components/forms/form-message";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/validations/auth";
import type { LoginFormValues } from "@/types/auth";

type LoginFormProps = {
  callbackError?: boolean;
};

export function LoginForm({ callbackError = false }: LoginFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(
    callbackError
      ? "Tautan verifikasi tidak valid atau sudah kedaluwarsa. Silakan login ulang."
      : null,
  );

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setServerMessage(null);
    setPending(true);

    startTransition(async () => {
      const result = await loginAction(values);

      if (result?.status === "error") {
        setServerMessage(result.message);
        setPending(false);
        return;
      }

      router.refresh();
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-1.5">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Masuk
        </h1>
        <p className="text-sm text-muted-foreground">
          Masuk untuk melanjutkan pencatatan keuanganmu.
        </p>
      </div>

      <div className="space-y-3">
        <Field data-invalid={!!form.formState.errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldContent>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
              className="h-10 rounded-lg border-border bg-background text-sm transition-colors focus:border-primary"
            />
            {form.formState.errors.email && (
              <FieldError errors={[form.formState.errors.email]} />
            )}
          </FieldContent>
        </Field>

        <Field data-invalid={!!form.formState.errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldContent className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
              className="h-10 rounded-lg border-border bg-background pr-9 text-sm transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
            {form.formState.errors.password && (
              <FieldError errors={[form.formState.errors.password]} />
            )}
          </FieldContent>
        </Field>
      </div>

      {serverMessage ? (
        <FormMessage tone="error" message={serverMessage} />
      ) : null}

      <AuthSubmitButton
        label="Masuk"
        loadingLabel="Sedang masuk..."
        pending={pending}
      />
    </form>
  );
}
