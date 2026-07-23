"use client";

import { FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ApiEnvelope } from "@/lib/api/response";
import { useRouter } from "@/i18n/navigation";

type Media = { id: string; media_type: string; mime_type: string; file_size: number; caption: string | null };

export function RequestMedia({ requestId, status, media }: { requestId: string; status: string; media: Media[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const prepareResponse = await fetch(`/api/v1/requests/${requestId}/media/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const prepared = await prepareResponse.json() as ApiEnvelope<{ bucket: string; storagePath: string; token: string }>;
      if (!prepared.success) throw new Error(prepared.error.message);
      const { error: uploadError } = await createClient().storage
        .from(prepared.data.bucket)
        .uploadToSignedUrl(prepared.data.storagePath, prepared.data.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const finalizeResponse = await fetch(`/api/v1/requests/${requestId}/media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath: prepared.data.storagePath,
          mediaType: file.type.startsWith("video/") ? "video" : "image",
        }),
      });
      const finalized = await finalizeResponse.json() as ApiEnvelope<{ media: Media }>;
      if (!finalized.success) throw new Error(finalized.error.message);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The media upload could not be completed.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(mediaId: string) {
    await fetch(`/api/v1/requests/${requestId}/media/${mediaId}`, { method: "DELETE" });
    router.refresh();
  }

  return <section className="panel-card">
    <h2>Photos and short videos</h2>
    <p>Add clear evidence of the issue. Files stay private and are shared only with eligible professionals.</p>
    <div className="document-list">
      {media.map((item) => <article className="document-row" key={item.id}>
        <span className="panel-icon"><FileUp size={19} /></span>
        <div><strong>{item.media_type === "video" ? "Short video" : "Image"}</strong><p>{item.mime_type} · {Math.ceil(item.file_size / 1024)} KB</p></div>
        {status === "draft" ? <button className="icon-button" onClick={() => remove(item.id)} aria-label="Remove media"><Trash2 size={17} /></button> : null}
      </article>)}
    </div>
    {status === "draft" ? <label className="button button--ghost upload-button">
      {uploading ? <LoaderCircle className="spin" size={17} /> : <FileUp size={17} />}
      <span>{uploading ? "Uploading securely…" : "Choose image or video"}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={uploading} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) upload(file);
      }} />
    </label> : null}
    {error ? <div className="form-alert form-alert--error" role="alert">{error}</div> : null}
  </section>;
}
