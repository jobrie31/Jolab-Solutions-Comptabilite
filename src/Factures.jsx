import { useMemo, useState } from "react";

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

  const today = typeof todayDate === "function"
    ? todayDate()
    : new Date().toISOString().slice(0, 10);

  const anneeActive = String(moisActif || today).slice(0, 4);

  function getMonthsOfYear(year) {
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return `${year}-${month}`;
    });
  }

  function factureExistePourPaiement(paiement) {
    return factures.some(
      (facture) =>
        facture.paiementId === paiement.id &&
        facture.paiementOccurrenceDate === paiement.occurrenceDate
    );
  }

  function getClientName(clientId, fallback = "") {
    const client = clients.find((item) => item.id === clientId);
    return client?.entreprise || fallback || "Sans client";
  }

  function getClientContact(clientId, fallback = "") {
    const client = clients.find((item) => item.id === clientId);
    return client?.personne || fallback || "-";
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

  const resume = useMemo(() => {
    const passes = lignesFactures.filter((ligne) => ligne.occurrenceDate <= today);
    const futures = lignesFactures.filter((ligne) => ligne.occurrenceDate > today);
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
      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Factures</h3>
            <p className="panel-subtitle" style={{ marginBottom: 0 }}>
              Tableau des factures par client pour l’année {anneeActive}. Les
              factures futures sont visibles en surbrillance et non cliquables.
            </p>
          </div>

          <button
            className="primary-btn"
            type="button"
            onClick={() => setShowPreview(true)}
          >
            Aperçu de la facture
          </button>
        </div>

        <section className="stats-grid">
          <div className="stat-card positive">
            <p>Factures passées</p>
            <h3>{money(resume.totalPasses)}</h3>
            <span>{resume.passes.length} ligne(s) disponible(s)</span>
          </div>

          <div className="stat-card">
            <p>Factures futures</p>
            <h3>{money(resume.totalFutures)}</h3>
            <span>{resume.futures.length} ligne(s) à venir</span>
          </div>

          <div className="stat-card positive">
            <p>Total affiché</p>
            <h3>{money(resume.totalGlobal)}</h3>
            <span>Selon le filtre sélectionné</span>
          </div>
        </section>

        <div
          className="panel"
          style={{
            boxShadow: "none",
            marginBottom: 18,
          }}
        >
          <div
            className="form-row"
            style={{
              alignItems: "end",
            }}
          >
            <div className="field">
              <label>Afficher</label>
              <select
                value={modeAffichage}
                onChange={(e) => setModeAffichage(e.target.value)}
              >
                <option value="passes">Passé seulement</option>
                <option value="passes_futures">Passé et futur</option>
              </select>
            </div>

            <div className="field">
              <label>Client</label>
              <select
                value={clientFiltre}
                onChange={(e) => setClientFiltre(e.target.value)}
              >
                <option value="">Tous les clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.entreprise}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Contact</th>
                <th>Application</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Facture</th>
              </tr>
            </thead>

            <tbody>
              {lignesFactures.map((ligne) => {
                const isFuture = ligne.occurrenceDate > today;
                const isInvoiced = factureExistePourPaiement(ligne);

                const rowStyle = isFuture
                  ? { background: "#fff7ed" }
                  : isInvoiced
                  ? { background: "#f0fdf4" }
                  : { background: "#e2e8f0" };

                return (
                  <tr
                    key={`${ligne.id}-${ligne.occurrenceDate}`}
                    style={rowStyle}
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
                          creerFactureDepuisPaiement(ligne, ligne.occurrenceDate)
                        }
                      >
                        {isFuture
                          ? "Non disponible"
                          : isInvoiced
                          ? "Déjà créée"
                          : "Télécharger facture"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {lignesFactures.length === 0 && (
                <tr>
                  <td colSpan="8">
                    <div className="empty">
                      Aucune facture à afficher avec les filtres sélectionnés.
                    </div>
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
                <h3>Aperçu de la facture</h3>
                <p>Modèle de base utilisé pour les factures.</p>
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