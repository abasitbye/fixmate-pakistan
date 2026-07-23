import type { AppLocale } from "@/i18n/routing";

export type PublicPageKey = "how" | "safety" | "areas" | "about" | "faq" | "privacy" | "terms" | "code" | "professional";
type Copy = { kicker: string; title: string; lead: string; sections: { title: string; body: string }[] };

const en: Record<PublicPageKey, Copy> = {
  how: { kicker: "Clear from start to finish", title: "How FixMate works", lead: "FixMate is being built as a managed home-services marketplace—not a directory or classifieds board.", sections: [
    { title: "Describe the problem", body: "Choose a service and explain what needs attention. Photos and voice notes will be supported when service requests launch in Phase 2." },
    { title: "Review before anything starts", body: "Suitable professionals, timing, scope and price are presented clearly. Chargeable work begins only after customer approval." },
    { title: "Keep a reliable record", body: "Important job events, payment records, evidence and support history will stay connected to the service journey." },
  ] },
  safety: { kicker: "Safety before speed", title: "Trust is part of the workflow", lead: "Identity checks, least-privilege access and recorded decisions are built into FixMate from the foundation.", sections: [
    { title: "Professional verification", body: "Applicants provide identity, skill and reference information. A visible professional role is granted only after an authorized review." },
    { title: "Private customer information", body: "Exact addresses, contact details and documents are private. Database ownership rules apply even if a client request is manipulated." },
    { title: "Human support and auditability", body: "Sensitive operational decisions create append-only audit records so authorized teams can understand what changed and why." },
  ] },
  areas: { kicker: "Initial launch market", title: "Islamabad and Rawalpindi", lead: "FixMate is starting with a focused service area so operations, verification and support can be handled properly.", sections: [
    { title: "City-level availability", body: "The Phase 1 platform supports Islamabad and Rawalpindi. Administrators can activate service zones without a code release." },
    { title: "No invented coverage", body: "A neighborhood is shown only after the FixMate operations team has deliberately configured and activated it." },
  ] },
  about: { kicker: "Built for Pakistan", title: "A more accountable way to arrange home repairs", lead: "FixMate Pakistan connects customers and verified professionals through a managed, mobile-ready service platform.", sections: [
    { title: "Our purpose", body: "Make everyday repairs easier to understand, safer to arrange and simpler to support for households and skilled professionals." },
    { title: "Our approach", body: "Build the operational foundation first: secure accounts, roles, verification, service areas, notifications and auditable administration." },
  ] },
  faq: { kicker: "Straight answers", title: "Frequently asked questions", lead: "The current release is the Phase 1 foundation. Marketplace transactions arrive in Phase 2.", sections: [
    { title: "Can I request a repair today?", body: "Not yet. Phase 1 prepares accounts, properties and professional verification without pretending that live booking is available." },
    { title: "How are professionals approved?", body: "Applicants submit services, areas, availability, documents and references. Authorized FixMate staff review each application and record decisions." },
    { title: "Will there be a mobile app?", body: "Yes. The web platform is API-first and responsive, with shared contracts designed to support the future Android and iOS apps." },
  ] },
  privacy: { kicker: "Privacy notice", title: "Your information is handled with purpose", lead: "This Phase 1 notice explains the data FixMate needs for accounts, properties, verification and platform security.", sections: [
    { title: "Data we collect", body: "Account identity, contact preferences, saved properties, professional application material, consents, security events and support records." },
    { title: "Why we use it", body: "To authenticate users, provide requested features, verify professionals, prevent abuse, send essential notifications and meet operational obligations." },
    { title: "Access and retention", body: "Access is role-restricted and logged where appropriate. Retention depends on account, verification, security and legal needs. Contact support for privacy requests." },
  ] },
  terms: { kicker: "Platform terms", title: "Terms of Service", lead: "These foundation terms govern account access and Phase 1 features. Transaction-specific terms will be introduced before marketplace launch.", sections: [
    { title: "Account responsibility", body: "Provide accurate information, keep access to your email secure and do not misuse the platform, impersonate others or attempt to bypass access controls." },
    { title: "Professional applications", body: "Submitting an application does not guarantee approval or work. FixMate may request changes, verify information, reject or suspend access for legitimate safety reasons." },
    { title: "Current service boundary", body: "Phase 1 does not offer live jobs, estimates, bookings, payments, warranties or dispute outcomes. Those capabilities remain outside this release." },
  ] },
  code: { kicker: "Professional standards", title: "FixMate Professional Code", lead: "Approved professionals are expected to work safely, communicate clearly and protect every customer’s home and privacy.", sections: [
    { title: "Honesty and competence", body: "Represent skills truthfully, accept only suitable work, explain risks and never create unnecessary repairs or charges." },
    { title: "Respect and safety", body: "Arrive professionally, respect property and personal boundaries, follow safety requirements and protect confidential customer information." },
    { title: "Transparent work", body: "Document important findings, seek approval before chargeable changes and cooperate with legitimate support or quality reviews." },
  ] },
  professional: { kicker: "For skilled professionals", title: "Build a trusted digital reputation", lead: "Create a draft application, describe your services and submit verification material through a guided mobile-friendly workflow.", sections: [
    { title: "What you will provide", body: "Personal and professional information, service categories, coverage areas, weekly availability, identity documents and two references." },
    { title: "How review works", body: "Applications move through controlled statuses. You can respond to requested changes, while approval and verification decisions remain with authorized staff." },
    { title: "What Phase 1 does not promise", body: "Approval does not guarantee jobs or income. Job matching, customer requests and payouts will be introduced in later phases." },
  ] },
};

const ur: Record<PublicPageKey, Copy> = {
  how:{kicker:"شروع سے آخر تک واضح",title:"FixMate کیسے کام کرتا ہے",lead:"FixMate ایک منظم ہوم سروس پلیٹ فارم ہے، صرف ڈائریکٹری نہیں۔",sections:[{title:"مسئلہ بتائیں",body:"سروس منتخب کریں اور مسئلہ واضح کریں۔ فیز 2 میں تصاویر اور وائس نوٹس بھی شامل ہوں گے۔"},{title:"کام سے پہلے منظوری",body:"وقت، کام کی حد اور قیمت واضح ہوگی۔ قابل ادائیگی کام صرف گاہک کی منظوری کے بعد شروع ہوگا۔"},{title:"مکمل ریکارڈ",body:"اہم مراحل، ادائیگی اور سپورٹ کا ریکارڈ محفوظ رکھا جائے گا۔"}]},
  safety:{kicker:"رفتار سے پہلے حفاظت",title:"اعتماد پورے نظام کا حصہ ہے",lead:"شناخت، محدود رسائی اور فیصلوں کا ریکارڈ ابتدا ہی سے شامل ہے۔",sections:[{title:"پروفیشنل کی تصدیق",body:"درخواست گزار شناخت، مہارت اور حوالہ جات دیتے ہیں۔ منظوری صرف مجاز جائزے کے بعد ہوتی ہے۔"},{title:"گاہک کی رازداری",body:"پتے، رابطہ معلومات اور دستاویزات نجی رہتی ہیں اور ڈیٹا بیس کی حفاظتی پالیسیاں لاگو ہوتی ہیں۔"},{title:"ریکارڈ شدہ فیصلے",body:"اہم انتظامی تبدیلیاں آڈٹ لاگ میں محفوظ ہوتی ہیں۔"}]},
  areas:{kicker:"ابتدائی سروس مارکیٹ",title:"اسلام آباد اور راولپنڈی",lead:"FixMate محدود علاقے سے آغاز کر رہا ہے تاکہ معیار اور سپورٹ مضبوط رہے۔",sections:[{title:"شہر کی دستیابی",body:"فیز 1 میں اسلام آباد اور راولپنڈی شامل ہیں۔"},{title:"درست کوریج",body:"صرف وہی زون دکھائے جائیں گے جو آپریشنز ٹیم باقاعدہ فعال کرے گی۔"}]},
  about:{kicker:"پاکستان کے لیے",title:"گھریلو مرمت کا زیادہ ذمہ دار طریقہ",lead:"FixMate گاہکوں اور تصدیق شدہ ہنرمندوں کو محفوظ پلیٹ فارم پر ملاتا ہے۔",sections:[{title:"ہمارا مقصد",body:"روزمرہ مرمت کو سمجھنا، طے کرنا اور سپورٹ حاصل کرنا آسان بنانا۔"},{title:"ہمارا طریقہ",body:"پہلے محفوظ اکاؤنٹس، تصدیق، علاقوں اور انتظامی بنیاد کو مضبوط بنانا۔"}]},
  faq:{kicker:"واضح جوابات",title:"اکثر پوچھے گئے سوالات",lead:"موجودہ ریلیز فیز 1 کی بنیاد ہے؛ مارکیٹ پلیس فیز 2 میں آئے گی۔",sections:[{title:"کیا ابھی مرمت بک ہو سکتی ہے؟",body:"ابھی نہیں۔ فیز 1 اکاؤنٹس اور تصدیق تیار کرتا ہے۔"},{title:"پروفیشنل کیسے منظور ہوتے ہیں؟",body:"سروسز، علاقے، دستیابی، دستاویزات اور حوالہ جات کا مجاز ٹیم جائزہ لیتی ہے۔"},{title:"کیا موبائل ایپ آئے گی؟",body:"جی ہاں۔ ویب پلیٹ فارم API-first اور موبائل کے لیے تیار ہے۔"}]},
  privacy:{kicker:"رازداری",title:"آپ کی معلومات مقصد کے ساتھ استعمال ہوتی ہیں",lead:"یہ نوٹس اکاؤنٹ، جائیداد اور تصدیق کے ڈیٹا کے استعمال کی وضاحت کرتا ہے۔",sections:[{title:"جمع کیا جانے والا ڈیٹا",body:"شناخت، رابطہ، محفوظ پتے، درخواست کی دستاویزات، رضامندی اور سکیورٹی ریکارڈ۔"},{title:"استعمال کی وجہ",body:"لاگ ان، فیچرز، تصدیق، غلط استعمال کی روک تھام اور ضروری اطلاعات۔"},{title:"رسائی اور مدت",body:"رسائی کردار کے مطابق محدود ہے۔ رازداری کی درخواست کے لیے سپورٹ سے رابطہ کریں۔"}]},
  terms:{kicker:"پلیٹ فارم شرائط",title:"سروس کی شرائط",lead:"یہ شرائط فیز 1 کے اکاؤنٹس اور فیچرز پر لاگو ہیں۔",sections:[{title:"اکاؤنٹ کی ذمہ داری",body:"درست معلومات دیں اور رسائی کے حفاظتی نظام کو نقصان پہنچانے کی کوشش نہ کریں۔"},{title:"پروفیشنل درخواست",body:"درخواست جمع کرنا منظوری یا کام کی ضمانت نہیں ہے۔"},{title:"موجودہ حد",body:"فیز 1 میں بکنگ، ادائیگی، وارنٹی یا تنازعہ کا نظام شامل نہیں۔"}]},
  code:{kicker:"پیشہ ورانہ معیار",title:"FixMate پروفیشنل ضابطہ",lead:"منظور شدہ ہنرمند حفاظت، وضاحت اور گاہک کی رازداری کا احترام کریں گے۔",sections:[{title:"دیانت اور مہارت",body:"اپنی مہارت درست بتائیں اور غیر ضروری کام یا قیمت نہ بنائیں۔"},{title:"احترام اور حفاظت",body:"گھر، ذاتی حدود اور حفاظتی اصولوں کا احترام کریں۔"},{title:"شفاف کام",body:"قابل ادائیگی تبدیلی سے پہلے منظوری لیں اور اہم معلومات درج کریں۔"}]},
  professional:{kicker:"ہنرمندوں کے لیے",title:"قابل اعتماد ڈیجیٹل ساکھ بنائیں",lead:"رہنمائی کے ساتھ اپنی خدمات اور تصدیقی معلومات جمع کریں۔",sections:[{title:"ضروری معلومات",body:"ذاتی معلومات، خدمات، علاقے، دستیابی، شناختی دستاویزات اور دو حوالہ جات۔"},{title:"جائزے کا طریقہ",body:"درخواست کے ہر مرحلے کی محفوظ اور باقاعدہ تبدیلی ہوتی ہے۔"},{title:"فیز 1 کی حد",body:"منظوری کام یا آمدنی کی ضمانت نہیں۔ ملاپ اور ادائیگی بعد کے مرحلے میں ہوگی۔"}]},
};

const roman: Record<PublicPageKey, Copy> = {
  how:{kicker:"Shuru se aakhir tak wazeh",title:"FixMate kaise kaam karta hai",lead:"FixMate ek managed home-service platform hai, sirf directory nahin.",sections:[{title:"Masla batayein",body:"Service chunein aur masla samjhayein. Phase 2 mein photos aur voice notes bhi honge."},{title:"Kaam se pehle manzoori",body:"Waqt, scope aur qeemat wazeh hogi. Paid kaam customer ki approval ke baad shuru hoga."},{title:"Mukammal record",body:"Aham stages, payment aur support ka record mehfooz rahega."}]},
  safety:{kicker:"Raftar se pehle hifazat",title:"Aitmaad poore workflow ka hissa hai",lead:"Identity, limited access aur decisions ka record bunyaad se shamil hai.",sections:[{title:"Professional verification",body:"Applicant identity, skills aur references deta hai; approval authorized review ke baad hoti hai."},{title:"Customer privacy",body:"Address, contact aur documents private rehte hain."},{title:"Recorded decisions",body:"Aham admin tabdeeliyan audit log mein mehfooz hoti hain."}]},
  areas:{kicker:"Ibtidai service market",title:"Islamabad aur Rawalpindi",lead:"FixMate focused area se shuru ho raha hai taa-ke quality aur support mazboot rahe.",sections:[{title:"City availability",body:"Phase 1 mein Islamabad aur Rawalpindi shamil hain."},{title:"Sahi coverage",body:"Sirf operations team ke active kiye huay zones dikhaye jayenge."}]},
  about:{kicker:"Pakistan ke liye",title:"Gharelu marammat ka zyada zimmedar tareeqa",lead:"FixMate customers aur verified professionals ko secure platform par milata hai.",sections:[{title:"Hamara maqsad",body:"Rozmarra repairs ko samajhna aur support lena asaan banana."},{title:"Hamara tareeqa",body:"Pehle secure accounts, verification aur operations ki bunyaad mazboot banana."}]},
  faq:{kicker:"Seedhe jawab",title:"Aksar poochay gaye sawalat",lead:"Mojooda release Phase 1 foundation hai; marketplace Phase 2 mein ayegi.",sections:[{title:"Kya abhi repair book ho sakti hai?",body:"Abhi nahin. Phase 1 accounts aur verification tayyar karta hai."},{title:"Professionals kaise approve honge?",body:"Authorized team services, areas, documents aur references review karegi."},{title:"Kya mobile app ayegi?",body:"Ji haan. Web platform API-first aur mobile-ready hai."}]},
  privacy:{kicker:"Privacy notice",title:"Aap ki maloomat maqsad ke saath use hoti hai",lead:"Yeh notice account, property aur verification data ka istemal samjhata hai.",sections:[{title:"Hum kya collect karte hain",body:"Identity, contact, saved addresses, application documents, consents aur security records."},{title:"Kyun use karte hain",body:"Login, verification, abuse prevention aur zaroori notifications ke liye."},{title:"Access aur retention",body:"Access role ke mutabiq limited hai. Privacy request ke liye support se rabta karein."}]},
  terms:{kicker:"Platform terms",title:"Service ki sharaait",lead:"Yeh sharaait Phase 1 accounts aur features par lagu hain.",sections:[{title:"Account zimmedari",body:"Sahi maloomat dein aur security controls bypass na karein."},{title:"Professional application",body:"Application se approval ya kaam ki guarantee nahin hoti."},{title:"Mojooda boundary",body:"Phase 1 mein bookings, payments, warranty ya disputes shamil nahin."}]},
  code:{kicker:"Professional standards",title:"FixMate Professional Code",lead:"Approved professionals safety, clarity aur customer privacy ka ehtiram karein.",sections:[{title:"Imandari aur skill",body:"Apni skills sahi batayein aur ghair-zaroori kaam na banayein."},{title:"Izzat aur hifazat",body:"Ghar, personal boundaries aur safety rules ka ehtiram karein."},{title:"Transparent work",body:"Paid tabdeeli se pehle approval lein aur aham findings record karein."}]},
  professional:{kicker:"Skilled professionals ke liye",title:"Trusted digital reputation banayein",lead:"Guided workflow mein services aur verification details submit karein.",sections:[{title:"Kya dena hoga",body:"Personal info, services, areas, availability, identity documents aur do references."},{title:"Review kaise hoga",body:"Application ke har status ki controlled tabdeeli hogi."},{title:"Phase 1 boundary",body:"Approval jobs ya income ki guarantee nahin; matching aur payout baad mein ayenge."}]},
};

en.privacy = {
  kicker: "Privacy notice · version 2.0",
  title: "Your marketplace information is handled with purpose",
  lead:
    "This notice covers FixMate accounts, professional matching, service transactions and the records needed to keep the marketplace safe and accountable.",
  sections: [
    {
      title: "Service, address and communication data",
      body:
        "We use request details, approved media, approximate matching areas, booking addresses, job communication and consented en-route location to provide the service. Exact addresses are released only after the appropriate booking step, and short-lived location points are deleted on a minimized schedule.",
    },
    {
      title: "Payments, reviews, warranties and disputes",
      body:
        "We retain provider-neutral payment metadata, receipts, approved reviews, warranty records and protected dispute evidence. FixMate does not store raw card, wallet PIN or online-banking credentials.",
    },
    {
      title: "Retention and account deletion",
      body:
        "Optional profile data can be removed or anonymized through a controlled request. Accounting, fraud-prevention, active warranty, active dispute, audit and legal records may be preserved for the documented retention period.",
    },
  ],
};

en.terms = {
  kicker: "Platform terms · version 2.0",
  title: "Marketplace Terms of Service",
  lead:
    "These terms cover service requests, matching, bookings, approved work, payments, reviews, warranties and dispute support on FixMate Pakistan.",
  sections: [
    {
      title: "Requests, matching and approved scope",
      body:
        "Users must provide accurate information. Professional selection is not based on price alone, and chargeable work or changes require the customer’s recorded approval. Exact customer details remain restricted until the appropriate booking stage.",
    },
    {
      title: "Payments and platform records",
      body:
        "Cash and manual-payment records describe the agreed transaction; an online provider is available only when separately configured. Fees, refunds and professional earnings follow the effective rules and auditable ledger entries shown by the platform.",
    },
    {
      title: "Reviews, warranty and dispute support",
      body:
        "Reviews must reflect eligible completed jobs. Warranty coverage comes from the accepted quotation and its exclusions. FixMate may hold disputed earnings, review evidence and apply documented account consequences with a human review and appeal path.",
    },
  ],
};

ur.privacy = {
  kicker: "رازداری کا نوٹس · ورژن 2.0",
  title: "مارکیٹ پلیس کی معلومات واضح مقصد کے ساتھ استعمال ہوتی ہیں",
  lead:
    "یہ نوٹس فکس میٹ اکاؤنٹس، پیشہ ورانہ میچنگ، سروس لین دین اور محفوظ مارکیٹ پلیس کے ضروری ریکارڈ پر لاگو ہوتا ہے۔",
  sections: [
    {
      title: "سروس، پتہ اور رابطے کا ڈیٹا",
      body:
        "درخواست، منظور شدہ میڈیا، اندازاً علاقہ، بکنگ کا پتہ، جاب گفتگو اور رضامندی سے شیئر کیا گیا مختصر لوکیشن ڈیٹا سروس کے لیے استعمال ہوتا ہے۔ مکمل پتہ مناسب بکنگ مرحلے کے بعد دیا جاتا ہے۔",
    },
    {
      title: "ادائیگی، جائزے، وارنٹی اور تنازعات",
      body:
        "ادائیگی کا محدود میٹا ڈیٹا، رسیدیں، منظور شدہ جائزے، وارنٹی ریکارڈ اور محفوظ تنازعہ ثبوت رکھے جاتے ہیں۔ کارڈ، والٹ پن یا آن لائن بینکنگ کی خفیہ معلومات محفوظ نہیں کی جاتیں۔",
    },
    {
      title: "مدت اور اکاؤنٹ حذف کرنا",
      body:
        "اختیاری پروفائل ڈیٹا باقاعدہ درخواست پر حذف یا گمنام کیا جا سکتا ہے۔ مالی، فراڈ روک تھام، فعال وارنٹی، فعال تنازعہ، آڈٹ اور قانونی ریکارڈ مقررہ مدت تک محفوظ رہ سکتے ہیں۔",
    },
  ],
};

ur.terms = {
  kicker: "پلیٹ فارم شرائط · ورژن 2.0",
  title: "مارکیٹ پلیس کی سروس شرائط",
  lead:
    "یہ شرائط فکس میٹ پاکستان پر سروس درخواست، میچنگ، بکنگ، منظور شدہ کام، ادائیگی، جائزے، وارنٹی اور تنازعہ سپورٹ پر لاگو ہوتی ہیں۔",
  sections: [
    {
      title: "درخواست، میچنگ اور منظور شدہ کام",
      body:
        "درست معلومات دینا ضروری ہے۔ پیشہ ور کا انتخاب صرف قیمت پر نہیں، اور قابلِ ادائیگی کام یا تبدیلی کے لیے کسٹمر کی درج شدہ منظوری ضروری ہے۔",
    },
    {
      title: "ادائیگی اور پلیٹ فارم ریکارڈ",
      body:
        "نقد اور دستی ادائیگی کا ریکارڈ متفقہ لین دین کو ظاہر کرتا ہے۔ آن لائن ادائیگی صرف الگ سے فراہم کنندہ ترتیب ہونے پر دستیاب ہوگی۔",
    },
    {
      title: "جائزے، وارنٹی اور تنازعہ",
      body:
        "جائزہ صرف اہل مکمل جاب کے لیے ہے۔ وارنٹی منظور شدہ کوٹیشن اور اس کی حدود کے مطابق ہے۔ تنازعہ میں ثبوت، انسانی جائزہ اور اپیل کا راستہ موجود ہے۔",
    },
  ],
};

roman.privacy = {
  kicker: "Privacy notice · version 2.0",
  title: "Marketplace maloomat wazeh maqsad ke saath use hoti hai",
  lead:
    "Yeh notice accounts, professional matching, service transactions aur marketplace safety records par lagu hai.",
  sections: [
    {
      title: "Service, address aur communication data",
      body:
        "Request details, approved media, andazay ka area, booking address, job chat aur razamandi wala short-lived location data service ke liye use hota hai. Exact address sahi booking stage ke baad milta hai.",
    },
    {
      title: "Payments, reviews, warranty aur disputes",
      body:
        "Limited payment metadata, receipts, approved reviews, warranty records aur protected dispute evidence rakha jata hai. Raw card, wallet PIN ya online-banking credentials store nahin hotay.",
    },
    {
      title: "Retention aur account deletion",
      body:
        "Optional profile data controlled request par delete ya anonymize ho sakta hai. Accounting, fraud prevention, active warranty, dispute, audit aur legal records documented muddat tak reh sakte hain.",
    },
  ],
};

roman.terms = {
  kicker: "Platform terms · version 2.0",
  title: "Marketplace service ki sharaait",
  lead:
    "Yeh sharaait service requests, matching, booking, approved work, payments, reviews, warranty aur dispute support par lagu hain.",
  sections: [
    {
      title: "Request, matching aur approved scope",
      body:
        "Sahi maloomat dena zaroori hai. Professional sirf price par select nahin hota aur paid kaam ya tabdeeli ke liye customer ki recorded approval chahiye.",
    },
    {
      title: "Payments aur platform records",
      body:
        "Cash aur manual payment record agreed transaction dikhata hai. Online provider sirf alag configuration ke baad available hoga.",
    },
    {
      title: "Reviews, warranty aur disputes",
      body:
        "Review sirf eligible completed job par hota hai. Warranty accepted quotation ki coverage aur exclusions ke mutabiq hai. Dispute mein evidence, human review aur appeal ka raasta hota hai.",
    },
  ],
};

en.faq = {
  kicker: "Straight answers",
  title: "Frequently asked questions",
  lead:
    "FixMate’s operational marketplace connects customers with approved professionals in configured service areas.",
  sections: [
    {
      title: "How do I request a repair?",
      body:
        "Sign in, select a saved property, describe the problem and submit the request. FixMate shares only safe request details while suitable professionals are matched.",
    },
    {
      title: "When does a price become final?",
      body:
        "Offers may be fixed, estimated or inspection-based. Chargeable work follows the customer-approved quotation and any later approved change order.",
    },
    {
      title: "What happens if something goes wrong?",
      body:
        "The job record supports completion issues, payment review, warranty claims and evidence-based disputes. Account consequences require authorized human review.",
    },
  ],
};

ur.faq = {
  kicker: "واضح جوابات",
  title: "اکثر پوچھے گئے سوالات",
  lead:
    "فکس میٹ کا عملی مارکیٹ پلیس کسٹمرز کو فعال علاقوں میں منظور شدہ پیشہ وروں سے ملاتا ہے۔",
  sections: [
    {
      title: "مرمت کی درخواست کیسے دوں؟",
      body:
        "سائن اِن کریں، محفوظ جائیداد منتخب کریں، مسئلہ بیان کریں اور درخواست جمع کریں۔ میچنگ کے دوران صرف ضروری محفوظ معلومات دکھائی جاتی ہیں۔",
    },
    {
      title: "قیمت کب حتمی ہوتی ہے؟",
      body:
        "آفر مقررہ، اندازاً یا معائنے پر مبنی ہو سکتی ہے۔ قابلِ ادائیگی کام منظور شدہ کوٹیشن اور بعد کی منظور شدہ تبدیلی کے مطابق ہوتا ہے۔",
    },
    {
      title: "مسئلہ ہو تو کیا ہوگا؟",
      body:
        "جاب ریکارڈ تکمیل کے مسئلے، ادائیگی کے جائزے، وارنٹی کلیم اور ثبوت پر مبنی تنازعہ کو سپورٹ کرتا ہے۔",
    },
  ],
};

roman.faq = {
  kicker: "Seedhe jawab",
  title: "Aksar poochay gaye sawalat",
  lead:
    "FixMate ka operational marketplace customers ko active service areas mein approved professionals se milata hai.",
  sections: [
    {
      title: "Repair request kaise dein?",
      body:
        "Sign in karein, saved property select karein, masla samjhayein aur request submit karein. Matching mein sirf safe zaroori details share hoti hain.",
    },
    {
      title: "Price final kab hoti hai?",
      body:
        "Offer fixed, estimated ya inspection-based ho sakti hai. Paid kaam approved quotation aur approved change order ke mutabiq hota hai.",
    },
    {
      title: "Masla honay par kya hoga?",
      body:
        "Job record completion issue, payment review, warranty claim aur evidence-based dispute support karta hai.",
    },
  ],
};

export function getPublicPageCopy(key: PublicPageKey, locale: AppLocale) {
  return locale === "ur" ? ur[key] : locale === "ur-Latn" ? roman[key] : en[key];
}
