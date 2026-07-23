import { z } from "zod";
export const applicationDecisionSchema=z.object({status:z.enum(["under_review","changes_requested","approved","rejected","suspended"]),notes:z.string().trim().max(2000).optional().or(z.literal(""))});
export const documentDecisionSchema=z.object({status:z.enum(["approved","rejected","expired"]),notes:z.string().trim().max(1000).optional().or(z.literal(""))});
export const accountStatusSchema=z.object({status:z.enum(["active","suspended","disabled"]),reason:z.string().trim().max(1000).optional().or(z.literal(""))});
export const roleChangeSchema=z.object({userProfileId:z.uuid(),role:z.enum(["professional","support","admin","super_admin"]),active:z.boolean()});
export const supportNoteSchema=z.object({subjectUserProfileId:z.uuid(),note:z.string().trim().min(3).max(3000),isSensitive:z.boolean().default(false)});
