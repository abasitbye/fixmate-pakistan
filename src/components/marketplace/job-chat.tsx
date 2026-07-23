"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

type Message = { id: string; sender_user_id: string | null; message_type: string; body: string; sent_at: string; job_message_reads: Array<{ user_id: string; read_at: string }> };

export function JobChat({ jobId, profileId, messages }: { jobId: string; profileId: string; messages: Message[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unread = messages.filter((message) => message.sender_user_id && message.sender_user_id !== profileId && !message.job_message_reads.some((read) => read.user_id === profileId));
    void Promise.all(unread.map((message) => fetch(`/api/v1/jobs/${jobId}/messages/${message.id}/read`, { method: "POST" })));
  }, [jobId, messages, profileId]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/jobs/${jobId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: form.get("body") }) });
    const result = await response.json() as ApiEnvelope<{ message: unknown }>;
    setPending(false);
    if (!result.success) { setError(result.error.message); return; }
    event.currentTarget.reset(); router.refresh();
  }

  return <section className="panel-card">
    <h2>Job-scoped conversation</h2><p>Plain text is retained with the job for operational, warranty, and dispute context. Do not share unnecessary personal information.</p>
    <div className="chat-thread">{messages.map((message) => <article className={message.message_type === "system" ? "chat-message chat-message--system" : message.sender_user_id === profileId ? "chat-message chat-message--mine" : "chat-message"} key={message.id}><p>{message.body}</p><small>{message.message_type} · {new Date(message.sent_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</small></article>)}</div>
    <form className="chat-composer" onSubmit={send}><textarea className="text-input textarea-input" name="body" minLength={1} maxLength={4000} aria-label="Job message" placeholder="Write a job message…" required /><button className="button button--primary" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} Send</button></form>
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </section>;
}
