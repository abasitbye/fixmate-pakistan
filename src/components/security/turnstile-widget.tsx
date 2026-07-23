"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { getClientEnvironment } from "@/env/client";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

type Props = {
  action: string;
  onToken: (token: string) => void;
};

export function TurnstileWidget({ action, onToken }: Props) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `turnstile-${reactId}`;
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const renderWidget = useCallback(() => {
    if (!scriptReady || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(`#${containerId}`, {
      sitekey: getClientEnvironment().NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      action,
      theme: "light",
      size: "flexible",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
  }, [action, containerId, onToken, scriptReady]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [renderWidget]);

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div id={containerId} className="turnstile-container" aria-label="Security verification" />
    </>
  );
}
