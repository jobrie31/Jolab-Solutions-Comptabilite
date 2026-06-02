import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const ACCOUNTING_APP_ID = "jolab-solutions-comptabilite";

function Clients({
  clients,
  factures,
  paiements,
  moisActif,
  clientForm,
  setClientForm,
  ajouterClient,
  ajouterApplicationClient,
  modifierApplicationClient,
  creerFactureDepuisPaiement,
  fermerClient,
  money,
  todayDate,
  recurrenceLabel,
  itemAppliesToMonth,
  getOccurrenceDateForMonth,
}) {
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientDetail, setClientDetail] = useState(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationDetail, setApplicationDetail] = useState(null);

  const [applicationForm, setApplicationForm] = useState({
    nomApplication: "",
    dateOuverture: todayDate(),
    montant: "",
    datePaiement: "",
    recurrencePaiement: "unique",
    rabaisBienvenue: false,
    rabaisAnnuel: false,
  });

  const today = todayDate();
  const anneeActive = String(moisActif || todayDate()).slice(0, 4);

  function getMonthsOfYear(year) {
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `${year}-${month}`;
    });
  }

  const paiementsParClientAnnee = useMemo(() => {
    const map = {};
    const monthsOfYear = getMonthsOfYear(anneeActive);

    paiements.forEach((paiement) => {
      if (!paiement.clientId) return;

      monthsOfYear.forEach((monthKey) => {
        if (!itemAppliesToMonth(paiement, monthKey)) return;

        const occurrenceDate = getOccurrenceDateForMonth(paiement, monthKey);

        if (!map[paiement.clientId]) {
          map[paiement.clientId] = [];
        }

        map[paiement.clientId].push({
          ...paiement,
          moisAffiche: monthKey,
          occurrenceDate,
        });
      });
    });

    Object.keys(map).forEach((clientId) => {
      map[clientId].sort((a, b) =>
        String(a.occurrenceDate || "").localeCompare(
          String(b.occurrenceDate || "")
        )
      );
    });

    return map;
  }, [
    paiements,
    anneeActive,
    itemAppliesToMonth,
    getOccurrenceDateForMonth,
  ]);

  function calculerPrixApplication(form) {
    const prixBase = Number(form.montant || 0);
    const pourcentageRabais =
      (form.rabaisBienvenue ? 10 : 0) + (form.rabaisAnnuel ? 15 : 0);

    const montantRabais = Number(
      ((prixBase * pourcentageRabais) / 100).toFixed(2)
    );

    const montantFinal = Number((prixBase - montantRabais).toFixed(2));

    return {
      prixBase,
      pourcentageRabais,
      montantRabais,
      montantFinal,
    };
  }

  function resetApplicationForm() {
    setApplicationForm({
      nomApplication: "",
      dateOuverture: todayDate(),
      montant: "",
      datePaiement: "",
      recurrencePaiement: "unique",
      rabaisBienvenue: false,
      rabaisAnnuel: false,
    });
  }

  function openClientDetail(client) {
    setClientDetail(client);
    setShowApplicationForm(false);
    setApplicationDetail(null);
    resetApplicationForm();
  }

  function closeClientDetail() {
    setClientDetail(null);
    setShowApplicationForm(false);
    setApplicationDetail(null);
    resetApplicationForm();
  }

  async function fermerClientActif() {
    if (!clientDetailFresh?.id) return;

    const confirmation = window.confirm(
      `Fermer le client "${clientDetailFresh.entreprise}" et l'envoyer dans l'historique?`
    );

    if (!confirmation) return;

    await fermerClient(clientDetailFresh.id);
    closeClientDetail();
  }

  function openAddApplication() {
    setApplicationDetail(null);
    resetApplicationForm();
    setShowApplicationForm(true);
  }

  function openApplicationDetail(application) {
    setApplicationDetail(application);

    setApplicationForm({
      nomApplication: application.nomApplication || "",
      dateOuverture: application.dateOuverture || todayDate(),
      montant:
        application.prixBase ||
        application.prixBase === 0 ||
        application.montant ||
        application.montant === 0
          ? String(application.prixBase ?? application.montant)
          : "",
      datePaiement: application.datePaiement || "",
      recurrencePaiement: application.recurrencePaiement || "unique",
      rabaisBienvenue: Boolean(application.rabaisBienvenue),
      rabaisAnnuel: Boolean(application.rabaisAnnuel),
    });

    setShowApplicationForm(true);
  }

  async function submitClient(e) {
    await ajouterClient(e);
    setShowClientModal(false);
  }

  async function submitApplication(e) {
    e.preventDefault();

    if (!clientDetailFresh) return;

    if (applicationDetail) {
      await modifierApplicationClient(
        clientDetailFresh.id,
        applicationDetail.id,
        applicationForm
      );
    } else {
      await ajouterApplicationClient(clientDetailFresh.id, applicationForm);
    }

    resetApplicationForm();
    setApplicationDetail(null);
    setShowApplicationForm(false);
  }

  function factureExistePourPaiement(paiement) {
    return factures.some(
      (facture) =>
        facture.paiementId === paiement.id &&
        facture.paiementOccurrenceDate === paiement.occurrenceDate
    );
  }

  function isEnvoye(paiement) {
    return paiement.statutPaiement === "Envoyé";
  }

  function isFuturePayment(paiement) {
    return paiement.occurrenceDate > today;
  }

  async function envoyerPaiement(paiement) {
    if (!paiement?.id) return;

    await updateDoc(
      doc(db, "apps", ACCOUNTING_APP_ID, "paiements", paiement.id),
      {
        statutPaiement: "Envoyé",
        dateEnvoi: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      }
    );
  }

  function formatPaiementCourt(application) {
    const montant = money(application.montant);

    const rabais = [];

    if (application.rabaisBienvenue) {
      rabais.push("Rabais de bienvenue -10 %");
    }

    if (application.rabaisAnnuel) {
      rabais.push("Rabais annuel -15 %");
    }

    const rabaisText = rabais.length ? ` (${rabais.join(" + ")})` : "";

    if (application.recurrencePaiement === "mensuelle") {
      return `${montant} / mois${rabaisText}`;
    }

    if (application.recurrencePaiement === "annuelle") {
      return `${montant} / an${rabaisText}`;
    }

    return `${montant}${rabaisText}`;
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
    const dateText = String(paiement.occurrenceDate || todayDate()).replaceAll(
      "-",
      ""
    );
    const idCourt = String(paiement.id || "").slice(0, 5).toUpperCase();

    return `FAC-${dateText}-${idCourt || "00000"}`;
  }

  function ouvrirPdfFacture(paiement, pdfWindow) {
    if (!clientDetailFresh || !paiement || !pdfWindow) return;

    const clientNom =
      paiement.clientEntreprise ||
      paiement.client ||
      clientDetailFresh.entreprise ||
      "";

    const contact =
      paiement.clientPersonne || clientDetailFresh.personne || "";

    const description = paiement.applicationNom
      ? `Application : ${paiement.applicationNom}`
      : paiement.note || "Services professionnels";

    const montant = Number(paiement.montant || 0);
    const prixBase = Number(paiement.prixBase || paiement.montant || 0);
    const rabaisBienvenue = Boolean(paiement.rabaisBienvenue);
    const rabaisAnnuel = Boolean(paiement.rabaisAnnuel);

    const factureNo = numeroFacture(paiement);
    const dateFacture = paiement.occurrenceDate || todayDate();

    const html = `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(factureNo)}</title>
          <style>
            * { box-sizing: border-box; }

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
              body { padding: 24px; }
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
                ${contact ? `<p>Contact : ${escapeHtml(contact)}</p>` : ""}
                ${
                  clientDetailFresh.email
                    ? `<p>Email : ${escapeHtml(clientDetailFresh.email)}</p>`
                    : ""
                }
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

  async function creerPdfFacture(paiement) {
    if (!paiement || !clientDetailFresh) return;

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

    const isFuture = paiement.occurrenceDate > today;
    const isInvoiced = factureExistePourPaiement(paiement);

    if (!isFuture && !isInvoiced) {
      await creerFactureDepuisPaiement(paiement, paiement.occurrenceDate);
    }

    ouvrirPdfFacture(paiement, pdfWindow);
  }

  const clientDetailFresh = clientDetail
    ? clients.find((client) => client.id === clientDetail.id) || clientDetail
    : null;

  const applications = Array.isArray(clientDetailFresh?.applications)
    ? clientDetailFresh.applications
    : [];

  const paiementsDuClientAnnee = clientDetailFresh
    ? paiementsParClientAnnee[clientDetailFresh.id] || []
    : [];

  const prixPreview = calculerPrixApplication(applicationForm);

  return (
    <>
      <style>{`
        .client-fullscreen-modal {
          width: calc(100vw - 32px) !important;
          height: calc(100vh - 32px) !important;
          max-height: calc(100vh - 32px) !important;
          max-width: none !important;
          padding: 22px !important;
          display: flex;
          flex-direction: column;
          overflow: hidden !important;
        }

        .client-fullscreen-body {
          flex: 1;
          min-height: 0;
          overflow: auto;
          display: grid;
          gap: 18px;
        }

        .clients-panel {
          padding: 18px;
        }

        .clients-table {
          min-width: 780px;
        }

        .clients-table th {
          padding: 8px 11px;
          font-size: 0.76rem;
        }

        .clients-table td {
          padding: 7px 11px;
          vertical-align: middle;
          line-height: 1.15;
          font-size: 0.9rem;
        }

        .clients-table td strong {
          margin: 0;
          line-height: 1.15;
        }

        .clients-table .badge {
          padding: 4px 8px;
          font-size: 0.72rem;
        }

        .client-row {
          cursor: pointer;
        }

        .client-row:hover td {
          background: #eff6ff !important;
        }

        .simple-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          table-layout: fixed;
        }

        .simple-table th {
          background: #f1f5f9;
          color: #334155;
          padding: 10px;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-align: left;
          border-bottom: 1px solid #dbe3ef;
        }

        .simple-table td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: middle;
          color: #0f172a;
          word-break: break-word;
        }

        .simple-table tr.clickable-row {
          cursor: pointer;
        }

        .simple-table tr.clickable-row:hover td {
          background: #eff6ff;
        }

        .applications-payments-grid {
          display: grid;
          grid-template-columns: minmax(320px, 0.85fr) minmax(420px, 1.15fr);
          gap: 18px;
          align-items: start;
        }

        .payment-row-future td {
          background: #fff7ed;
        }

        .payment-row-ready td {
          background: #f0fdf4;
        }

        .payment-row-ready:hover td {
          background: #dcfce7 !important;
        }

        .payment-row-future:hover td {
          background: #ffedd5 !important;
        }

        .client-profile-clean {
          background: linear-gradient(135deg, #eff6ff, #f8fbff);
          border: 1px solid #bfdbfe;
          border-radius: 22px;
          padding: 18px;
          display: grid;
          gap: 7px;
        }

        .client-profile-clean h4 {
          margin: 0;
          color: #0f172a;
          font-size: 1.2rem;
        }

        .client-profile-clean p {
          margin: 0;
          color: #475569;
          font-weight: 700;
        }

        .checkbox-line {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #cfd9e8;
          border-radius: 13px;
          padding: 12px;
          background: #f8fbff;
          font-weight: 900;
          color: #334155;
        }

        .checkbox-line input {
          width: 18px;
          height: 18px;
        }

        .invoice-discount-preview {
          border: 1px solid #dbe6f5;
          border-radius: 16px;
          background: #f8fbff;
          padding: 14px;
          display: grid;
          gap: 8px;
        }

        .invoice-discount-preview div {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          color: #334155;
          font-weight: 800;
        }

        .invoice-discount-preview .final {
          border-top: 1px solid #dbe6f5;
          padding-top: 8px;
          color: #0f172a;
          font-size: 1.05rem;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 0.78rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .status-badge.future {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.sent {
          background: #047857;
          color: white;
        }

        .send-btn {
          border: 1px solid #bbf7d0;
          background: #dcfce7;
          color: #047857;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 0.78rem;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .send-btn.flash {
          animation: sendFlash 0.9s infinite;
          background: #f97316;
          color: white;
          border-color: #ea580c;
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7);
        }

        @keyframes sendFlash {
          0% {
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7);
            transform: scale(1);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(249, 115, 22, 0);
            transform: scale(1.03);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
            transform: scale(1);
          }
        }

        .close-client-btn {
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fee2e2;
          color: #b91c1c;
          padding: 9px 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .close-client-btn:hover {
          background: #fecaca;
        }

        .client-modal-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        @media (max-width: 1050px) {
          .applications-payments-grid {
            grid-template-columns: 1fr;
          }

          .client-fullscreen-modal {
            width: calc(100vw - 18px) !important;
            height: calc(100vh - 18px) !important;
            max-height: calc(100vh - 18px) !important;
            padding: 16px !important;
          }
        }
      `}</style>

      <section className="panel clients-panel">
        <div className="section-header">
          <h3>Clients</h3>

          <button
            className="primary-btn"
            type="button"
            onClick={() => setShowClientModal(true)}
          >
            + Ajouter un client
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table clients-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Applications</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((client) => {
                const apps = Array.isArray(client.applications)
                  ? client.applications
                  : [];

                return (
                  <tr
                    key={client.id}
                    className="client-row"
                    onClick={() => openClientDetail(client)}
                    title="Ouvrir le dossier client"
                  >
                    <td>
                      <strong>{client.entreprise}</strong>
                    </td>
                    <td>{client.personne || "-"}</td>
                    <td>{client.telephone || "-"}</td>
                    <td>{client.email || "-"}</td>
                    <td>
                      <span className="badge">{apps.length} app(s)</span>
                    </td>
                  </tr>
                );
              })}

              {clients.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <div className="empty">Aucun client.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showClientModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>Ajouter un client</h3>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={() => setShowClientModal(false)}
              >
                Fermer
              </button>
            </div>

            <form className="form" onSubmit={submitClient}>
              <div className="field">
                <label>Entreprise *</label>
                <input
                  value={clientForm.entreprise}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      entreprise: e.target.value,
                    })
                  }
                  placeholder="Ex: Construction ABC"
                />
              </div>

              <div className="field">
                <label>Nom de la personne</label>
                <input
                  value={clientForm.personne}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      personne: e.target.value,
                    })
                  }
                  placeholder="Ex: Jean Tremblay"
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Téléphone</label>
                  <input
                    value={clientForm.telephone}
                    onChange={(e) =>
                      setClientForm({
                        ...clientForm,
                        telephone: e.target.value,
                      })
                    }
                    placeholder="Ex: 418-000-0000"
                  />
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    value={clientForm.email}
                    onChange={(e) =>
                      setClientForm({
                        ...clientForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="client@email.com"
                  />
                </div>
              </div>

              <div className="field">
                <label>Notes</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Notes internes..."
                />
              </div>

              <div className="modal-footer">
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => setShowClientModal(false)}
                >
                  Annuler
                </button>

                <button className="primary-btn" type="submit">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clientDetailFresh && (
        <div className="modal-overlay">
          <div className="modal large client-fullscreen-modal">
            <div className="modal-header">
              <div>
                <h3>Dossier client — {clientDetailFresh.entreprise}</h3>
              </div>

              <div className="client-modal-actions">
                <button
                  className="close-client-btn"
                  type="button"
                  onClick={fermerClientActif}
                >
                  Fermer le client
                </button>

                <button
                  className="close-btn"
                  type="button"
                  onClick={closeClientDetail}
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="client-fullscreen-body">
              <div className="client-profile-clean">
                <h4>{clientDetailFresh.entreprise}</h4>
                <p>
                  Contact : {clientDetailFresh.personne || "Aucun contact"}{" "}
                  {clientDetailFresh.telephone
                    ? `· ${clientDetailFresh.telephone}`
                    : ""}
                </p>
                <p>Email : {clientDetailFresh.email || "Aucun email"}</p>
                {clientDetailFresh.notes && (
                  <p>Notes : {clientDetailFresh.notes}</p>
                )}
              </div>

              <div className="applications-payments-grid">
                <div className="panel" style={{ boxShadow: "none" }}>
                  <div className="detail-toolbar">
                    <h3>Applications</h3>

                    <button
                      className="primary-btn"
                      type="button"
                      onClick={openAddApplication}
                    >
                      + Ajouter une application
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table className="simple-table">
                      <thead>
                        <tr>
                          <th style={{ width: "34%" }}>Application</th>
                          <th style={{ width: "24%" }}>Paiement prévu</th>
                          <th style={{ width: "24%" }}>Montant</th>
                          <th style={{ width: "18%" }}>Type</th>
                        </tr>
                      </thead>

                      <tbody>
                        {applications.map((application) => (
                          <tr
                            key={application.id}
                            className="clickable-row"
                            onClick={() => openApplicationDetail(application)}
                            title="Cliquer pour modifier"
                          >
                            <td>
                              <strong>{application.nomApplication}</strong>
                            </td>
                            <td>{application.datePaiement || "-"}</td>
                            <td>
                              <strong>{formatPaiementCourt(application)}</strong>
                            </td>
                            <td>
                              <span className="badge green">
                                {recurrenceLabel(
                                  application.recurrencePaiement
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {applications.length === 0 && (
                          <tr>
                            <td colSpan="4">
                              <div className="empty">
                                Aucune application ajoutée.
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel" style={{ boxShadow: "none" }}>
                  <h3>Paiements</h3>

                  <div className="table-wrap">
                    <table className="simple-table">
                      <thead>
                        <tr>
                          <th style={{ width: "14%" }}>Date</th>
                          <th style={{ width: "28%" }}>Application</th>
                          <th style={{ width: "14%" }}>Type</th>
                          <th style={{ width: "14%" }}>Montant</th>
                          <th style={{ width: "15%" }}>Statut</th>
                          <th style={{ width: "15%" }}>PDF</th>
                        </tr>
                      </thead>

                      <tbody>
                        {paiementsDuClientAnnee.map((paiement) => {
                          const isFuture = isFuturePayment(paiement);
                          const rowClass = isFuture
                            ? "payment-row-future"
                            : "payment-row-ready";

                          const envoye = isEnvoye(paiement);

                          return (
                            <tr
                              key={`${paiement.id}-${paiement.occurrenceDate}`}
                              className={rowClass}
                            >
                              <td>
                                <strong>{paiement.occurrenceDate}</strong>
                              </td>

                              <td>
                                {paiement.applicationNom ||
                                  paiement.note ||
                                  "Paiement"}
                              </td>

                              <td>
                                <span className="badge">
                                  {recurrenceLabel(paiement.recurrence)}
                                </span>
                              </td>

                              <td>
                                <strong>{money(paiement.montant)}</strong>
                              </td>

                              <td>
                                {isFuture && (
                                  <span className="status-badge future">
                                    Futur
                                  </span>
                                )}

                                {!isFuture && envoye && (
                                  <span className="status-badge sent">
                                    Envoyé
                                  </span>
                                )}

                                {!isFuture && !envoye && (
                                  <button
                                    className="send-btn flash"
                                    type="button"
                                    onClick={() => envoyerPaiement(paiement)}
                                  >
                                    Envoyer
                                  </button>
                                )}
                              </td>

                              <td>
                                <button
                                  className="secondary-btn"
                                  type="button"
                                  onClick={() => creerPdfFacture(paiement)}
                                >
                                  PDF
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {paiementsDuClientAnnee.length === 0 && (
                          <tr>
                            <td colSpan="6">
                              <div className="empty">
                                Aucun paiement pour ce client.
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {clientDetailFresh && showApplicationForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>
                  {applicationDetail
                    ? "Modifier l’application"
                    : "Ajouter une application"}
                </h3>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={() => {
                  setShowApplicationForm(false);
                  setApplicationDetail(null);
                  resetApplicationForm();
                }}
              >
                Fermer
              </button>
            </div>

            <form className="form" onSubmit={submitApplication}>
              <div className="field">
                <label>Nom de l’application *</label>
                <input
                  value={applicationForm.nomApplication}
                  onChange={(e) =>
                    setApplicationForm({
                      ...applicationForm,
                      nomApplication: e.target.value,
                    })
                  }
                  placeholder="Ex: Application de facturation"
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Date d’ouverture de dossier</label>
                  <input
                    type="date"
                    value={applicationForm.dateOuverture}
                    onChange={(e) =>
                      setApplicationForm({
                        ...applicationForm,
                        dateOuverture: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label>Prix avant rabais</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={applicationForm.montant}
                    onChange={(e) =>
                      setApplicationForm({
                        ...applicationForm,
                        montant: e.target.value,
                      })
                    }
                    placeholder="Ex: 50"
                  />
                </div>
              </div>

              <div className="form-row">
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={applicationForm.rabaisBienvenue}
                    onChange={(e) =>
                      setApplicationForm({
                        ...applicationForm,
                        rabaisBienvenue: e.target.checked,
                      })
                    }
                  />
                  Rabais de bienvenue -10 %
                </label>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={applicationForm.rabaisAnnuel}
                    onChange={(e) =>
                      setApplicationForm({
                        ...applicationForm,
                        rabaisAnnuel: e.target.checked,
                      })
                    }
                  />
                  Rabais annuel -15 %
                </label>
              </div>

              <div className="invoice-discount-preview">
                <div>
                  <strong>Prix avant rabais</strong>
                  <span>{money(prixPreview.prixBase)}</span>
                </div>

                {applicationForm.rabaisBienvenue && (
                  <div>
                    <strong>Rabais de bienvenue -10 %</strong>
                    <span>-{money((prixPreview.prixBase * 10) / 100)}</span>
                  </div>
                )}

                {applicationForm.rabaisAnnuel && (
                  <div>
                    <strong>Rabais annuel -15 %</strong>
                    <span>-{money((prixPreview.prixBase * 15) / 100)}</span>
                  </div>
                )}

                {!applicationForm.rabaisBienvenue &&
                  !applicationForm.rabaisAnnuel && (
                    <div>
                      <strong>Aucun rabais</strong>
                      <span>{money(0)}</span>
                    </div>
                  )}

                <div className="final">
                  <strong>Total</strong>
                  <span>{money(prixPreview.montantFinal)}</span>
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Date de paiement prévue</label>
                  <input
                    type="date"
                    value={applicationForm.datePaiement}
                    onChange={(e) =>
                      setApplicationForm({
                        ...applicationForm,
                        datePaiement: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label>Type de paiement</label>
                  <select
                    value={applicationForm.recurrencePaiement}
                    onChange={(e) =>
                      setApplicationForm({
                        ...applicationForm,
                        recurrencePaiement: e.target.value,
                      })
                    }
                  >
                    <option value="unique">Une fois</option>
                    <option value="mensuelle">Mensuel</option>
                    <option value="annuelle">Annuel</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => {
                    setShowApplicationForm(false);
                    setApplicationDetail(null);
                    resetApplicationForm();
                  }}
                >
                  Annuler
                </button>

                <button className="primary-btn" type="submit">
                  {applicationDetail
                    ? "Enregistrer les modifications"
                    : "Ajouter l’application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Clients;