import type { ReactNode } from "react";

import { ApplicationNav } from "./application-nav";

export function ProfessionalStepShell({step,kicker,title,lead,children}:{step:string;kicker:string;title:string;lead:string;children:ReactNode}){return <><div className="dashboard-heading"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{lead}</p></div><span className="status-chip">Draft saves securely</span></div><ApplicationNav current={step}/>{children}</>}
