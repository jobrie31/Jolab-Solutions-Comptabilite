import { useMemo, useState } from "react";

function HistoriqueClients({
  clients = [],
  factures = [],
  paiements = [],
  money,
  recurrenceLabel,
}) {
  const [clientOuvert, setClientOuvert] = useState(null);

  const clientsFermes = useMemo(() => {
    return clients
      .filter((client) => client.clientFerme)
      .sort((a, b) =>
        String(b.dateFermeture || "").localeCompare(String(a.dateFermeture || ""))
      );
  }, [clients]);

  const clientActif = clientOuvert
    ? clientsFermes.find((client) => client.id === clientOuvert.id) || clientOuvert
    : null;

  const facturesClient = useMemo(() => {
    if (!clientActif?.id) return [];

    return factures
      .filter((facture) => facture.clientId === clientActif.id)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [factures, clientActif]);

  const paiementsEnvoyesClient = useMemo(() => {
    if (!clientActif?.id) return [];

    return paiements
      .filter(
        (paiement) =>
          paiement.clientId === clientActif.id &&
          paiement.statutPaiement === "Envoyé"
      )
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [paiements, clientActif]);

  function formatDate(value) {
    if (!value) return "-";

    if (value?.toDate) {
      return value.toDate().toLocaleDateString("fr-CA");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

    return date.toLocaleDateString("fr-CA");
  }

  return (
    <>
      <style>{`
        .historique-panel {
          padding: 18px;
        }

        .historique-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
        }

        .historique-header h3 {
          margin: 0;
        }

        .historique-table {
          min-width: 820px;
        }

        .historique-table th {
          padding: 8px 10px;
          font-size: 0.74rem;
        }

        .historique-table td {
          padding: 8px 10px;
          line-height: 1.15;
          vertical-align: middle;
          font-size: 0.88rem;
        }

        .historique-row {
          cursor: pointer;
        }

        .historique-row:hover td {
          background: #eff6ff !important;
        }

        .historique-profile {
          background: linear-gradient(135deg, #f8fafc, #eff6ff);
          border: 1px solid #bfdbfe;
          border-radius: 20px;
          padding: 16px;
          display: grid;
          gap: 6px;
          margin-bottom: 16px;
        }

        .historique-profile h4 {
          margin: 0;
          color: #0f172a;
          font-size: 1.25rem;
        }

        .historique-profile p {
          margin: 0;
          color: #475569;
          font-weight: 750;
        }

        .historique-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .historique-card {
          border: 1px solid #dbe6f5;
          border-radius: 18px;
          overflow: hidden;
          background: white;
        }

        .historique-card h4 {
          margin: 0;
          padding: 12px 14px;
          background: #f8fbff;
          border-bottom: 1px solid #dbe6f5;
          color: #0f172a;
        }

        .mini-table {
          width: 100%;
          border-collapse: collapse;
        }

        .mini-table th {
          text-align: left;
          background: #f1f5f9;
          color: #334155;
          padding: 8px 10px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #dbe3ef;
        }

        .mini-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.86rem;
        }

        @media (max-width: 1050px) {
          .historique-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="panel historique-panel">
        <div className="historique-header">
          <h3>Historique clients</h3>
        </div>

        <div className="table-wrap">
          <table className="data-table historique-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Date fermeture</th>
              </tr>
            </thead>

            <tbody>
              {clientsFermes.map((client) => (
                <tr
                  key={client.id}
                  className="historique-row"
                  onClick={() => setClientOuvert(client)}
                  title="Ouvrir l'historique du client"
                >
                  <td>
                    <strong>{client.entreprise || "-"}</strong>
                  </td>
                  <td>{client.personne || "-"}</td>
                  <td>{client.telephone || "-"}</td>
                  <td>{client.email || "-"}</td>
                  <td>{formatDate(client.dateFermeture)}</td>
                </tr>
              ))}

              {clientsFermes.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <div className="empty">Aucun client fermé.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {clientActif && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <div>
                <h3>Historique — {clientActif.entreprise}</h3>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={() => setClientOuvert(null)}
              >
                Fermer
              </button>
            </div>

            <div className="historique-profile">
              <h4>{clientActif.entreprise}</h4>
              <p>Contact : {clientActif.personne || "-"}</p>
              <p>Téléphone : {clientActif.telephone || "-"}</p>
              <p>Email : {clientActif.email || "-"}</p>
              <p>Date fermeture : {formatDate(clientActif.dateFermeture)}</p>
              {clientActif.notes && <p>Notes : {clientActif.notes}</p>}
            </div>

            <div className="historique-grid">
              <div className="historique-card">
                <h4>Applications</h4>

                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Application</th>
                      <th>Paiement</th>
                      <th>Montant</th>
                    </tr>
                  </thead>

                  <tbody>
                    {Array.isArray(clientActif.applications) &&
                      clientActif.applications.map((application) => (
                        <tr key={application.id}>
                          <td>
                            <strong>{application.nomApplication}</strong>
                          </td>
                          <td>{application.datePaiement || "-"}</td>
                          <td>{money(application.montant)}</td>
                        </tr>
                      ))}

                    {(!Array.isArray(clientActif.applications) ||
                      clientActif.applications.length === 0) && (
                      <tr>
                        <td colSpan="3">
                          <div className="empty">Aucune application.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="historique-card">
                <h4>Paiements envoyés</h4>

                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Application</th>
                      <th>Montant</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paiementsEnvoyesClient.map((paiement) => (
                      <tr key={paiement.id}>
                        <td>{paiement.date || "-"}</td>
                        <td>{paiement.applicationNom || paiement.note || "-"}</td>
                        <td>{money(paiement.montant)}</td>
                      </tr>
                    ))}

                    {paiementsEnvoyesClient.length === 0 && (
                      <tr>
                        <td colSpan="3">
                          <div className="empty">Aucun paiement envoyé.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="historique-card" style={{ gridColumn: "1 / -1" }}>
                <h4>Factures créées</h4>

                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Application</th>
                      <th>Statut</th>
                      <th>Montant</th>
                    </tr>
                  </thead>

                  <tbody>
                    {facturesClient.map((facture) => (
                      <tr key={facture.id}>
                        <td>{facture.date || "-"}</td>
                        <td>{facture.applicationNom || facture.description || "-"}</td>
                        <td>{facture.statut || "-"}</td>
                        <td>{money(facture.montant)}</td>
                      </tr>
                    ))}

                    {facturesClient.length === 0 && (
                      <tr>
                        <td colSpan="4">
                          <div className="empty">Aucune facture créée.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default HistoriqueClients;