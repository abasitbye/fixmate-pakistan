"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useCallback, useState } from "react";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import type { ApiEnvelope } from "@/lib/api/response";

export function ContactForm() {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const handleToken = useCallback((value: string) => setToken(value), []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return; setPending(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/contact", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({name:values.get("name"),email:values.get("email"),subject:values.get("subject"),message:values.get("message"),turnstileToken:token}) });
      const result = await response.json() as ApiEnvelope<{received:boolean}>;
      if (!result.success) { setError(result.error.message); return; }
      setSent(true);
    } catch { setError("We could not send your message. Try again later."); }
    finally { setPending(false); }
  }
  if (sent) return <div className="panel-card contact-success"><CheckCircle2 size={34} /><h2>Message received</h2><p>FixMate Support will review your message. Please keep an eye on the email address you provided.</p></div>;
  return <form className="panel-card form-grid" onSubmit={submit}><label><span>Full name</span><input className="text-input" name="name" required maxLength={100}/></label><label><span>Email address</span><input className="text-input" type="email" name="email" required maxLength={254}/></label><label className="form-grid__full"><span>Subject</span><input className="text-input" name="subject" required maxLength={120}/></label><label className="form-grid__full"><span>How can we help?</span><textarea className="text-input textarea-input contact-textarea" name="message" required minLength={20} maxLength={3000}/></label><div className="form-grid__full"><TurnstileWidget action="contact" onToken={handleToken}/></div>{error?<div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div>:null}<div className="form-actions form-grid__full"><button className="button button--primary button--large" disabled={!token||pending}>{pending?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>} {pending?"Sending…":"Send message"}</button></div></form>;
}
