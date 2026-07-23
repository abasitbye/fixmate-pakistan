"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnvironment } from "@/env/client";

export function createClient() {
  const environment = getClientEnvironment();

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

