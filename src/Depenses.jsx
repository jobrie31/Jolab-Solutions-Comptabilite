function Depenses({
  depenses,
  depenseForm,
  setDepenseForm,
  ajouterDepense,
  stats,
  money,
  recurrenceLabel,
}) {
  return (
    <section className="grid-2">
      <div className="panel">
        <h3>Ajouter une dépense</h3>

        <form className="form" onSubmit={ajouterDepense}>
          <div className="field">
            <label>Titre *</label>
            <input
              value={depenseForm.titre}
              onChange={(e) =>
                setDepenseForm({ ...depenseForm, titre: e.target.value })
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
              <label>Date de départ</label>
              <input
                type="date"
                value={depenseForm.date}
                onChange={(e) =>
                  setDepenseForm({ ...depenseForm, date: e.target.value })
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

          <button className="primary-btn" type="submit">
            Ajouter la dépense
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Dépenses du mois sélectionné</h3>

        <div className="list">
          {stats.depensesMois.map((item) => (
            <div className="item" key={item.id}>
              <div>
                <strong>{item.titre}</strong>
                <p>
                  {item.fournisseur || "Aucun fournisseur"} · Départ :{" "}
                  {item.date} · {item.categorie}
                </p>

                <div className="badge-row">
                  <span className="badge">
                    {recurrenceLabel(item.recurrence)}
                  </span>

                  {item.moyenPaiement && (
                    <span className="badge gray">{item.moyenPaiement}</span>
                  )}
                </div>
              </div>

              <div className="amount">{money(item.montant)}</div>
            </div>
          ))}

          {stats.depensesMois.length === 0 && (
            <div className="empty">Aucune dépense pour le mois sélectionné.</div>
          )}
        </div>
      </div>

      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <h3>Toutes les dépenses enregistrées</h3>

        <div className="list">
          {depenses.map((item) => (
            <div className="item" key={item.id}>
              <div>
                <strong>{item.titre}</strong>
                <p>
                  {item.fournisseur || "Aucun fournisseur"} · Départ :{" "}
                  {item.date} · {item.categorie}
                </p>

                <div className="badge-row">
                  <span className="badge">
                    {recurrenceLabel(item.recurrence)}
                  </span>

                  {item.moyenPaiement && (
                    <span className="badge gray">{item.moyenPaiement}</span>
                  )}
                </div>
              </div>

              <div className="amount">{money(item.montant)}</div>
            </div>
          ))}

          {depenses.length === 0 && (
            <div className="empty">Aucune dépense ajoutée.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Depenses;