function SidebarCompta({ page, setPage }) {
  const menuItems = [
    { id: "accueil", label: "Accueil" },
    { id: "clients", label: "Clients" },
    { id: "factures", label: "Factures" },
    { id: "depenses", label: "Dépenses" },
    { id: "resume", label: "Résumé" },
    { id: "historique", label: "Historique" },
  ];

  return (
    <>
      <style>{`
        .sidebar {
          background: linear-gradient(180deg, #0f172a 0%, #111c36 55%, #102a55 100%);
          color: white;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          position: sticky;
          top: 0;
          height: 100vh;
          box-shadow: 12px 0 30px rgba(15, 23, 42, 0.18);
          z-index: 10;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255,255,255,0.14);
        }

        .brand-logo {
          width: 50px;
          height: 50px;
          border-radius: 17px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 1.08rem;
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35);
        }

        .brand h1 {
          margin: 0;
          font-size: 1.08rem;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .brand p {
          margin: 4px 0 0;
          color: #cbd5e1;
          font-size: 0.86rem;
        }

        .menu {
          display: grid;
          gap: 9px;
        }

        .menu button {
          border: 1px solid transparent;
          background: transparent;
          color: #dbeafe;
          text-align: left;
          padding: 12px 14px;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
          font-size: 0.95rem;
          transition: 0.16s ease;
        }

        .menu button:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
          color: white;
        }

        .menu button.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
        }

        @media (max-width: 760px) {
          .sidebar {
            position: relative;
            height: auto;
          }

          .menu {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">JS</div>

          <div>
            <h1>Jolab Solutions</h1>
            <p>Comptabilité</p>
          </div>
        </div>

        <nav className="menu">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default SidebarCompta;