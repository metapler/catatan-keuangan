import { createClient } from "@/lib/supabase/server";

type SavingsGoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
};

export type SavingsGoalSummary = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  targetDate: string | null;
  status: SavingsGoalRow["status"];
  createdAt: string;
  isOverdue: boolean;
};

export type SavingsGoalsQueryResult = {
  goals: SavingsGoalSummary[];
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
};

export async function getSavingsGoals(): Promise<SavingsGoalsQueryResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("savings_goals")
    .select("id, name, target_amount, current_amount, target_date, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const today = new Date().toISOString().slice(0, 10);
  const goals = ((data ?? []) as SavingsGoalRow[]).map((goal) => {
    const targetAmount = Number(goal.target_amount);
    const currentAmount = Number(goal.current_amount);
    const progressPercentage =
      targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

    return {
      id: goal.id,
      name: goal.name,
      targetAmount,
      currentAmount,
      remainingAmount: Math.max(targetAmount - currentAmount, 0),
      progressPercentage,
      targetDate: goal.target_date,
      status: goal.status,
      createdAt: goal.created_at,
      isOverdue:
        goal.status === "active" &&
        goal.target_date !== null &&
        goal.target_date < today,
    } satisfies SavingsGoalSummary;
  });

  return {
    goals,
    activeCount: goals.filter((goal) => goal.status === "active").length,
    completedCount: goals.filter((goal) => goal.status === "completed").length,
    cancelledCount: goals.filter((goal) => goal.status === "cancelled").length,
    totalTargetAmount: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
    totalCurrentAmount: goals.reduce((sum, goal) => sum + goal.currentAmount, 0),
  };
}
