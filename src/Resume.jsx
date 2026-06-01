function Resume({ clients, stats, money }) {
  return (
    <section className="grid-2">
      <div className="panel">
        <h3>Résumé du mois sélectionné</h3>

        <div className="list">
          <div className="item">
            <div>
              <strong>Factures créées</strong>
              <p>Total des montants facturés.</p>
            </div>
            <div className="amount">{money(stats.totalFacture)}</div>
          </div>

          <div className="item">
            <div>
              <strong>Paiements reçus</strong>
              <p>Argent reçu, incluant les paiements récurrents.</p>
            </div>
            <div className="amount">{money(stats.totalPaiements)}</div>
          </div>

          <div className="item">
            <div>
              <strong>Montant à recevoir</strong>
              <p>Factures moins paiements.</p>
            </div>
            <div className="amount">{money(stats.aRecevoir)}</div>
          </div>

          <div className="item">
            <div>
              <strong>Dépenses</strong>
              <p>Total des dépenses du mois, incluant les récurrences.</p>
            </div>
            <div className="amount">{money(stats.totalDepenses)}</div>
          </div>

          <div className="item">
            <div>
              <strong>Profit estimé</strong>
              <p>Paiements reçus moins dépenses.</p>
            </div>
            <div className="amount">{money(stats.profit)}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Infos rapides</h3>

        <div className="list">
          <div className="item">
            <div>
              <strong>Clients actifs</strong>
              <p>Nombre total de clients ajoutés.</p>
            </div>
            <div className="amount">{clients.length}</div>
          </div>

          <div className="item">
            <div>
              <strong>Factures ce mois-ci</strong>
              <p>Factures dans le mois sélectionné.</p>
            </div>
            <div className="amount">{stats.facturesMois.length}</div>
          </div>

          <div className="item">
            <div>
              <strong>Dépenses ce mois-ci</strong>
              <p>Dépenses applicables au mois sélectionné.</p>
            </div>
            <div className="amount">{stats.depensesMois.length}</div>
          </div>

          <div className="item">
            <div>
              <strong>Paiements ce mois-ci</strong>
              <p>Paiements applicables au mois sélectionné.</p>
            </div>
            <div className="amount">{stats.paiementsMois.length}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Resume;