"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetched draft state initializes editable references once */

import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

import { SaveButton } from "./save-state";
import { useApplication } from "./use-application";

type Reference={fullName:string;relationship:string;phone:string;notes:string};
const empty=():Reference=>({fullName:"",relationship:"",phone:"",notes:""});

export function ReferencesStep(){const {data}=useApplication();const router=useRouter();const [references,setReferences]=useState<Reference[]>([empty(),empty()]);const [initialized,setInitialized]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");useEffect(()=>{if(data&&!initialized){if(data.references.length>=2)setReferences(data.references.map(item=>({fullName:item.full_name,relationship:item.relationship,phone:item.phone,notes:item.notes??""})));setInitialized(true)}},[data,initialized]);function update(index:number,key:keyof Reference,value:string){setReferences(previous=>previous.map((item,i)=>i===index?{...item,[key]:value}:item))}async function submit(event:React.FormEvent){event.preventDefault();setPending(true);setError("");const response=await fetch("/api/v1/professional/application/references",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({references})});const result=await response.json() as ApiEnvelope<{saved:boolean}>;setPending(false);if(!result.success){setError(result.error.message);return}router.push("/professional/application/payment")}return <form className="reference-stack" onSubmit={submit}>{references.map((reference,index)=><fieldset className="panel-card form-grid" key={index}><legend>Reference {index+1}</legend><label><span>Full name</span><input className="text-input" value={reference.fullName} onChange={e=>update(index,"fullName",e.target.value)} required/></label><label><span>Relationship</span><input className="text-input" value={reference.relationship} onChange={e=>update(index,"relationship",e.target.value)} placeholder="Former employer, client, supervisor" required/></label><label><span>Phone number</span><input className="text-input" type="tel" value={reference.phone} onChange={e=>update(index,"phone",e.target.value)} required/></label><label><span>Notes <small>Optional</small></span><input className="text-input" value={reference.notes} onChange={e=>update(index,"notes",e.target.value)}/></label></fieldset>)}{error?<div className="form-alert form-alert--error">{error}</div>:null}<div className="form-actions"><SaveButton pending={pending}/></div></form>}
