"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ConnectBankState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type BankActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function connectBankAccount(
  _prevState: ConnectBankState,
  formData: FormData,
): Promise<ConnectBankState> {
  const householdId = String(formData.get("householdId") ?? "");
  const pastedToken = String(formData.get("pastedToken") ?? "").trim();

  if (!pastedToken) {
    return { status: "error", message: "Enter your Akahu personal access token." };
  }

  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke<{
    ok: boolean;
    message?: string;
  }>("akahu-oauth-exchange", {
    body: { householdId, pastedToken },
  });

  if (error || !result?.ok) {
    return {
      status: "error",
      message: result?.message ?? "Couldn't connect that account.",
    };
  }

  revalidatePath("/settings/banks");

  return { status: "success", message: "Bank account connected." };
}

export async function syncBankConnection(
  _prevState: BankActionState,
  formData: FormData,
): Promise<BankActionState> {
  const connectionId = String(formData.get("connectionId") ?? "");

  const supabase = await createClient();
  const { data: result, error } = await supabase.functions.invoke<{
    ok: boolean;
    message?: string;
  }>("sync-accounts", {
    body: { connectionId },
  });

  if (error || !result?.ok) {
    return {
      status: "error",
      message: result?.message ?? "Couldn't sync this connection.",
    };
  }

  revalidatePath("/settings/banks");

  return { status: "success" };
}

export async function disconnectBankConnection(
  _prevState: BankActionState,
  formData: FormData,
): Promise<BankActionState> {
  const connectionId = String(formData.get("connectionId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_bank_connection", {
    p_connection_id: connectionId,
  });

  if (error) {
    return { status: "error", message: "Couldn't disconnect this account." };
  }

  revalidatePath("/settings/banks");

  return { status: "success" };
}
