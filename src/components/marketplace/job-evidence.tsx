"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/client";

type Media = { id: string; media_stage: string; media_type: string; mime_type: string; file_size: number; caption: string | null };

export function JobEvidence({ jobId, media }: { jobId: string; media: Media[] }) {
  const router = useRouter(); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  const [stage, setStage] = useState("during_work");

  async function upload(file: File) {
    setUploading(true); setError("");
    try {
      const preparedResponse = await fetch(`/api/v1/jobs/${jobId}/media/upload-url`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }) });
      const prepared = await preparedResponse.json() as ApiEnvelope<{ bucket: string; storagePath: string; token: string }>;
      if (!prepared.success) throw new Error(prepared.error.message);
      const { error: uploadError } = await createClient().storage.from(prepared.data.bucket).uploadToSignedUrl(prepared.data.storagePath, prepared.data.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const finalizedResponse = await fetch(`/api/v1/jobs/${jobId}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        fileName: file.name, mimeType: file.type, sizeBytes: file.size, storagePath: prepared.data.storagePath,
        mediaStage: stage, mediaType: file.type === "application/pdf" ? "document" : file.type.startsWith("video/") ? "video" : "image",
      }) });
      const finalized = await finalizedResponse.json() as ApiEnvelope<{ media: Media }>;
      if (!finalized.success) throw new Error(finalized.error.message);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The evidence upload could not be completed."); }
    finally { setUploading(false); }
  }

  return <section className="panel-card"><h2>Private job evidence</h2><p>Upload only job-relevant images, short videos, or PDF receipts. Files use private storage and short-lived access.</p><div className="document-list">{media.map((item) => <article className="document-row" key={item.id}><span className="panel-icon"><FileUp size={18} /></span><div><strong>{item.media_stage.replaceAll("_", " ")}</strong><p>{item.mime_type} · {Math.ceil(item.file_size / 1024)} KB</p></div></article>)}</div><div className="inline-actions"><select className="text-input" value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Evidence stage"><option value="before_work">Before work</option><option value="inspection">Inspection</option><option value="during_work">During work</option><option value="material_receipt">Material receipt</option><option value="change_order_evidence">Change-order evidence</option><option value="after_work">After work / final</option></select><label className="button button--ghost upload-button">{uploading ? <LoaderCircle className="spin" size={17} /> : <FileUp size={17} />}<span>{uploading ? "Uploading…" : "Choose evidence"}</span><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label></div>{error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}</section>;
}
