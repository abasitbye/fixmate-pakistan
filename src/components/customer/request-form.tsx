"use client";

import { CalendarClock, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ApiEnvelope } from "@/lib/api/response";
import { useRouter } from "@/i18n/navigation";

type Property = { id: string; label: string; property_type: string };
type Subcategory = { id: string; name_en: string };
type Category = { id: string; name_en: string; service_subcategories: Subcategory[] };

export function RequestForm() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/properties").then((response) => response.json()),
      fetch("/api/v1/public/service-categories").then((response) => response.json()),
    ]).then(([propertyResult, categoryResult]: [
      ApiEnvelope<{ properties: Property[] }>,
      ApiEnvelope<{ categories: Category[] }>,
    ]) => {
      if (propertyResult.success) setProperties(propertyResult.data.properties);
      if (categoryResult.success) setCategories(categoryResult.data.categories);
    }).catch(() => setError("The request form could not be prepared."));
  }, []);

  const subcategories = useMemo(
    () => categories.find((category) => category.id === categoryId)?.service_subcategories ?? [],
    [categories, categoryId],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      propertyId: form.get("propertyId"),
      serviceCategoryId: form.get("serviceCategoryId"),
      serviceSubcategoryId: form.get("serviceSubcategoryId"),
      title: form.get("title"),
      description: form.get("description"),
      urgency: form.get("urgency"),
      pricingPreference: form.get("pricingPreference"),
      preferredDate: form.get("preferredDate"),
      preferredStartTime: form.get("preferredStartTime"),
      preferredEndTime: form.get("preferredEndTime"),
      flexibilityMinutes: Number(form.get("flexibilityMinutes")),
    };
    try {
      const response = await fetch("/api/v1/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `request:${crypto.randomUUID()}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as ApiEnvelope<{ request: { id: string } }>;
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.push(`/customer/requests/${result.data.request.id}`);
      router.refresh();
    } catch {
      setError("Your draft could not be saved. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="panel-card form-grid" onSubmit={submit}>
      <div className="form-grid__full security-note">
        <ShieldCheck size={22} />
        <div>
          <strong>Your exact address stays private</strong>
          <p>Professionals only receive an approximate service area before you select an offer.</p>
        </div>
      </div>
      <label>
        <span>Property</span>
        <select className="text-input" name="propertyId" required defaultValue="">
          <option value="" disabled>Choose a saved property</option>
          {properties.map((property) => <option value={property.id} key={property.id}>{property.label} · {property.property_type}</option>)}
        </select>
      </label>
      <label>
        <span>Service category</span>
        <select className="text-input" name="serviceCategoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="" disabled>Choose a category</option>
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name_en}</option>)}
        </select>
      </label>
      <label>
        <span>Specific service</span>
        <select className="text-input" name="serviceSubcategoryId" required defaultValue="" key={categoryId}>
          <option value="" disabled>Choose the closest service</option>
          {subcategories.map((subcategory) => <option value={subcategory.id} key={subcategory.id}>{subcategory.name_en}</option>)}
        </select>
      </label>
      <label>
        <span>Urgency</span>
        <select className="text-input" name="urgency" defaultValue="standard">
          <option value="standard">Standard</option>
          <option value="same_day">Same day</option>
          <option value="emergency">Emergency — availability is not guaranteed</option>
        </select>
      </label>
      <label className="form-grid__full">
        <span>Short title</span>
        <input className="text-input" name="title" minLength={3} maxLength={120} required placeholder="For example: Kitchen sink is leaking" />
      </label>
      <label className="form-grid__full">
        <span>Describe the problem</span>
        <textarea className="text-input textarea-input" name="description" minLength={10} maxLength={4000} required placeholder="Explain what is happening, when it started, and anything that may help a professional prepare." />
      </label>
      <label>
        <span><CalendarClock size={15} /> Preferred date</span>
        <input className="text-input" name="preferredDate" type="date" required min={new Date().toISOString().slice(0, 10)} />
      </label>
      <label>
        <span>Preferred start time</span>
        <input className="text-input" name="preferredStartTime" type="time" required />
      </label>
      <label>
        <span>Preferred end time <small>Optional</small></span>
        <input className="text-input" name="preferredEndTime" type="time" />
      </label>
      <label>
        <span>Schedule flexibility</span>
        <select className="text-input" name="flexibilityMinutes" defaultValue="60">
          <option value="0">Exact time</option>
          <option value="30">Within 30 minutes</option>
          <option value="60">Within 1 hour</option>
          <option value="120">Within 2 hours</option>
          <option value="240">Within 4 hours</option>
        </select>
      </label>
      <label className="form-grid__full">
        <span>Pricing preference</span>
        <select className="text-input" name="pricingPreference" defaultValue="professional_recommendation">
          <option value="professional_recommendation">Open to professional recommendation</option>
          <option value="fixed_price">Fixed-price offers</option>
          <option value="estimated_range">Estimated price range</option>
          <option value="inspection_required">Inspection required</option>
        </select>
      </label>
      {properties.length === 0 ? <div className="form-alert form-alert--error form-grid__full">Add a property before creating a request.</div> : null}
      {error ? <div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div> : null}
      <div className="form-actions form-grid__full">
        <button className="button button--primary button--large" disabled={pending || properties.length === 0}>
          {pending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
          {pending ? "Saving secure draft…" : "Review request"}
        </button>
      </div>
    </form>
  );
}
