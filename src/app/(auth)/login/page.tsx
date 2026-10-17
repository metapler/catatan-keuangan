import type { Metadata } from "next";

import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackError = params?.error === "callback_failed";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-5">
      <div className="w-full max-w-sm">
        <LoginForm callbackError={callbackError} />
      </div>
    </div>
  );
}
