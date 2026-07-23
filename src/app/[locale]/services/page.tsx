import { Drill, Hammer, Microwave, Snowflake, Wrench, Zap } from "lucide-react";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import type { AppLocale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";

const icons = { Wrench, Zap, Snowflake, Microwave, Hammer, Drill };

export default async function ServicesPage({params}:{params:Promise<{locale:string}>}) {
  const locale=(await params).locale as AppLocale;
  const admin=createAdminClient();
  const {data}=await admin.from("service_categories").select("id,slug,name_en,name_ur,name_roman_ur,icon_name,service_subcategories(id,name_en,name_ur,name_roman_ur,display_order,is_active)").eq("is_active",true).order("display_order");
  const nameFor=(item:{name_en:string;name_ur:string;name_roman_ur:string})=>locale==="ur"?item.name_ur:locale==="ur-Latn"?item.name_roman_ur:item.name_en;
  return <><PublicHeader/><main id="main-content"><section className="inner-hero"><div className="container"><span className="section-kicker section-kicker--light">48 launch services</span><h1>{locale==="ur"?"گھریلو مرمت کی خدمات":locale==="ur-Latn"?"Gharelu marammat ki services":"Home repair services"}</h1><p>{locale==="ur"?"فیز 2 میں درست ہنرمند سے ملانے کے لیے واضح سروس اقسام۔":locale==="ur-Latn"?"Phase 2 mein sahi professional se milane ke liye wazeh service categories.":"Clear categories designed to route future requests to the right kind of professional in Phase 2."}</p></div></section><section className="section services-catalog"><div className="container catalog-grid">{(data??[]).map(category=>{const Icon=icons[(category.icon_name??"Wrench") as keyof typeof icons]??Wrench;return <article className="catalog-card" key={category.id}><span className="service-card__icon"><Icon size={24}/></span><h2>{nameFor(category)}</h2><ul>{category.service_subcategories?.filter(item=>item.is_active).sort((a,b)=>a.display_order-b.display_order).map(item=><li key={item.id}>{nameFor(item)}</li>)}</ul></article>})}</div></section></main><PublicFooter/></>;
}
