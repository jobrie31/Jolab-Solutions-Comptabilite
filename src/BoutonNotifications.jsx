// src/BoutonNotifications.jsx

import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  activerNotificationsPush,
  ecouterNotificationsOuvertes,
} from "./firebaseMessaging";

export default function BoutonNotifications({ compact = false }) {
  const [loadingActivation, setLoadingActivation] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [message, setMessage] = useState("");
  const [lastNotification, setLastNotification] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    let unsubscribe = null;

    ecouterNotificationsOuvertes((payload) => {
      setLastNotification({
        titre: payload?.notification?.title || "Notification",
        message: payload?.notification?.body || "",
      });
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  async function handleActiver() {
    try {
      setLoadingActivation(true);
      setMessage("");

      await activerNotificationsPush("admin");

      setMessage("Notifications activées sur cet appareil.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Erreur pendant l’activation des notifications.");
    } finally {
      setLoadingActivation(false);
    }
  }

  async function handleEnvoyerTest() {
    try {
      setLoadingTest(true);
      setMessage("");

      const functions = getFunctions(undefined, "us-central1");
      const envoyerNotificationTest = httpsCallable(
        functions,
        "envoyerNotificationTest"
      );

      const result = await envoyerNotificationTest({
        title: "Test Jolab Comptabilité",
        body: "La notification push fonctionne correctement.",
        url: "/",
      });

      const successCount = result?.data?.successCount ?? 0;
      const failureCount = result?.data?.failureCount ?? 0;
      const totalTokens = result?.data?.totalTokens ?? 0;

      setMessage(
        `Notification envoyée. Succès: ${successCount}/${totalTokens}. Échecs: ${failureCount}.`
      );
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Erreur pendant l’envoi de la notification test.");
    } finally {
      setLoadingTest(false);
    }
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="header-mini-btn notify"
          onClick={() => setShowPanel(true)}
          title="Notifications"
        >
          <span className="header-mini-icon">🔔</span>
          <span>Notifs</span>
        </button>

        {showPanel && (
          <div
            className="modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowPanel(false);
              }
            }}
          >
            <div className="modal" style={{ width: "min(560px, 100%)" }}>
              <div className="modal-header">
                <div>
                  <h3>Notifications push</h3>
                  <p>
                    Active les notifications sur cet appareil et envoie un test.
                  </p>
                </div>

                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowPanel(false)}
                >
                  Fermer
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleActiver}
                  disabled={loadingActivation || loadingTest}
                >
                  {loadingActivation ? "Activation..." : "Activer les notifications"}
                </button>

                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleEnvoyerTest}
                  disabled={loadingActivation || loadingTest}
                >
                  {loadingTest ? "Envoi..." : "Envoyer un test"}
                </button>
              </div>

              {message && (
                <p style={{ marginTop: "14px", fontWeight: 800, color: "#0f172a" }}>
                  {message}
                </p>
              )}

              {lastNotification && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px",
                    borderRadius: "14px",
                    background: "#f8fbff",
                    border: "1px solid #dbe6f5",
                  }}
                >
                  <strong>Notification reçue dans l’app :</strong>
                  <br />
                  {lastNotification.titre}
                  <br />
                  {lastNotification.message}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "16px",
        margin: "16px 0",
        background: "#fff",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Notifications push</h3>

      <p style={{ marginBottom: "12px" }}>
        Active les notifications sur cet appareil pour recevoir les alertes de
        Jolab Comptabilité.
      </p>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleActiver}
          disabled={loadingActivation || loadingTest}
        >
          {loadingActivation ? "Activation..." : "Activer les notifications"}
        </button>

        <button
          type="button"
          onClick={handleEnvoyerTest}
          disabled={loadingActivation || loadingTest}
        >
          {loadingTest ? "Envoi..." : "Envoyer un test"}
        </button>
      </div>

      {message && (
        <p style={{ marginTop: "12px", fontWeight: 600 }}>
          {message}
        </p>
      )}

      {lastNotification && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            borderRadius: "8px",
            background: "#f5f5f5",
          }}
        >
          <strong>Notification reçue dans l’app :</strong>
          <br />
          {lastNotification.titre}
          <br />
          {lastNotification.message}
        </div>
      )}
    </div>
  );
}