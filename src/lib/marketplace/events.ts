import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DomainEvent } from "./contracts";

export async function enqueueDomainEvent(
  client: SupabaseClient,
  event: DomainEvent,
) {
  const { error } = await client.from("domain_outbox").insert({
    event_type: event.eventType,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    payload: event.payload,
  });
  if (error) throw new Error("The domain event could not be queued.");
}
