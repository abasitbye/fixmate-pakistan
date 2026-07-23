"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetched draft state initializes editable schedule rows once */

import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

import { SaveButton } from "./save-state";
import { useApplication } from "./use-application";

const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
type Row={enabled:boolean;startTime:string;endTime:string};

export function AvailabilityStep(){
  const {data}=useApplication();const router=useRouter();
  const [rows,setRows]=useState<Row[]>(days.map(()=>({enabled:false,startTime:"09:00",endTime:"17:00"})));
  const [initialized,setInitialized]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{if(data&&!initialized){const next=days.map((_,day)=>{const existing=data.schedules.find(item=>item.day_of_week===day);return existing?{enabled:existing.is_active,startTime:existing.start_time.slice(0,5),endTime:existing.end_time.slice(0,5)}:{enabled:false,startTime:"09:00",endTime:"17:00"}});setRows(next);setInitialized(true)}},[data,initialized]);
  function update(index:number,patch:Partial<Row>){setRows(previous=>previous.map((row,i)=>i===index?{...row,...patch}:row))}
  async function save(){setPending(true);setError("");const schedules=rows.flatMap((row,dayOfWeek)=>row.enabled?[{dayOfWeek,startTime:row.startTime,endTime:row.endTime,isActive:true}]:[]);const response=await fetch("/api/v1/professional/application/availability",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({schedules})});const result=await response.json() as ApiEnvelope<{saved:boolean}>;setPending(false);if(!result.success){setError(result.error.message);return}router.push("/professional/application/documents")}
  return <div className="panel-card"><div className="schedule-list">{rows.map((row,index)=><div className={row.enabled?"schedule-row is-enabled":"schedule-row"} key={days[index]}><label className="schedule-day"><input type="checkbox" checked={row.enabled} onChange={event=>update(index,{enabled:event.target.checked})}/><strong>{days[index]}</strong></label><label><span>From</span><input type="time" value={row.startTime} disabled={!row.enabled} onChange={event=>update(index,{startTime:event.target.value})}/></label><label><span>Until</span><input type="time" value={row.endTime} disabled={!row.enabled} onChange={event=>update(index,{endTime:event.target.value})}/></label></div>)}</div>{error?<div className="form-alert form-alert--error">{error}</div>:null}<div className="form-actions"><SaveButton type="button" onClick={save} pending={pending}/></div></div>;
}
