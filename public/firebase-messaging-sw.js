/* public/firebase-messaging-sw.js */

/* eslint-disable no-undef */

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCQ91hqjTeWLFLVJTh4J4Ncm5Cg7_4x3Ps",
  authDomain: "test-36f40.firebaseapp.com",
  projectId: "test-36f40",
  storageBucket: "test-36f40.firebasestorage.app",
  messagingSenderId: "1049642913690",
  appId: "1:1049642913690:web:7100b90c1891dda4ebb423",
  measurementId: "G-3KK6825BM7",
});

firebase.messaging();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification?.data?.FCM_MSG?.data?.url ||
    event.notification?.data?.url ||
    "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }

      return null;
    })
  );
});