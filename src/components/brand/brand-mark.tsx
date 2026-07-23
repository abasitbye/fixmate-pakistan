import { Wrench } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("brand-mark", className)}
      aria-label="FixMate Pakistan home"
    >
      <span className="brand-mark__icon" aria-hidden="true">
        <Wrench size={19} strokeWidth={2.4} />
      </span>
      <span className="brand-mark__text">
        <strong>FIXMATE</strong>
        <small>PAKISTAN</small>
      </span>
    </Link>
  );
}

