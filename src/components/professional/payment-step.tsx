"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

import { SaveButton } from "./save-state";
import { useApplication } from "./use-application";

export function PaymentStep(){const {data}=useApplication();const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");if(!data)return <div className="panel-card">Loading secure payout readiness…</div>;async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setPending(true);setError("");const f=new FormData(event.currentTarget);const response=await fetch("/api/v1/professional/application/payment",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({payoutMethod:f.get("payoutMethod"),accountTitle:f.get("accountTitle"),accountReference:f.get("accountReference")})});const result=await response.json() as ApiEnvelope<{saved:boolean}>;setPending(false);if(!result.success){setError(result.error.message);return}router.push("/professional/application/review")}return <form className="panel-card form-grid" onSubmit={submit}><div className="form-grid__full security-note"><ShieldCheck size={22}/><div><strong>Encrypted before storage</strong><p>This is payout-readiness information only. FixMate does not move money in Phase 1.</p></div></div><label><span>Payout method</span><select className="text-input" name="payoutMethod" defaultValue={data.payout?.payout_method??"bank"}><option value="bank">Bank account</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select></label><label><span>Account title</span><input className="text-input" name="accountTitle" required defaultValue={data.payout?.account_title??""}/></label><label className="form-grid__full"><span>IBAN or mobile wallet number</span><input className="text-input" name="accountReference" autoComplete="off" required placeholder={data.payout?"Enter again to replace the encrypted value":"PK00… or 03xx…"}/></label>{error?<div className="form-alert form-alert--error form-grid__full">{error}</div>:null}<div className="form-actions form-grid__full"><SaveButton pending={pending}/></div></form>}
