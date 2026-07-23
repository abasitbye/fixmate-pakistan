"use client";

import { Check, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { ApiEnvelope } from "@/lib/api/response";

type City = { id: string; name: string; service_zones: { id: string; name: string }[] };

export function PropertyForm() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/public/locations")
      .then((response) => response.json())
      .then((result: ApiEnvelope<{ cities: City[] }>) => { if (result.success) setCities(result.data.cities); })
      .catch(() => setError("Service locations could not be loaded."));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/properties", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: values.get("label"), propertyType: values.get("propertyType"),
          addressLine1: values.get("addressLine1"), addressLine2: values.get("addressLine2"),
          cityId: values.get("cityId"), postalCode: values.get("postalCode"),
          accessNotes: values.get("accessNotes"), isDefault: values.get("isDefault") === "on",
        }),
      });
      const result = (await response.json()) as ApiEnvelope<{ property: unknown }>;
      if (!result.success) { setError(result.error.message); return; }
      router.replace("/customer/properties"); router.refresh();
    } catch { setError("Your property could not be saved. Try again."); }
    finally { setPending(false); }
  }

  return (
    <form className="panel-card form-grid" onSubmit={submit}>
      <div className="form-grid__full form-intro"><span className="panel-icon"><MapPin size={21} /></span><div><h2>Property details</h2><p>Saved properties make future service requests faster. Exact addresses remain private.</p></div></div>
      <label><span>Property label</span><input className="text-input" name="label" placeholder="Home, Office, Parents’ house" required maxLength={60} /></label>
      <label><span>Property type</span><select className="text-input" name="propertyType" defaultValue="house"><option value="house">House</option><option value="apartment">Apartment</option><option value="office">Office</option><option value="shop">Shop</option><option value="other">Other</option></select></label>
      <label className="form-grid__full"><span>Address line 1</span><input className="text-input" name="addressLine1" autoComplete="address-line1" required maxLength={180} /></label>
      <label className="form-grid__full"><span>Address line 2 <small>Optional</small></span><input className="text-input" name="addressLine2" autoComplete="address-line2" maxLength={180} /></label>
      <label><span>City</span><select className="text-input" name="cityId" required defaultValue=""><option value="" disabled>Select city</option>{cities.map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label>
      <label><span>Postal code <small>Optional</small></span><input className="text-input" name="postalCode" autoComplete="postal-code" maxLength={20} /></label>
      <label className="form-grid__full"><span>Access notes <small>Optional</small></span><textarea className="text-input textarea-input" name="accessNotes" maxLength={500} placeholder="Gate, floor, parking or accessibility information" /></label>
      <label className="consent-check form-grid__full"><input type="checkbox" name="isDefault" /><span>Use this as my default property</span></label>
      {error ? <div className="form-alert form-alert--error form-grid__full" role="alert">{error}</div> : null}
      <div className="form-actions form-grid__full"><button className="button button--primary button--large" disabled={pending}>{pending ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{pending ? "Saving…" : "Save property"}</button></div>
    </form>
  );
}
