"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

import { getClientEnvironment } from "@/env/client";

export function getFirebaseApp() {
  if (getApps().length) return getApp();

  const environment = getClientEnvironment();
  return initializeApp({
    apiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId:
      environment.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: environment.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export async function getFirebaseMessaging() {
  if (typeof window === "undefined" || !(await isSupported())) return null;
  return getMessaging(getFirebaseApp());
}

