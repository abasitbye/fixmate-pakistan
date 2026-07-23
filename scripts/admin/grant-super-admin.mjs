import process from "node:process";
import nextEnvironment from "@next/env";
import {createClient} from "@supabase/supabase-js";

const {loadEnvConfig}=nextEnvironment;loadEnvConfig(process.cwd());
const emailArgument=process.argv.find(value=>value.startsWith("--email="))?.slice(8)?.trim().toLowerCase();
const confirmation=process.argv.find(value=>value.startsWith("--confirm="))?.slice(10);
if(!emailArgument||confirmation!=="GRANT_SUPER_ADMIN")throw new Error("Usage: pnpm admin:grant-super -- --email=user@example.com --confirm=GRANT_SUPER_ADMIN");
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase server environment is required.");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});let targetUser;
for(let page=1;page<=20&&!targetUser;page++){const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});if(error)throw error;targetUser=data.users.find(user=>user.email?.toLowerCase()===emailArgument);if(data.users.length<100)break;}
if(!targetUser)throw new Error("The user must complete email OTP sign-in before elevated access can be granted.");
const {data:profile,error:profileError}=await admin.from("user_profiles").select("id").eq("auth_user_id",targetUser.id).single();if(profileError)throw profileError;
const {data:role,error:roleError}=await admin.from("roles").select("id").eq("code","super_admin").single();if(roleError)throw roleError;
const {error:grantError}=await admin.from("user_roles").upsert({user_profile_id:profile.id,role_id:role.id,is_active:true,revoked_at:null},{onConflict:"user_profile_id,role_id"});if(grantError)throw grantError;
await admin.from("audit_logs").insert({action:"bootstrap.super_admin",entity_type:"user_profile",entity_id:profile.id,after_data:{method:"operator_script"}});
console.log("Super administrator access granted and audited.");
