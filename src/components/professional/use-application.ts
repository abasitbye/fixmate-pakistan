"use client";

import { useEffect, useState } from "react";

import type { ApiEnvelope } from "@/lib/api/response";

export type ApplicationData={application:Record<string,unknown>;services:{service_subcategory_id:string}[];areas:{service_zone_id:string}[];schedules:{day_of_week:number;start_time:string;end_time:string;is_active:boolean}[];documents:{id:string;verification_type_id:string;original_file_name:string;review_status:string;review_notes:string|null;verification_types:{code:string;name:string;is_required:boolean}}[];references:{id:string;full_name:string;relationship:string;phone:string;notes:string|null}[];payout:{payout_method:string;account_title:string;is_verified:boolean}|null};

export function useApplication(){const [data,setData]=useState<ApplicationData|null>(null);const [error,setError]=useState("");const reload=()=>fetch("/api/v1/professional/application").then(r=>r.json()).then((result:ApiEnvelope<ApplicationData>)=>{if(result.success)setData(result.data);else setError(result.error.message)}).catch(()=>setError("Application data could not be loaded."));useEffect(()=>{reload()},[]);return{data,error,reload};}
