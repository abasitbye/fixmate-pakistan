import { Mail, MapPin } from "lucide-react";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { ContactForm } from "@/components/public/contact-form";

export default function ContactPage(){return <><PublicHeader/><main id="main-content"><section className="inner-hero"><div className="container"><span className="section-kicker section-kicker--light">FixMate Support</span><h1>How can we help?</h1><p>Use this secure, abuse-protected form for account, privacy or professional-application questions.</p></div></section><section className="section"><div className="container contact-grid"><aside><div className="contact-detail"><Mail size={20}/><div><strong>Email</strong><a href="mailto:support@fixmate.pk">support@fixmate.pk</a></div></div><div className="contact-detail"><MapPin size={20}/><div><strong>Launch market</strong><span>Islamabad & Rawalpindi</span></div></div><p>Never send passwords, OTP codes or full payment credentials. FixMate Support will never ask for your one-time sign-in code.</p></aside><ContactForm/></div></section></main><PublicFooter/></>}
