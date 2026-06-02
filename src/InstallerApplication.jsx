// src/InstallerApplication.jsx

import { useEffect, useState } from "react";

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

function isSafariBrowser() {
  const userAgent = window.navigator.userAgent.toLowerCase();

  return (
    userAgent.includes("safari") &&
    !userAgent.includes("crios") &&
    !userAgent.includes("fxios") &&
    !userAgent.includes("edgios") &&
    !userAgent.includes("chrome")
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function InstallerApplication({ compact = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isIos = isIosDevice();
  const isSafari = isSafariBrowser();

  useEffect(() => {
    function verifierInstallation() {
      setIsInstalled(isStandaloneMode());
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      setIsInstalled(isStandaloneMode());
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    }

    verifierInstallation();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstaller() {
    if (isStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();

      const choix = await deferredPrompt.userChoice;

      if (choix.outcome === "accepted") {
        setIsInstalled(true);
      }

      setDeferredPrompt(null);
      return;
    }

    setShowModal(true);
  }

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          className="header-mini-btn install"
          onClick={handleInstaller}
          title="Installer l’application"
        >
          <span className="header-mini-icon">⬇</span>
          <span>Installer</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstaller}
          style={{
            position: "fixed",
            right: "22px",
            bottom: "22px",
            zIndex: 9998,
            border: "none",
            borderRadius: "999px",
            padding: "13px 18px",
            background: "linear-gradient(135deg, #111827, #2563eb)",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 800,
            letterSpacing: "0.01em",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.32)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            ⬇
          </span>

          <span>Installer l’app</span>
        </button>
      )}

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.62)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#ffffff",
              borderRadius: "22px",
              overflow: "hidden",
              boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
          >
            <div
              style={{
                padding: "22px 24px",
                background: "linear-gradient(135deg, #111827, #1d4ed8)",
                color: "#ffffff",
              }}
            >
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "26px",
                  fontWeight: 900,
                  marginBottom: "14px",
                }}
              >
                J
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "23px",
                  fontWeight: 900,
                  lineHeight: 1.2,
                }}
              >
                Installer Jolab Comptabilité
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  opacity: 0.88,
                  fontSize: "14px",
                  lineHeight: 1.45,
                }}
              >
                Ajoute l’application à ton écran d’accueil pour l’ouvrir comme
                une vraie app.
              </p>
            </div>

            <div style={{ padding: "22px 24px" }}>
              {isIos || isSafari ? (
                <>
                  <p
                    style={{
                      marginTop: 0,
                      color: "#374151",
                      fontSize: "15px",
                      lineHeight: 1.55,
                    }}
                  >
                    Sur iPhone/iPad avec Safari, Apple demande de passer par le
                    bouton de partage.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      marginTop: "18px",
                    }}
                  >
                    <InstructionStep
                      number="1"
                      title="Appuie sur Partager"
                      text="Dans Safari, appuie sur l’icône de partage en bas de l’écran."
                      icon="↑"
                    />

                    <InstructionStep
                      number="2"
                      title="Ajouter à l’écran d’accueil"
                      text="Fais défiler le menu, puis sélectionne Ajouter à l’écran d’accueil."
                      icon="+"
                    />

                    <InstructionStep
                      number="3"
                      title="Appuie sur Ajouter"
                      text="Confirme avec le bouton Ajouter en haut à droite."
                      icon="✓"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p
                    style={{
                      marginTop: 0,
                      color: "#374151",
                      fontSize: "15px",
                      lineHeight: 1.55,
                    }}
                  >
                    Si ton navigateur ne montre pas le popup automatique, utilise
                    le menu du navigateur.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      marginTop: "18px",
                    }}
                  >
                    <InstructionStep
                      number="1"
                      title="Ouvre le menu du navigateur"
                      text="Clique sur les trois points ou le menu principal du navigateur."
                      icon="⋯"
                    />

                    <InstructionStep
                      number="2"
                      title="Installer l’application"
                      text="L’option peut aussi s’appeler Ajouter à l’écran d’accueil."
                      icon="⬇"
                    />

                    <InstructionStep
                      number="3"
                      title="Confirme l’installation"
                      text="L’application apparaîtra ensuite sur ton bureau ou ton écran d’accueil."
                      icon="✓"
                    />
                  </div>
                </>
              )}

              <div
                style={{
                  marginTop: "22px",
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#111827",
                    borderRadius: "12px",
                    padding: "10px 16px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InstructionStep({ number, title, text, icon }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "42px 1fr 38px",
        gap: "12px",
        alignItems: "center",
        padding: "13px",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          background: "#111827",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: "14px",
        }}
      >
        {number}
      </div>

      <div>
        <div
          style={{
            fontWeight: 900,
            color: "#111827",
            fontSize: "14px",
            marginBottom: "3px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#6b7280",
            fontSize: "13px",
            lineHeight: 1.35,
          }}
        >
          {text}
        </div>
      </div>

      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "12px",
          background: "#e0ecff",
          color: "#1d4ed8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: "18px",
        }}
      >
        {icon}
      </div>
    </div>
  );
}