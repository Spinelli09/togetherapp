"use server";

import { revalidatePath } from "next/cache";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export type ConnectBankState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type BankActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

// supabase.functions.invoke() returns data = null for ANY non-2xx response
// and surfaces the response only via error.context — so reading
// `result.message` alone can never see an Edge Function's own error text.
// Without this, every failure (missing AKAHU_APP_ID, a rejected Akahu
// token, an accounts-fetch failure) collapsed into one generic string,
// which made real failures undiagnosable from the UI.
async function edgeFunctionMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) {
    // FunctionsFetchError / FunctionsRelayError — a genuine network or
    // relay problem, with no useful body to read.
    return null;
  }

  try {
    const body = (await error.context.json()) as { message?: unknown };
    return typeof body?.message === "string" && body.message.length > 0
      ? body.message
      : null;
  } catch {
    // Non-JSON or already-consumed body — fall back to the generic message.
    return null;
  }
}

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

  if (error) {
    return {
      status: "error",
      message: (await edgeFunctionMessage(error)) ?? "Couldn't connect that account.",
    };
  }

  if (!result?.ok) {
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

  if (error) {
    return {
      status: "error",
      message: (await edgeFunctionMessage(error)) ?? "Couldn't sync this connection.",
    };
  }

  if (!result?.ok) {
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
