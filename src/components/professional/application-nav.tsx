import { CheckCircle2 } from "lucide-react";

import { Link } from "@/i18n/navigation";

const steps=[
  ["personal","Personal"],["services","Services"],["areas","Areas"],["availability","Availability"],
  ["documents","Documents"],["references","References"],["payment","Payment"],["review","Review"],
] as const;

export function ApplicationNav({current}:{current:string}){return <nav className="application-nav" aria-label="Application steps">{steps.map(([slug,label],index)=><Link className={slug===current?"is-current":""} href={`/professional/application/${slug}`} key={slug}><span>{slug===current?<CheckCircle2 size={16}/>:index+1}</span>{label}</Link>)}</nav>}
