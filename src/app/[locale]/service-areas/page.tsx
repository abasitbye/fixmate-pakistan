import { PublicInfoPage } from "@/components/public/public-info-page"; import type { AppLocale } from "@/i18n/routing";
export default async function Page({params}:{params:Promise<{locale:string}>}){return <PublicInfoPage pageKey="areas" locale={(await params).locale as AppLocale}/>}
