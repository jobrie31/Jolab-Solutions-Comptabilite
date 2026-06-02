import { useEffect, useMemo, useState } from "react";

function Factures({
  clients = [],
  factures = [],
  paiements = [],
  moisActif,
  facturePreview,
  money,
  recurrenceLabel,
  todayDate,
  itemAppliesToMonth,
  getOccurrenceDateForMonth,
  creerFactureDepuisPaiement,
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [clientFiltre, setClientFiltre] = useState("");
  const [modeAffichage, setModeAffichage] = useState("passes");

  const today =
    typeof todayDate === "function"
      ? todayDate()
      : new Date().toISOString().slice(0, 10);

  const anneeActive = String(moisActif || today).slice(0, 4);

  function getMonthsOfYear(year) {
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `${year}-${month}`;
    });
  }

  function trouverFacturePourPaiement(paiement) {
    return (
      factures.find(
        (facture) =>
          facture.paiementId === paiement.id &&
          facture.paiementOccurrenceDate === paiement.occurrenceDate
      ) || null
    );
  }

  function factureExistePourPaiement(paiement) {
    return Boolean(trouverFacturePourPaiement(paiement));
  }

  function factureEstEnvoyee(facture) {
    if (!facture) return false;

    const statut = String(
      facture.statut ||
        facture.statutFacture ||
        facture.statutPaiement ||
        ""
    )
      .trim()
      .toLowerCase();

    return (
      facture.envoye === true ||
      facture.envoyee === true ||
      facture.isEnvoye === true ||
      facture.sent === true ||
      statut === "envoyé" ||
      statut === "envoye" ||
      statut === "sent"
    );
  }

  function ligneEstEnvoyee(ligne) {
    const facture = trouverFacturePourPaiement(ligne);

    if (factureEstEnvoyee(facture)) {
      return true;
    }

    const statut = String(
      ligne.statut ||
        ligne.statutFacture ||
        ligne.statutPaiement ||
        ""
    )
      .trim()
      .toLowerCase();

    return (
      ligne.envoye === true ||
      ligne.envoyee === true ||
      ligne.isEnvoye === true ||
      ligne.sent === true ||
      statut === "envoyé" ||
      statut === "envoye" ||
      statut === "sent"
    );
  }

  function getClient(clientId) {
    return clients.find((item) => item.id === clientId) || null;
  }

  function getClientName(clientId, fallback = "") {
    const client = getClient(clientId);
    return client?.entreprise || fallback || "Sans client";
  }

  function getClientContact(clientId, fallback = "") {
    const client = getClient(clientId);
    return client?.personne || fallback || "-";
  }

  function getClientEmail(clientId) {
    const client = getClient(clientId);
    return client?.email || "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateFr(dateValue) {
    if (!dateValue) return "-";

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) return dateValue;

    return date.toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function numeroFacture(paiement) {
    const dateText = String(paiement.occurrenceDate || today).replaceAll(
      "-",
      ""
    );
    const idCourt = String(paiement.id || "").slice(0, 5).toUpperCase();

    return `FAC-${dateText}-${idCourt || "00000"}`;
  }

  function ouvrirPdfFacture(ligne, pdfWindow) {
    if (!ligne || !pdfWindow) return;

    const clientNom = getClientName(
      ligne.clientId,
      ligne.clientEntreprise || ligne.client
    );

    const contact = getClientContact(ligne.clientId, ligne.clientPersonne);
    const email = getClientEmail(ligne.clientId);

    const description = ligne.applicationNom
      ? `Application : ${ligne.applicationNom}`
      : ligne.note || "Services professionnels";

    const montant = Number(ligne.montant || 0);
    const prixBase = Number(ligne.prixBase || ligne.montant || 0);
    const rabaisBienvenue = Boolean(ligne.rabaisBienvenue);
    const rabaisAnnuel = Boolean(ligne.rabaisAnnuel);

    const factureNo = numeroFacture(ligne);
    const dateFacture = ligne.occurrenceDate || today;

    const html = `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(factureNo)}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 42px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: white;
            }

            .invoice {
              max-width: 820px;
              margin: 0 auto;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 28px;
              padding-bottom: 24px;
              border-bottom: 3px solid #111827;
            }

            .brand h1 {
              margin: 0;
              font-size: 30px;
              letter-spacing: -0.04em;
            }

            .brand p {
              margin: 6px 0 0;
              color: #475569;
              font-weight: 700;
            }

            .meta {
              text-align: right;
              font-weight: 700;
              color: #334155;
            }

            .meta strong {
              display: block;
              color: #111827;
              font-size: 17px;
              margin-bottom: 6px;
            }

            .section {
              margin-top: 28px;
            }

            .section-title {
              margin: 0 0 10px;
              font-size: 13px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #64748b;
            }

            .box {
              border: 1px solid #dbe3ef;
              border-radius: 14px;
              padding: 18px;
              background: #f8fafc;
            }

            .box p {
              margin: 4px 0;
              color: #334155;
              font-weight: 650;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 14px;
            }

            th {
              text-align: left;
              background: #f1f5f9;
              color: #334155;
              padding: 13px;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              border-bottom: 1px solid #cbd5e1;
            }

            td {
              padding: 14px 13px;
              border-bottom: 1px solid #e5e7eb;
              vertical-align: top;
            }

            .right {
              text-align: right;
            }

            .total {
              margin-left: auto;
              margin-top: 24px;
              width: min(340px, 100%);
              border: 1px solid #111827;
              border-radius: 16px;
              overflow: hidden;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              padding: 16px 18px;
              font-weight: 900;
              font-size: 20px;
              background: #111827;
              color: white;
            }

            .footer {
              margin-top: 42px;
              padding-top: 18px;
              border-top: 1px solid #e5e7eb;
              color: #64748b;
              font-size: 13px;
              font-weight: 650;
            }

            @media print {
              body {
                padding: 24px;
              }
            }
          </style>
        </head>

        <body>
          <div class="invoice">
            <div class="header">
              <div class="brand">
                <h1>Jolab Solutions</h1>
                <p>Facture</p>
              </div>

              <div class="meta">
                <strong>${escapeHtml(factureNo)}</strong>
                <div>Date : ${escapeHtml(formatDateFr(dateFacture))}</div>
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">Facturé à</h2>

              <div class="box">
                <p><strong>${escapeHtml(clientNom)}</strong></p>
                ${
                  contact && contact !== "-"
                    ? `<p>Contact : ${escapeHtml(contact)}</p>`
                    : ""
                }
                ${email ? `<p>Email : ${escapeHtml(email)}</p>` : ""}
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">Détails</h2>

              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="right">Montant</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>${escapeHtml(description)}</td>
                    <td class="right"><strong>${escapeHtml(money(prixBase))}</strong></td>
                  </tr>

                  ${
                    rabaisBienvenue
                      ? `
                        <tr>
                          <td>Rabais de bienvenue -10 %</td>
                          <td class="right">-${escapeHtml(
                            money((prixBase * 10) / 100)
                          )}</td>
                        </tr>
                      `
                      : ""
                  }

                  ${
                    rabaisAnnuel
                      ? `
                        <tr>
                          <td>Rabais annuel -15 %</td>
                          <td class="right">-${escapeHtml(
                            money((prixBase * 15) / 100)
                          )}</td>
                        </tr>
                      `
                      : ""
                  }
                </tbody>
              </table>

              <div class="total">
                <div class="total-row">
                  <span>Total</span>
                  <span>${escapeHtml(money(montant))}</span>
                </div>
              </div>
            </div>

            <div class="footer">
              Merci pour votre confiance.
            </div>
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    pdfWindow.document.open();
    pdfWindow.document.write(html);
    pdfWindow.document.close();
  }

  async function creerPdfFacture(ligne) {
    if (!ligne) return;

    const isFuture = ligne.occurrenceDate > today;

    if (isFuture) {
      alert("Cette facture est dans le futur.");
      return;
    }

    const pdfWindow = window.open("", "_blank");

    if (!pdfWindow) {
      alert("Le navigateur a bloqué la fenêtre du PDF.");
      return;
    }

    pdfWindow.document.write(`
      <html>
        <head>
          <title>Création de la facture...</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 30px;">
          <strong>Création de la facture...</strong>
        </body>
      </html>
    `);

    const isInvoiced = factureExistePourPaiement(ligne);

    if (!isInvoiced && typeof creerFactureDepuisPaiement === "function") {
      await creerFactureDepuisPaiement(ligne, ligne.occurrenceDate);
    }

    ouvrirPdfFacture(ligne, pdfWindow);
  }

  const lignesFactures = useMemo(() => {
    const monthsOfYear = getMonthsOfYear(anneeActive);
    const lignes = [];

    paiements.forEach((paiement) => {
      if (!paiement.clientId) return;

      monthsOfYear.forEach((monthKey) => {
        const applies =
          typeof itemAppliesToMonth === "function"
            ? itemAppliesToMonth(paiement, monthKey)
            : String(paiement.date || "").slice(0, 7) === monthKey;

        if (!applies) return;

        const occurrenceDate =
          typeof getOccurrenceDateForMonth === "function"
            ? getOccurrenceDateForMonth(paiement, monthKey)
            : paiement.date;

        if (!occurrenceDate) return;

        const isFuture = occurrenceDate > today;

        if (modeAffichage === "passes" && isFuture) return;

        lignes.push({
          ...paiement,
          moisAffiche: monthKey,
          occurrenceDate,
        });
      });
    });

    return lignes
      .filter((ligne) => {
        if (!clientFiltre) return true;
        return ligne.clientId === clientFiltre;
      })
      .sort((a, b) => {
        const clientA = getClientName(a.clientId, a.clientEntreprise || a.client);
        const clientB = getClientName(b.clientId, b.clientEntreprise || b.client);

        const clientCompare = clientA.localeCompare(clientB);
        if (clientCompare !== 0) return clientCompare;

        return String(a.occurrenceDate || "").localeCompare(
          String(b.occurrenceDate || "")
        );
      });
  }, [
    paiements,
    clients,
    anneeActive,
    modeAffichage,
    clientFiltre,
    today,
    itemAppliesToMonth,
    getOccurrenceDateForMonth,
  ]);

  const facturesANotifier = useMemo(() => {
    return lignesFactures.filter((ligne) => {
      const isPastOrToday = ligne.occurrenceDate <= today;

      if (!isPastOrToday) {
        return false;
      }

      if (ligneEstEnvoyee(ligne)) {
        return false;
      }

      return true;
    });
  }, [lignesFactures, factures, today]);

  async function afficherNotificationFacture(ligne) {
    if (!ligne?.id) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const storageKey = `jolab-notif-facture-non-envoyee-${ligne.id}-${ligne.occurrenceDate}-${today}`;

    if (localStorage.getItem(storageKey) === "done") {
      return;
    }

    const client = getClientName(
      ligne.clientId,
      ligne.clientEntreprise || ligne.client
    );

    const montant =
      typeof money === "function"
        ? money(ligne.montant)
        : `${ligne.montant || 0} $`;

    const retardJours = Math.max(
      0,
      Math.floor(
        (new Date(`${today}T00:00:00`) -
          new Date(`${ligne.occurrenceDate}T00:00:00`)) /
          86400000
      )
    );

    const title =
      retardJours > 0
        ? `Facture non envoyée depuis ${retardJours} jour(s)`
        : "Facture à envoyer aujourd’hui";

    const body = `${client} — ${
      ligne.applicationNom || ligne.note || "Paiement"
    } — ${montant}`;

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: storageKey,
          renotify: false,
          data: {
            url: "/",
            type: "facture",
            paiementId: ligne.id,
            occurrenceDate: ligne.occurrenceDate,
          },
        });
      } else {
        new Notification(title, {
          body,
          icon: "/icon-192.png",
          tag: storageKey,
        });
      }

      localStorage.setItem(storageKey, "done");
    } catch (error) {
      console.error("Erreur notification facture :", error);
    }
  }

  useEffect(() => {
    facturesANotifier.forEach((ligne) => {
      afficherNotificationFacture(ligne);
    });
  }, [facturesANotifier]);

  const resume = useMemo(() => {
    const passes = lignesFactures.filter(
      (ligne) => ligne.occurrenceDate <= today
    );
    const futures = lignesFactures.filter(
      (ligne) => ligne.occurrenceDate > today
    );

    const totalPasses = passes.reduce(
      (sum, ligne) => sum + Number(ligne.montant || 0),
      0
    );

    const totalFutures = futures.reduce(
      (sum, ligne) => sum + Number(ligne.montant || 0),
      0
    );

    return {
      passes,
      futures,
      totalPasses,
      totalFutures,
      totalGlobal: totalPasses + totalFutures,
    };
  }, [lignesFactures, today]);

  return (
    <>
      <style>{`
        .factures-panel {
          padding: 18px;
        }

        .factures-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
        }

        .factures-header h3 {
          margin: 0;
        }

        .factures-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .factures-filters {
          display: grid;
          grid-template-columns: 220px 260px minmax(0, 1fr);
          gap: 12px;
          align-items: end;
          margin-bottom: 14px;
        }

        .factures-mini-stats {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .facture-pill {
          background: #f8fbff;
          border: 1px solid #dbe6f5;
          color: #334155;
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 0.82rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .facture-pill.green {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #047857;
        }

        .facture-pill.orange {
          background: #fff7ed;
          border-color: #fed7aa;
          color: #c2410c;
        }

        .factures-table {
          min-width: 920px;
        }

        .factures-table th {
          padding: 8px 10px;
          font-size: 0.74rem;
        }

        .factures-table td {
          padding: 7px 10px;
          line-height: 1.15;
          vertical-align: middle;
          font-size: 0.88rem;
        }

        .factures-table td strong {
          line-height: 1.15;
        }

        .factures-table .badge {
          padding: 4px 8px;
          font-size: 0.72rem;
        }

        .factures-table .secondary-btn {
          padding: 7px 10px;
          font-size: 0.82rem;
          border-radius: 10px;
        }

        .facture-row-past td {
          background: #e2e8f0;
        }

        .facture-row-future td {
          background: #fff7ed;
        }

        .facture-row-invoiced td {
          background: #f0fdf4;
        }

        @media (max-width: 1050px) {
          .factures-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .factures-filters {
            grid-template-columns: 1fr;
          }

          .factures-mini-stats {
            justify-content: flex-start;
          }
        }
      `}</style>

      <section className="panel factures-panel">
        <div className="factures-header">
          <h3>Factures</h3>

          <div className="factures-actions">
            <button
              className="primary-btn"
              type="button"
              onClick={() => setShowPreview(true)}
            >
              Aperçu
            </button>
          </div>
        </div>

        <div className="factures-filters">
          <div className="field">
            <label>Afficher</label>
            <select
              value={modeAffichage}
              onChange={(e) => setModeAffichage(e.target.value)}
            >
              <option value="passes">Passé</option>
              <option value="passes_futures">Passé + futur</option>
            </select>
          </div>

          <div className="field">
            <label>Client</label>
            <select
              value={clientFiltre}
              onChange={(e) => setClientFiltre(e.target.value)}
            >
              <option value="">Tous</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.entreprise}
                </option>
              ))}
            </select>
          </div>

          <div className="factures-mini-stats">
            <span className="facture-pill green">
              Passé : {money(resume.totalPasses)}
            </span>

            <span className="facture-pill orange">
              Futur : {money(resume.totalFutures)}
            </span>

            <span className="facture-pill">
              Total : {money(resume.totalGlobal)}
            </span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table factures-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Contact</th>
                <th>Application</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>PDF</th>
              </tr>
            </thead>

            <tbody>
              {lignesFactures.map((ligne) => {
                const isFuture = ligne.occurrenceDate > today;
                const isInvoiced = factureExistePourPaiement(ligne);
                const isEnvoyee = ligneEstEnvoyee(ligne);

                const rowClass = isFuture
                  ? "facture-row-future"
                  : isEnvoyee
                  ? "facture-row-invoiced"
                  : isInvoiced
                  ? "facture-row-invoiced"
                  : "facture-row-past";

                return (
                  <tr
                    key={`${ligne.id}-${ligne.occurrenceDate}`}
                    className={rowClass}
                  >
                    <td>
                      <strong>{ligne.occurrenceDate}</strong>
                    </td>

                    <td>
                      <strong>
                        {getClientName(
                          ligne.clientId,
                          ligne.clientEntreprise || ligne.client
                        )}
                      </strong>
                    </td>

                    <td>
                      {getClientContact(ligne.clientId, ligne.clientPersonne)}
                    </td>

                    <td>{ligne.applicationNom || ligne.note || "Paiement"}</td>

                    <td>
                      <span className="badge">
                        {recurrenceLabel(ligne.recurrence)}
                      </span>
                    </td>

                    <td>
                      <strong>{money(ligne.montant)}</strong>
                    </td>

                    <td>
                      {isFuture && <span className="badge future">Futur</span>}

                      {!isFuture && !isInvoiced && !isEnvoyee && (
                        <span className="badge dark">À envoyer</span>
                      )}

                      {!isFuture && isInvoiced && !isEnvoyee && (
                        <span className="badge orange">Non envoyé</span>
                      )}

                      {isEnvoyee && (
                        <span className="badge green">Envoyé</span>
                      )}
                    </td>

                    <td>
                      <button
                        className="secondary-btn"
                        type="button"
                        disabled={isFuture}
                        onClick={() => creerPdfFacture(ligne)}
                      >
                        {isFuture ? "—" : "PDF"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {lignesFactures.length === 0 && (
                <tr>
                  <td colSpan="8">
                    <div className="empty">Aucune facture.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showPreview && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>Aperçu</h3>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={() => setShowPreview(false)}
              >
                Fermer
              </button>
            </div>

            <div className="invoice-preview">
              <div className="invoice-preview-header">
                <div>
                  <h4>FACTURE</h4>
                  <p>Jolab Solutions</p>
                </div>

                <div>
                  <p>
                    <strong>Date :</strong> {facturePreview?.date || "-"}
                  </p>
                  <p>
                    <strong>Statut :</strong>{" "}
                    {facturePreview?.statut || "Aperçu seulement"}
                  </p>
                </div>
              </div>

              <p>
                <strong>Facturé à :</strong>{" "}
                {facturePreview?.entreprise || "Nom de l’entreprise"}
              </p>

              <p>
                <strong>Contact :</strong>{" "}
                {facturePreview?.personne || "Nom de la personne"}
              </p>

              <p>
                <strong>Application :</strong>{" "}
                {facturePreview?.applicationNom || "Application / service"}
              </p>

              <p>
                <strong>Description :</strong>{" "}
                {facturePreview?.description || "Services professionnels"}
              </p>

              {(facturePreview?.rabaisBienvenue ||
                facturePreview?.rabaisAnnuel) && (
                <>
                  <p>
                    <strong>Prix avant rabais :</strong>{" "}
                    {money(
                      facturePreview?.prixBase ||
                        facturePreview?.montant ||
                        0
                    )}
                  </p>

                  {facturePreview?.rabaisBienvenue && (
                    <p>
                      <strong>Rabais de bienvenue :</strong> -10 %
                    </p>
                  )}

                  {facturePreview?.rabaisAnnuel && (
                    <p>
                      <strong>Rabais annuel :</strong> -15 %
                    </p>
                  )}
                </>
              )}

              <div className="invoice-total">
                <span>Total</span>
                <span>{money(facturePreview?.montant || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Factures;