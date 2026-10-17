import { createClient } from "@/lib/supabase/server";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

function mapCustomer(row: CustomerRow): CustomerSummary {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getCustomers({
  activeOnly = true,
}: {
  activeOnly?: boolean;
} = {}): Promise<CustomerSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("id, name, phone, notes, is_active, created_at")
    .order("name", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CustomerRow[]).map(mapCustomer);
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, notes, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return mapCustomer(data as CustomerRow);
}
