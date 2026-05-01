"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebasePublicConfig } from "@/lib/env/client-public";

function createOrGetApp(): FirebaseApp | null {
  const cfg = getFirebasePublicConfig();
  if (!cfg) {
    return null;
  }

  const firebaseConfig = {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  };

  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

/** Browser Firebase app; `null` until NEXT_PUBLIC_FIREBASE_* vars are configured. */
export function getFirebaseClientApp(): FirebaseApp | null {
  return createOrGetApp();
}

export function getFirebaseClientAuth() {
  const app = getFirebaseClientApp();
  if (!app) {
    return null;
  }
  return getAuth(app);
}

export function getFirebaseClientFirestore() {
  const app = getFirebaseClientApp();
  if (!app) {
    return null;
  }
  return getFirestore(app);
}
