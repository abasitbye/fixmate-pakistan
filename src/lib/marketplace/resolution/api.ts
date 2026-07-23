import { apiError } from "@/lib/api/response";
const errors: Record<string,[number,string,string]> = {
  JOB_NOT_FOUND:[404,"JOB_NOT_FOUND","The job was not found."], REVIEW_NOT_ELIGIBLE:[409,"REVIEW_NOT_ELIGIBLE","Only eligible completed jobs can be reviewed."],
  REVIEW_ALREADY_SUBMITTED:[409,"REVIEW_ALREADY_SUBMITTED","You already reviewed this job."], REVIEW_NOT_FOUND:[404,"REVIEW_NOT_FOUND","The review was not found."],
  MODERATION_REASON_REQUIRED:[400,"MODERATION_REASON_REQUIRED","A moderation reason is required."], WARRANTY_NOT_FOUND:[404,"WARRANTY_NOT_FOUND","The warranty was not found."],
  WARRANTY_NOT_CLAIMABLE:[409,"WARRANTY_NOT_CLAIMABLE","This warranty cannot accept a normal claim."], CLAIM_NOT_RESPONDABLE:[409,"CLAIM_NOT_RESPONDABLE","This claim is not awaiting a response."],
  CLAIM_NOT_RESOLVABLE:[409,"CLAIM_NOT_RESOLVABLE","This claim cannot be resolved in its current state."], DISPUTE_NOT_FOUND:[404,"DISPUTE_NOT_FOUND","The dispute was not found."],
  CLAIM_NOT_ESCALATABLE:[409,"CLAIM_NOT_ESCALATABLE","This warranty claim cannot be escalated in its current state."],
  ACTIVE_DISPUTE_EXISTS:[409,"ACTIVE_DISPUTE_EXISTS","An active dispute already exists for this category."], INVALID_DISPUTE:[400,"INVALID_DISPUTE","Add the dispute details and requested outcome."],
  DISPUTE_MESSAGE_FORBIDDEN:[403,"DISPUTE_MESSAGE_FORBIDDEN","You cannot access this dispute conversation."], DISPUTE_VISIBILITY_FORBIDDEN:[403,"DISPUTE_VISIBILITY_FORBIDDEN","That message visibility is staff-only."],
  DISPUTE_NOT_RESOLVABLE:[409,"DISPUTE_NOT_RESOLVABLE","This dispute cannot be resolved in its current state."], INVALID_DISPUTE_REFUND:[409,"INVALID_DISPUTE_REFUND","The dispute refund exceeds the confirmed payment."],
  PAYOUT_HAS_HELD_EARNINGS:[409,"PAYOUT_HAS_HELD_EARNINGS","This payout contains earnings held by an active dispute."], IDEMPOTENCY_CONFLICT:[409,"IDEMPOTENCY_CONFLICT","That action key was reused with different information."],
};
export function resolutionCommandError(error:{message?:string}|null){const match=Object.entries(errors).find(([key])=>error?.message?.includes(key));if(!match)return apiError(500,"RESOLUTION_COMMAND_FAILED","The case action could not be completed.");const [,v]=match;return apiError(v[0],v[1],v[2]);}
