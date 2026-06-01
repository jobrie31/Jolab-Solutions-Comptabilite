import { useMemo, useState } from "react";

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

  function resetApplicationForm() {
    setApplicationForm({
      nomApplication: "",
      dateOuverture: todayDate(),
      montant: "",
      datePaiement: "",
      recurrencePaiement: "unique",
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
        application.montant || application.montant === 0
          ? String(application.montant)
          : "",
      datePaiement: application.datePaiement || "",
      recurrencePaiement: application.recurrencePaiement || "unique",
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

  function formatPaiementCourt(application) {
    const montant = money(application.montant);

    if (application.recurrencePaiement === "mensuelle") {
      return `${montant} / mois`;
    }

    if (application.recurrencePaiement === "annuelle") {
      return `${montant} / an`;
    }

    return `${montant} une fois`;
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

        .client-detail-grid.no-horizontal-scroll {
          grid-template-columns: 1fr;
        }

        .client-detail-grid.no-horizontal-scroll .table-wrap {
          overflow-x: visible;
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
          padding: 12px;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-align: left;
          border-bottom: 1px solid #dbe3ef;
        }

        .simple-table td {
          padding: 12px;
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

        .payment-row-past td {
          background: #e2e8f0;
        }

        .payment-row-future td {
          background: #fff7ed;
        }

        .payment-row-invoiced td {
          background: #f0fdf4;
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

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Clients</h3>
            <p className="panel-subtitle" style={{ marginBottom: 0 }}>
              Clique directement sur une ligne pour ouvrir le dossier du client.
            </p>
          </div>

          <button
            className="primary-btn"
            type="button"
            onClick={() => setShowClientModal(true)}
          >
            + Ajouter un client
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Applications</th>
                <th>Paiements année</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((client) => {
                const apps = Array.isArray(client.applications)
                  ? client.applications
                  : [];
                const clientPaiements = paiementsParClientAnnee[client.id] || [];

                return (
                  <tr
                    key={client.id}
                    onClick={() => openClientDetail(client)}
                    style={{ cursor: "pointer" }}
                    title="Cliquer pour ouvrir le dossier"
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
                    <td>
                      <span className="badge gray">
                        {clientPaiements.length} paiement(s) en {anneeActive}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {clients.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="empty">
                      Aucun client ajouté. Clique sur “Ajouter un client” pour commencer.
                    </div>
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
                <p>Crée une fiche client dans ta banque de données.</p>
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
                  Ajouter le client
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
                <h3>Dossier client</h3>
                <p>
                  Applications et paiements de l’année {anneeActive}. Les paiements passés peuvent générer une facture.
                </p>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={closeClientDetail}
              >
                Fermer
              </button>
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
                    <div>
                      <h3>Applications</h3>
                      <p className="panel-subtitle" style={{ marginBottom: 0 }}>
                        Clique sur une application pour voir ou modifier ses infos.
                      </p>
                    </div>

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
                  <h3>Paiements de l’année</h3>
                  <p className="panel-subtitle">
                    Année affichée : {anneeActive}. Les paiements futurs sont en surbrillance et non cliquables.
                  </p>

                  <div className="table-wrap">
                    <table className="simple-table">
                      <thead>
                        <tr>
                          <th style={{ width: "18%" }}>Date</th>
                          <th style={{ width: "28%" }}>Application</th>
                          <th style={{ width: "16%" }}>Type</th>
                          <th style={{ width: "16%" }}>Montant</th>
                          <th style={{ width: "12%" }}>Statut</th>
                          <th style={{ width: "10%" }}>Facture</th>
                        </tr>
                      </thead>

                      <tbody>
                        {paiementsDuClientAnnee.map((paiement) => {
                          const isFuture = paiement.occurrenceDate > today;
                          const isInvoiced = factureExistePourPaiement(paiement);

                          const rowClass = isFuture
                            ? "payment-row-future"
                            : isInvoiced
                            ? "payment-row-invoiced"
                            : "payment-row-past";

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
                                  <span className="badge future">Futur</span>
                                )}

                                {!isFuture && !isInvoiced && (
                                  <span className="badge dark">Passé</span>
                                )}

                                {isInvoiced && (
                                  <span className="badge green">Facturé</span>
                                )}
                              </td>

                              <td>
                                <button
                                  className="secondary-btn"
                                  type="button"
                                  disabled={isFuture || isInvoiced}
                                  onClick={() =>
                                    creerFactureDepuisPaiement(
                                      paiement,
                                      paiement.occurrenceDate
                                    )
                                  }
                                >
                                  {isFuture
                                    ? "—"
                                    : isInvoiced
                                    ? "OK"
                                    : "PDF"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {paiementsDuClientAnnee.length === 0 && (
                          <tr>
                            <td colSpan="6">
                              <div className="empty">
                                Aucun paiement pour ce client dans l’année{" "}
                                {anneeActive}.
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
                <p>
                  {applicationDetail
                    ? `Modification de ${applicationDetail.nomApplication}.`
                    : `Un paiement prévu sera automatiquement créé pour ${clientDetailFresh.entreprise}.`}
                </p>
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
                  <label>Montant</label>
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