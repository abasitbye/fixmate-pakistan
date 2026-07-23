import "server-only";

import { getAuthenticatedContext, hasAnyRole } from "@/lib/auth/session";

export async function getStaffContext(allowed=["support","admin","super_admin"]){const context=await getAuthenticatedContext();if(!context||context.profile.account_status!=="active"||!hasAnyRole(context.roles,allowed))return null;return context;}
export async function getAdminContext(){return getStaffContext(["admin","super_admin"])}
export async function getSuperAdminContext(){return getStaffContext(["super_admin"])}
