import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getClientEnvironment } from "@/env/client";
import { getServerEnvironment } from "@/env/server";

export function createAdminClient() {
  const clientEnvironment = getClientEnvironment();
  const serverEnvironment = getServerEnvironment();

  return createSupabaseClient(
    clientEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

