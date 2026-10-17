import type { LoginInput } from "@/lib/validations/auth";

export type AuthActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export type LoginFormValues = LoginInput;
