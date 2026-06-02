// src/firebaseMessaging.js

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { db, getFirebaseMessaging } from "./firebase";

const ACCOUNTING_APP_ID = "jolab-solutions-comptabilite";

const VAPID_KEY =
  "BGbZHN1SRUbOaLzRf_qErL13YPQYXP5czpqBut1jHUag-mKscKXunaLI1Q0Q4r-6J9H_lB24G9bFKItlMKYmKyE";

function getDeviceLabel() {
  const ua = navigator.userAgent || "";

  if (ua.includes("Edg")) return "Microsoft Edge";
  if (ua.includes("CriOS")) return "Chrome iOS";
  if (ua.includes("Chrome")) return "Google Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";

  return "Navigateur inconnu";
}

async function registerMessagingServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Ce navigateur ne supporte pas les service workers.");
  }

  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    {
      scope: "/",
    }
  );

  await navigator.serviceWorker.ready;

  if (registration.installing) {
    await new Promise((resolve) => {
      registration.installing.addEventListener("statechange", (event) => {
        if (event.target.state === "activated") {
          resolve();
        }
      });
    });
  }

  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return registration;
}

export async function activerNotificationsPush(userId = "admin") {
  if (!("Notification" in window)) {
    throw new Error("Ce navigateur ne supporte pas les notifications.");
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    throw new Error("Firebase Messaging n’est pas supporté sur ce navigateur.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Les notifications ont été refusées.");
  }

  const registration = await registerMessagingServiceWorker();

  await new Promise((resolve) => setTimeout(resolve, 500));

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Aucun token FCM n’a été généré.");
  }

  await setDoc(
    doc(db, "apps", ACCOUNTING_APP_ID, "fcmTokens", token),
    {
      token,
      userId,
      appId: ACCOUNTING_APP_ID,
      device: getDeviceLabel(),
      userAgent: navigator.userAgent || "",
      active: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
}

export async function ecouterNotificationsOuvertes(callback) {
  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}