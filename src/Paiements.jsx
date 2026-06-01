import { useState } from "react";

function Paiements({
  paiements,
  paiementForm,
  setPaiementForm,
  ajouterPaiement,
  stats,
  money,
  recurrenceLabel,
}) {
  const [showPaiementModal, setShowPaiementModal] = useState(false);

  async function submitPaiement(e) {
    await ajouterPaiement(e);
    setShowPaiementModal(false);
  }

  return (
    <>
      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Paiements</h3>
            <p className="panel-subtitle" style={{ marginBottom: 0 }}>
              Liste des paiements reçus ou prévus. Les paiements d’application sont créés automatiquement.
            </p>
          </div>

          <button
            className="primary-btn"
            type="button"
            onClick={() => setShowPaiementModal(true)}
          >
            + Ajouter un paiement reçu
          </button>
        </div>

        <div className="grid-2">
          <div className="panel" style={{ boxShadow: "none" }}>
            <h3>Paiements du mois sélectionné</h3>

            <div className="list">
              {stats.paiementsMois.map((item) => (
                <div className="item" key={`${item.id}-${item.occurrenceDate || item.date}`}>
                  <div>
                    <strong>{item.client}</strong>
                    <p>
                      Date : {item.occurrenceDate || item.date}{" "}
                      {item.note ? `· ${item.note}` : ""}
                    </p>

                    <div className="badge-row">
                      <span className="badge">
                        {recurrenceLabel(item.recurrence)}
                      </span>

                      {item.automatique && (
                        <span className="badge orange">Automatique</span>
                      )}

                      {item.statutPaiement && (
                        <span className="badge gray">{item.statutPaiement}</span>
                      )}

                      {item.moyenPaiement && (
                        <span className="badge gray">{item.moyenPaiement}</span>
                      )}
                    </div>
                  </div>

                  <div className="amount">{money(item.montant)}</div>
                </div>
              ))}

              {stats.paiementsMois.length === 0 && (
                <div className="empty">Aucun paiement pour le mois sélectionné.</div>
              )}
            </div>
          </div>

          <div className="panel" style={{ boxShadow: "none" }}>
            <h3>Tous les paiements enregistrés</h3>

            <div className="list">
              {paiements.map((item) => (
                <div className="item" key={item.id}>
                  <div>
                    <strong>{item.client}</strong>
                    <p>
                      Départ : {item.date} {item.note ? `· ${item.note}` : ""}
                    </p>

                    <div className="badge-row">
                      <span className="badge">
                        {recurrenceLabel(item.recurrence)}
                      </span>

                      {item.automatique && (
                        <span className="badge orange">Automatique</span>
                      )}

                      {item.statutPaiement && (
                        <span className="badge gray">{item.statutPaiement}</span>
                      )}

                      {item.moyenPaiement && (
                        <span className="badge gray">{item.moyenPaiement}</span>
                      )}
                    </div>
                  </div>

                  <div className="amount">{money(item.montant)}</div>
                </div>
              ))}

              {paiements.length === 0 && (
                <div className="empty">Aucun paiement ajouté.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showPaiementModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>Ajouter un paiement reçu</h3>
                <p>Ajoute un paiement manuel reçu ou prévu.</p>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={() => setShowPaiementModal(false)}
              >
                Fermer
              </button>
            </div>

            <form className="form" onSubmit={submitPaiement}>
              <div className="field">
                <label>Client / entreprise *</label>
                <input
                  value={paiementForm.client}
                  onChange={(e) =>
                    setPaiementForm({ ...paiementForm, client: e.target.value })
                  }
                  placeholder="Ex: Construction ABC"
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Date de départ</label>
                  <input
                    type="date"
                    value={paiementForm.date}
                    onChange={(e) =>
                      setPaiementForm({
                        ...paiementForm,
                        date: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label>Montant reçu *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paiementForm.montant}
                    onChange={(e) =>
                      setPaiementForm({
                        ...paiementForm,
                        montant: e.target.value,
                      })
                    }
                    placeholder="Ex: 500"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Récurrence</label>
                  <select
                    value={paiementForm.recurrence}
                    onChange={(e) =>
                      setPaiementForm({
                        ...paiementForm,
                        recurrence: e.target.value,
                      })
                    }
                  >
                    <option value="unique">Une fois</option>
                    <option value="mensuelle">Mensuelle</option>
                    <option value="annuelle">Annuelle</option>
                  </select>
                </div>

                <div className="field">
                  <label>Moyen de paiement</label>
                  <input
                    value={paiementForm.moyenPaiement}
                    onChange={(e) =>
                      setPaiementForm({
                        ...paiementForm,
                        moyenPaiement: e.target.value,
                      })
                    }
                    placeholder="Ex: Interac, virement, chèque..."
                  />
                </div>
              </div>

              <div className="field">
                <label>Note</label>
                <textarea
                  value={paiementForm.note}
                  onChange={(e) =>
                    setPaiementForm({ ...paiementForm, note: e.target.value })
                  }
                  placeholder="Ex: Virement Interac, dépôt, chèque..."
                />
              </div>

              <div className="modal-footer">
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => setShowPaiementModal(false)}
                >
                  Annuler
                </button>

                <button className="primary-btn" type="submit">
                  Ajouter le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Paiements;