import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const ACCOUNTING_APP_ID = "jolab-solutions-comptabilite";

function Depenses({
  depenses,
  depenseForm,
  setDepenseForm,
  ajouterDepense,
  stats,
  money,
  recurrenceLabel,
}) {
  const [showDepenseModal, setShowDepenseModal] = useState(false);
  const [depenseDetail, setDepenseDetail] = useState(null);

  const [editForm, setEditForm] = useState({
    titre: "",
    fournisseur: "",
    date: "",
    montant: "",
    categorie: "Général",
    recurrence: "unique",
    moyenPaiement: "",
    montantProchaineDepense: "",
  });

  function todayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function getMonthKey(dateValue) {
    if (!dateValue) return new Date().toISOString().slice(0, 7);
    return String(dateValue).slice(0, 7);
  }

  function getLastDayOfMonth(year, monthIndexZeroBased) {
    return new Date(year, monthIndexZeroBased + 1, 0).getDate();
  }

  function getOccurrenceDateForCurrentMonth(item) {
    if (!item?.date) return "";

    const recurrence = item.recurrence || "unique";
    const today = todayDate();
    const currentMonthKey = getMonthKey(today);

    if (recurrence === "unique") {
      return getMonthKey(item.date) === currentMonthKey ? item.date : "";
    }

    const [, , originalDayText] = String(item.date).split("-");
    const originalDay = Number(originalDayText || 1);

    const [selectedYear, selectedMonth] = currentMonthKey.split("-").map(Number);
    const monthIndex = selectedMonth - 1;
    const safeDay = Math.min(
      originalDay,
      getLastDayOfMonth(selectedYear, monthIndex)
    );

    return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
      safeDay
    ).padStart(2, "0")}`;
  }

  function depenseDoitNotifierAujourdhui(depense) {
    if (!depense?.date) return false;

    const recurrence = depense.recurrence || "unique";

    if (recurrence !== "mensuelle" && recurrence !== "annuelle") {
      return false;
    }

    const today = todayDate();
    const occurrenceDate = getOccurrenceDateForCurrentMonth(depense);

    if (occurrenceDate !== today) {
      return false;
    }

    if (recurrence === "annuelle") {
      const originalMonth = String(depense.date).slice(5, 7);
      const todayMonth = today.slice(5, 7);

      return originalMonth === todayMonth;
    }

    return true;
  }

  async function afficherNotificationDepense(depense) {
    if (!depense?.id) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const today = todayDate();
    const storageKey = `jolab-notif-depense-${depense.id}-${today}`;

    if (localStorage.getItem(storageKey) === "done") {
      return;
    }

    const titre = "Dépense à payer aujourd’hui";
    const montant = typeof money === "function" ? money(depense.montant) : `${depense.montant || 0} $`;
    const body = `${depense.titre || "Dépense"} — ${montant}`;

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(titre, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: storageKey,
          renotify: false,
          data: {
            url: "/",
            type: "depense",
            depenseId: depense.id,
          },
        });
      } else {
        new Notification(titre, {
          body,
          icon: "/icon-192.png",
          tag: storageKey,
        });
      }

      localStorage.setItem(storageKey, "done");
    } catch (error) {
      console.error("Erreur notification dépense :", error);
    }
  }

  const depensesANotifierAujourdhui = useMemo(() => {
    return depenses.filter((depense) => depenseDoitNotifierAujourdhui(depense));
  }, [depenses]);

  useEffect(() => {
    depensesANotifierAujourdhui.forEach((depense) => {
      afficherNotificationDepense(depense);
    });
  }, [depensesANotifierAujourdhui]);

  async function submitDepense(e) {
    await ajouterDepense(e);
    setShowDepenseModal(false);
  }

  function openDepenseDetail(depense) {
    setDepenseDetail(depense);

    setEditForm({
      titre: depense.titre || "",
      fournisseur: depense.fournisseur || "",
      date: depense.date || "",
      montant:
        depense.montant || depense.montant === 0 ? String(depense.montant) : "",
      categorie: depense.categorie || "Général",
      recurrence: depense.recurrence || "unique",
      moyenPaiement: depense.moyenPaiement || "",
      montantProchaineDepense: "",
    });
  }

  function closeDepenseDetail() {
    setDepenseDetail(null);

    setEditForm({
      titre: "",
      fournisseur: "",
      date: "",
      montant: "",
      categorie: "Général",
      recurrence: "unique",
      moyenPaiement: "",
      montantProchaineDepense: "",
    });
  }

  async function submitEditDepense(e) {
    e.preventDefault();

    if (!depenseDetail?.id) {
      alert("Dépense introuvable.");
      return;
    }

    if (!editForm.titre.trim()) {
      alert("Entre un titre.");
      return;
    }

    if (!editForm.montant || Number(editForm.montant) <= 0) {
      alert("Entre un montant valide.");
      return;
    }

    const ancienMontant = Number(depenseDetail.montant || 0);

    const nouveauMontant =
      editForm.montantProchaineDepense !== ""
        ? Number(editForm.montantProchaineDepense)
        : Number(editForm.montant || 0);

    if (!nouveauMontant || nouveauMontant <= 0) {
      alert("Entre un montant valide.");
      return;
    }

    const historiqueActuel = Array.isArray(depenseDetail.historiqueModifications)
      ? depenseDetail.historiqueModifications
      : [];

    const changement = {
      dateModification: new Date().toISOString(),
      ancienMontant,
      nouveauMontant,
    };

    await updateDoc(
      doc(db, "apps", ACCOUNTING_APP_ID, "depenses", depenseDetail.id),
      {
        titre: editForm.titre.trim(),
        fournisseur: editForm.fournisseur.trim(),
        date: editForm.date,
        mois: String(editForm.date || "").slice(0, 7),
        montant: nouveauMontant,
        categorie: editForm.categorie,
        recurrence: editForm.recurrence,
        moyenPaiement: editForm.moyenPaiement.trim(),
        montantProchaineDepense: "",
        historiqueModifications: [...historiqueActuel, changement],
        updatedAt: serverTimestamp(),
      }
    );

    closeDepenseDetail();
  }

  function formatDateTime(value) {
    if (!value) return "-";

    let date = null;

    if (value?.toDate) {
      date = value.toDate();
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("fr-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getDateInscription(depense) {
    if (depense?.createdAt) return depense.createdAt;
    if (depense?.date) return `${depense.date}T00:00:00`;
    return "";
  }

  function getHistoriqueAvecDepart(depense) {
    if (!depense) return [];

    const historique = Array.isArray(depense.historiqueModifications)
      ? depense.historiqueModifications
      : [];

    const prixDepart =
      historique.length > 0 && historique[0]?.ancienMontant !== undefined
        ? historique[0].ancienMontant
        : Number(depense.montant || 0);

    const depart = {
      type: "depart",
      dateModification: getDateInscription(depense),
      montant: prixDepart,
    };

    return [depart, ...historique];
  }

  return (
    <>
      <style>{`
        .depenses-panel {
          padding: 18px;
        }

        .depenses-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
        }

        .depenses-header h3 {
          margin: 0;
        }

        .depenses-summary {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
          margin-bottom: 14px;
        }

        .depenses-mini-card {
          background: #fff;
          border: 1px solid #dbe6f5;
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
        }

        .depenses-mini-card p {
          margin: 0;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 900;
        }

        .depenses-mini-card h4 {
          margin: 7px 0 0;
          color: #dc2626;
          font-size: 1.5rem;
          letter-spacing: -0.04em;
        }

        .depenses-table {
          min-width: 920px;
        }

        .depenses-table th {
          padding: 8px 10px;
          font-size: 0.74rem;
        }

        .depenses-table td {
          padding: 7px 10px;
          line-height: 1.15;
          vertical-align: middle;
          font-size: 0.88rem;
        }

        .depenses-table td strong {
          line-height: 1.15;
        }

        .depenses-table .badge {
          padding: 4px 8px;
          font-size: 0.72rem;
        }

        .depense-row {
          cursor: pointer;
        }

        .depense-row:hover td {
          background: #eff6ff !important;
        }

        .history-list {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        .history-item {
          border: 1px solid #e2e8f0;
          background: #f8fbff;
          border-radius: 14px;
          padding: 10px 12px;
        }

        .history-item strong {
          display: block;
          color: #0f172a;
          margin-bottom: 4px;
          font-size: 0.9rem;
        }

        .history-item p {
          margin: 0;
          color: #64748b;
          font-weight: 650;
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .next-expense-box {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          border-radius: 16px;
          padding: 14px;
          display: grid;
          gap: 12px;
        }

        .next-expense-box h4 {
          margin: 0;
          color: #0f172a;
          font-size: 1rem;
        }

        @media (max-width: 1050px) {
          .depenses-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .depenses-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="panel depenses-panel">
        <div className="depenses-header">
          <h3>Liste de dépenses</h3>

          <button
            className="primary-btn"
            type="button"
            onClick={() => setShowDepenseModal(true)}
          >
            + Ajouter une dépense
          </button>
        </div>

        <div className="depenses-summary">
          <div className="depenses-mini-card">
            <p>Dépenses du mois</p>
            <h4>{money(stats.totalDepenses)}</h4>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table depenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Dépense</th>
                <th>Fournisseur</th>
                <th>Catégorie</th>
                <th>Récurrence</th>
                <th>Paiement</th>
                <th>Montant</th>
              </tr>
            </thead>

            <tbody>
              {depenses.map((item) => (
                <tr
                  className="depense-row"
                  key={item.id}
                  onClick={() => openDepenseDetail(item)}
                  title="Cliquer pour modifier"
                >
                  <td>
                    <strong>{item.date || "-"}</strong>
                  </td>

                  <td>
                    <strong>{item.titre || "-"}</strong>
                  </td>

                  <td>{item.fournisseur || "-"}</td>

                  <td>{item.categorie || "-"}</td>

                  <td>
                    <span className="badge">
                      {recurrenceLabel(item.recurrence)}
                    </span>
                  </td>

                  <td>
                    {item.moyenPaiement ? (
                      <span className="badge gray">{item.moyenPaiement}</span>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    <strong>{money(item.montant)}</strong>
                  </td>
                </tr>
              ))}

              {depenses.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="empty">Aucune dépense.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showDepenseModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>Ajouter une dépense</h3>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={() => setShowDepenseModal(false)}
              >
                Fermer
              </button>
            </div>

            <form className="form" onSubmit={submitDepense}>
              <div className="field">
                <label>Titre *</label>
                <input
                  value={depenseForm.titre}
                  onChange={(e) =>
                    setDepenseForm({
                      ...depenseForm,
                      titre: e.target.value,
                    })
                  }
                  placeholder="Ex: Essence, logiciel, matériel..."
                />
              </div>

              <div className="field">
                <label>Fournisseur</label>
                <input
                  value={depenseForm.fournisseur}
                  onChange={(e) =>
                    setDepenseForm({
                      ...depenseForm,
                      fournisseur: e.target.value,
                    })
                  }
                  placeholder="Ex: Adobe, Canadian Tire, Vidéotron..."
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={depenseForm.date}
                    onChange={(e) =>
                      setDepenseForm({
                        ...depenseForm,
                        date: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label>Montant *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depenseForm.montant}
                    onChange={(e) =>
                      setDepenseForm({
                        ...depenseForm,
                        montant: e.target.value,
                      })
                    }
                    placeholder="Ex: 75"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Catégorie</label>
                  <select
                    value={depenseForm.categorie}
                    onChange={(e) =>
                      setDepenseForm({
                        ...depenseForm,
                        categorie: e.target.value,
                      })
                    }
                  >
                    <option>Général</option>
                    <option>Essence</option>
                    <option>Logiciel</option>
                    <option>Matériel</option>
                    <option>Repas</option>
                    <option>Publicité</option>
                    <option>Téléphone / Internet</option>
                    <option>Assurance</option>
                    <option>Comptabilité</option>
                  </select>
                </div>

                <div className="field">
                  <label>Récurrence</label>
                  <select
                    value={depenseForm.recurrence}
                    onChange={(e) =>
                      setDepenseForm({
                        ...depenseForm,
                        recurrence: e.target.value,
                      })
                    }
                  >
                    <option value="unique">Une fois</option>
                    <option value="mensuelle">Mensuelle</option>
                    <option value="annuelle">Annuelle</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Moyen de paiement</label>
                <input
                  value={depenseForm.moyenPaiement}
                  onChange={(e) =>
                    setDepenseForm({
                      ...depenseForm,
                      moyenPaiement: e.target.value,
                    })
                  }
                  placeholder="Ex: Carte crédit, débit, Interac, comptant..."
                />
              </div>

              <div className="modal-footer">
                <button
                  className="danger-btn"
                  type="button"
                  onClick={() => setShowDepenseModal(false)}
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

      {depenseDetail && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <div>
                <h3>Modifier la dépense</h3>
              </div>

              <button
                className="close-btn"
                type="button"
                onClick={closeDepenseDetail}
              >
                Fermer
              </button>
            </div>

            <form className="form" onSubmit={submitEditDepense}>
              <div className="field">
                <label>Titre *</label>
                <input
                  value={editForm.titre}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      titre: e.target.value,
                    })
                  }
                />
              </div>

              <div className="field">
                <label>Fournisseur</label>
                <input
                  value={editForm.fournisseur}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      fournisseur: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        date: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label>Montant actuel *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.montant}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        montant: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Catégorie</label>
                  <select
                    value={editForm.categorie}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        categorie: e.target.value,
                      })
                    }
                  >
                    <option>Général</option>
                    <option>Essence</option>
                    <option>Logiciel</option>
                    <option>Matériel</option>
                    <option>Repas</option>
                    <option>Publicité</option>
                    <option>Téléphone / Internet</option>
                    <option>Assurance</option>
                    <option>Comptabilité</option>
                  </select>
                </div>

                <div className="field">
                  <label>Récurrence</label>
                  <select
                    value={editForm.recurrence}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        recurrence: e.target.value,
                      })
                    }
                  >
                    <option value="unique">Une fois</option>
                    <option value="mensuelle">Mensuelle</option>
                    <option value="annuelle">Annuelle</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Moyen de paiement</label>
                <input
                  value={editForm.moyenPaiement}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      moyenPaiement: e.target.value,
                    })
                  }
                />
              </div>

              <div className="next-expense-box">
                <h4>Prochaine dépense</h4>

                <div className="field">
                  <label>Montant prochaine dépense</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.montantProchaineDepense}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        montantProchaineDepense: e.target.value,
                      })
                    }
                    placeholder="Ex: 125"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="danger-btn"
                  type="button"
                  onClick={closeDepenseDetail}
                >
                  Annuler
                </button>

                <button className="primary-btn" type="submit">
                  Enregistrer
                </button>
              </div>
            </form>

            <div style={{ marginTop: 18 }}>
              <h3>Historique</h3>

              <div className="history-list">
                {getHistoriqueAvecDepart(depenseDetail)
                  .slice()
                  .reverse()
                  .map((item, index) => {
                    if (item.type === "depart") {
                      return (
                        <div className="history-item" key={`depart-${index}`}>
                          <strong>{formatDateTime(item.dateModification)}</strong>
                          <p>Prix inscrit au départ : {money(item.montant)}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="history-item" key={`modif-${index}`}>
                        <strong>{formatDateTime(item.dateModification)}</strong>
                        <p>
                          Prix : {money(item.ancienMontant)} →{" "}
                          {money(item.nouveauMontant)}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Depenses;