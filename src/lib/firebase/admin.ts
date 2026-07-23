import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import { getClientEnvironment } from "@/env/client";
import { getServerEnvironment } from "@/env/server";

export function getFirebaseAdminMessaging() {
  if (!getApps().length) {
    const clientEnvironment = getClientEnvironment();
    const serverEnvironment = getServerEnvironment();

    initializeApp({
      credential: cert({
        projectId: clientEnvironment.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: serverEnvironment.FIREBASE_CLIENT_EMAIL,
        privateKey: serverEnvironment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  return getMessaging();
}

