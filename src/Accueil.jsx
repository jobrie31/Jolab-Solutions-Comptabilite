import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

import Clients from "./Clients";
import Factures from "./Factures";
import Depenses from "./Depenses";
import Paiements from "./Paiements";
import Resume from "./Resume";

const ACCOUNTING_APP_ID = "jolab-solutions-comptabilite";

function money(value) {
  const number = Number(value || 0);

  return number.toLocaleString("fr-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function getMonthKey(dateValue) {
  if (!dateValue) return new Date().toISOString().slice(0, 7);
  return String(dateValue).slice(0, 7);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getYearFromMonthKey(monthKey) {
  return String(monthKey || currentMonth()).slice(0, 4);
}

function getMonthsOfYear(year) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLastDayOfMonth(year, monthIndexZeroBased) {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

function getOccurrenceDateForMonth(item, moisActif) {
  if (!item?.date || !moisActif) return "";

  const recurrence = item.recurrence || "unique";
  const itemMonthKey = getMonthKey(item.date);

  if (recurrence === "unique") {
    return itemMonthKey === moisActif ? item.date : "";
  }

  const [, , originalDayText] = String(item.date).split("-");
  const originalDay = Number(originalDayText || 1);

  const [selectedYear, selectedMonth] = moisActif.split("-").map(Number);
  const monthIndex = selectedMonth - 1;
  const safeDay = Math.min(
    originalDay,
    getLastDayOfMonth(selectedYear, monthIndex)
  );

  return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
    safeDay
  ).padStart(2, "0")}`;
}

function itemAppliesToMonth(item, moisActif) {
  const itemMonthKey = getMonthKey(item.date);
  const recurrence = item.recurrence || "unique";

  if (!item.date || !moisActif) return false;

  if (recurrence === "unique") {
    return itemMonthKey === moisActif;
  }

  const selectedDate = new Date(`${moisActif}-01T00:00:00`);
  const startDate = new Date(`${itemMonthKey}-01T00:00:00`);

  if (selectedDate < startDate) {
    return false;
  }

  if (recurrence === "mensuelle") {
    return true;
  }

  if (recurrence === "annuelle") {
    const itemDate = new Date(`${item.date}T00:00:00`);
    return itemDate.getMonth() === selectedDate.getMonth();
  }

  return itemMonthKey === moisActif;
}

function getItemsForYear(items, year) {
  const months = getMonthsOfYear(year);
  const result = [];

  months.forEach((monthKey) => {
    items.forEach((item) => {
      if (itemAppliesToMonth(item, monthKey)) {
        result.push({
          ...item,
          moisAffiche: monthKey,
          occurrenceDate: getOccurrenceDateForMonth(item, monthKey),
        });
      }
    });
  });

  return result;
}

function recurrenceLabel(value) {
  if (value === "mensuelle") return "Mensuel";
  if (value === "annuelle") return "Annuel";
  return "Une fois";
}

function Accueil() {
  const [page, setPage] = useState("accueil");
  const [moisActif, setMoisActif] = useState(currentMonth());

  const [clients, setClients] = useState([]);
  const [factures, setFactures] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [paiements, setPaiements] = useState([]);

  const [clientForm, setClientForm] = useState({
    entreprise: "",
    personne: "",
    telephone: "",
    email: "",
    notes: "",
  });

  const [facturePreview, setFacturePreview] = useState({
    entreprise: "Nom de l’entreprise",
    personne: "Nom de la personne",
    applicationNom: "Application / service",
    montant: 0,
    date: todayDate(),
    description: "Services professionnels",
    statut: "Aperçu seulement",
  });

  const [depenseForm, setDepenseForm] = useState({
    titre: "",
    fournisseur: "",
    montant: "",
    date: todayDate(),
    categorie: "Général",
    recurrence: "unique",
    moyenPaiement: "",
  });

  const [paiementForm, setPaiementForm] = useState({
    client: "",
    montant: "",
    date: todayDate(),
    note: "",
    recurrence: "unique",
    moyenPaiement: "",
  });

  const baseRef = (...segments) =>
    collection(db, "apps", ACCOUNTING_APP_ID, ...segments);

  const clientDocRef = (clientId) =>
    doc(db, "apps", ACCOUNTING_APP_ID, "clients", clientId);

  useEffect(() => {
    const unsubClients = onSnapshot(baseRef("clients"), (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        applications: [],
        ...docItem.data(),
      }));

      setClients(
        data.sort((a, b) =>
          String(a.entreprise || "").localeCompare(String(b.entreprise || ""))
        )
      );
    });

    const unsubFactures = onSnapshot(baseRef("factures"), (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setFactures(
        data.sort((a, b) =>
          String(b.date || "").localeCompare(String(a.date || ""))
        )
      );
    });

    const unsubDepenses = onSnapshot(baseRef("depenses"), (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setDepenses(
        data.sort((a, b) =>
          String(b.date || "").localeCompare(String(a.date || ""))
        )
      );
    });

    const unsubPaiements = onSnapshot(baseRef("paiements"), (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setPaiements(
        data.sort((a, b) =>
          String(b.date || "").localeCompare(String(a.date || ""))
        )
      );
    });

    return () => {
      unsubClients();
      unsubFactures();
      unsubDepenses();
      unsubPaiements();
    };
  }, []);

  const stats = useMemo(() => {
    const anneeActive = getYearFromMonthKey(moisActif);

    const facturesMois = factures.filter(
      (item) => getMonthKey(item.date) === moisActif
    );

    const depensesMois = depenses
      .filter((item) => itemAppliesToMonth(item, moisActif))
      .map((item) => ({
        ...item,
        occurrenceDate: getOccurrenceDateForMonth(item, moisActif),
      }));

    const paiementsMois = paiements
      .filter((item) => itemAppliesToMonth(item, moisActif))
      .map((item) => ({
        ...item,
        occurrenceDate: getOccurrenceDateForMonth(item, moisActif),
      }));

    const depensesAnnee = getItemsForYear(depenses, anneeActive);
    const paiementsAnnee = getItemsForYear(paiements, anneeActive);

    const totalFacture = facturesMois.reduce(
      (sum, item) => sum + Number(item.montant || 0),
      0
    );

    const totalDepenses = depensesMois.reduce(
      (sum, item) => sum + Number(item.montant || 0),
      0
    );

    const totalPaiements = paiementsMois.reduce(
      (sum, item) => sum + Number(item.montant || 0),
      0
    );

    const totalDepensesAnnee = depensesAnnee.reduce(
      (sum, item) => sum + Number(item.montant || 0),
      0
    );

    const totalPaiementsAnnee = paiementsAnnee.reduce(
      (sum, item) => sum + Number(item.montant || 0),
      0
    );

    const profit = totalPaiements - totalDepenses;
    const profitAnnee = totalPaiementsAnnee - totalDepensesAnnee;
    const aRecevoir = totalFacture - totalPaiements;

    return {
      anneeActive,
      facturesMois,
      depensesMois,
      paiementsMois,
      depensesAnnee,
      paiementsAnnee,
      totalFacture,
      totalDepenses,
      totalPaiements,
      totalDepensesAnnee,
      totalPaiementsAnnee,
      profit,
      profitAnnee,
      aRecevoir,
    };
  }, [factures, depenses, paiements, moisActif]);

  async function ajouterClient(e) {
    e.preventDefault();

    if (!clientForm.entreprise.trim()) {
      alert("Entre le nom de l’entreprise.");
      return;
    }

    await addDoc(baseRef("clients"), {
      entreprise: clientForm.entreprise.trim(),
      personne: clientForm.personne.trim(),
      telephone: clientForm.telephone.trim(),
      email: clientForm.email.trim(),
      notes: clientForm.notes.trim(),
      applications: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setClientForm({
      entreprise: "",
      personne: "",
      telephone: "",
      email: "",
      notes: "",
    });
  }

  async function ajouterApplicationClient(clientId, applicationForm) {
    if (!clientId) {
      alert("Client introuvable.");
      return;
    }

    if (!applicationForm.nomApplication.trim()) {
      alert("Entre le nom de l’application.");
      return;
    }

    const client = clients.find((item) => item.id === clientId);

    if (!client) {
      alert("Client introuvable.");
      return;
    }

    const applicationId = createId();

    const nouvelleApplication = {
      id: applicationId,
      nomApplication: applicationForm.nomApplication.trim(),
      dateOuverture: applicationForm.dateOuverture || todayDate(),
      montant: Number(applicationForm.montant || 0),
      datePaiement:
        applicationForm.datePaiement ||
        applicationForm.dateOuverture ||
        todayDate(),
      recurrencePaiement: applicationForm.recurrencePaiement || "unique",
      createdAtText: new Date().toISOString(),
    };

    const applicationsActuelles = Array.isArray(client.applications)
      ? client.applications
      : [];

    await updateDoc(clientDocRef(clientId), {
      applications: [...applicationsActuelles, nouvelleApplication],
      updatedAt: serverTimestamp(),
    });

    await addDoc(baseRef("paiements"), {
      client: client.entreprise || "",
      clientId: client.id || "",
      clientEntreprise: client.entreprise || "",
      clientPersonne: client.personne || "",
      applicationId,
      applicationNom: nouvelleApplication.nomApplication,
      montant: Number(nouvelleApplication.montant || 0),
      date: nouvelleApplication.datePaiement,
      mois: getMonthKey(nouvelleApplication.datePaiement),
      note: `Paiement prévu - ${nouvelleApplication.nomApplication}`,
      recurrence: nouvelleApplication.recurrencePaiement || "unique",
      moyenPaiement: "À déterminer",
      statutPaiement: "Prévu",
      automatique: true,
      source: "application_client",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function modifierApplicationClient(
    clientId,
    applicationId,
    applicationForm
  ) {
    if (!clientId) {
      alert("Client introuvable.");
      return;
    }

    if (!applicationId) {
      alert("Application introuvable.");
      return;
    }

    if (!applicationForm.nomApplication.trim()) {
      alert("Entre le nom de l’application.");
      return;
    }

    const client = clients.find((item) => item.id === clientId);

    if (!client) {
      alert("Client introuvable.");
      return;
    }

    const applicationsActuelles = Array.isArray(client.applications)
      ? client.applications
      : [];

    const applicationAvant = applicationsActuelles.find(
      (application) => application.id === applicationId
    );

    const datePaiementFinale =
      applicationForm.datePaiement ||
      applicationForm.dateOuverture ||
      todayDate();

    const applicationsModifiees = applicationsActuelles.map((application) => {
      if (application.id !== applicationId) return application;

      return {
        ...application,
        nomApplication: applicationForm.nomApplication.trim(),
        dateOuverture: applicationForm.dateOuverture || todayDate(),
        montant: Number(applicationForm.montant || 0),
        datePaiement: datePaiementFinale,
        recurrencePaiement: applicationForm.recurrencePaiement || "unique",
        updatedAtText: new Date().toISOString(),
      };
    });

    await updateDoc(clientDocRef(clientId), {
      applications: applicationsModifiees,
      updatedAt: serverTimestamp(),
    });

    const paiementsLies = paiements.filter(
      (paiement) =>
        paiement.clientId === clientId &&
        paiement.applicationId === applicationId &&
        paiement.source === "application_client"
    );

    await Promise.all(
      paiementsLies.map((paiement) =>
        updateDoc(doc(db, "apps", ACCOUNTING_APP_ID, "paiements", paiement.id), {
          client: client.entreprise || "",
          clientId: client.id || "",
          clientEntreprise: client.entreprise || "",
          clientPersonne: client.personne || "",
          applicationId,
          applicationNom: applicationForm.nomApplication.trim(),
          montant: Number(applicationForm.montant || 0),
          date: datePaiementFinale,
          mois: getMonthKey(datePaiementFinale),
          note: `Paiement prévu - ${applicationForm.nomApplication.trim()}`,
          recurrence: applicationForm.recurrencePaiement || "unique",
          updatedAt: serverTimestamp(),
        })
      )
    );

    if (!applicationAvant) {
      alert("Application modifiée, mais l’ancienne version n’a pas été retrouvée.");
    }
  }

  async function creerFactureDepuisPaiement(paiement, occurrenceDate) {
    if (!paiement) return;

    const today = todayDate();

    if (occurrenceDate > today) {
      alert(
        "Ce paiement est dans le futur. Tu pourras créer la facture quand la date sera passée."
      );
      return;
    }

    const factureExiste = factures.some(
      (facture) =>
        facture.paiementId === paiement.id &&
        facture.paiementOccurrenceDate === occurrenceDate
    );

    if (factureExiste) {
      alert("Une facture existe déjà pour ce paiement.");
      return;
    }

    const client = clients.find((item) => item.id === paiement.clientId);

    await addDoc(baseRef("factures"), {
      clientId: paiement.clientId || "",
      clientEntreprise: paiement.clientEntreprise || paiement.client || "",
      clientPersonne: paiement.clientPersonne || client?.personne || "",
      applicationId: paiement.applicationId || "",
      applicationNom: paiement.applicationNom || "",
      applicationRecurrencePaiement: paiement.recurrence || "unique",
      paiementId: paiement.id,
      paiementOccurrenceDate: occurrenceDate,
      entreprise: paiement.clientEntreprise || paiement.client || "",
      personne: paiement.clientPersonne || client?.personne || "",
      montant: Number(paiement.montant || 0),
      date: occurrenceDate,
      mois: getMonthKey(occurrenceDate),
      description: paiement.applicationNom
        ? `Application : ${paiement.applicationNom}`
        : paiement.note || "Services professionnels",
      statut: "À payer",
      createdFromPayment: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setFacturePreview({
      entreprise: paiement.clientEntreprise || paiement.client || "",
      personne: paiement.clientPersonne || client?.personne || "",
      applicationNom: paiement.applicationNom || "",
      montant: Number(paiement.montant || 0),
      date: occurrenceDate,
      description: paiement.applicationNom
        ? `Application : ${paiement.applicationNom}`
        : paiement.note || "Services professionnels",
      statut: "Créée",
    });

    setPage("factures");
  }

  async function ajouterDepense(e) {
    e.preventDefault();

    if (!depenseForm.titre.trim()) {
      alert("Entre un titre de dépense.");
      return;
    }

    if (!depenseForm.montant || Number(depenseForm.montant) <= 0) {
      alert("Entre un montant valide.");
      return;
    }

    await addDoc(baseRef("depenses"), {
      titre: depenseForm.titre.trim(),
      fournisseur: depenseForm.fournisseur.trim(),
      montant: Number(depenseForm.montant),
      date: depenseForm.date,
      mois: getMonthKey(depenseForm.date),
      categorie: depenseForm.categorie.trim(),
      recurrence: depenseForm.recurrence,
      moyenPaiement: depenseForm.moyenPaiement.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setDepenseForm({
      titre: "",
      fournisseur: "",
      montant: "",
      date: todayDate(),
      categorie: "Général",
      recurrence: "unique",
      moyenPaiement: "",
    });
  }

  async function ajouterPaiement(e) {
    e.preventDefault();

    if (!paiementForm.client.trim()) {
      alert("Entre le client ou l’entreprise.");
      return;
    }

    if (!paiementForm.montant || Number(paiementForm.montant) <= 0) {
      alert("Entre un montant valide.");
      return;
    }

    await addDoc(baseRef("paiements"), {
      client: paiementForm.client.trim(),
      montant: Number(paiementForm.montant),
      date: paiementForm.date,
      mois: getMonthKey(paiementForm.date),
      note: paiementForm.note.trim(),
      recurrence: paiementForm.recurrence,
      moyenPaiement: paiementForm.moyenPaiement.trim(),
      statutPaiement: "Reçu",
      automatique: false,
      source: "manuel",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setPaiementForm({
      client: "",
      montant: "",
      date: todayDate(),
      note: "",
      recurrence: "unique",
      moyenPaiement: "",
    });
  }

  function fillFactureFromClient(client, application = null) {
    setFacturePreview({
      entreprise: client?.entreprise || "Nom de l’entreprise",
      personne: client?.personne || "Nom de la personne",
      applicationNom: application?.nomApplication || "Application / service",
      montant: application?.montant || 0,
      date: application?.datePaiement || todayDate(),
      description: application?.nomApplication
        ? `Application : ${application.nomApplication}`
        : "Services professionnels",
      statut: "Aperçu seulement",
    });

    setPage("factures");
  }

  const sharedProps = {
    page,
    setPage,
    moisActif,
    setMoisActif,
    clients,
    factures,
    depenses,
    paiements,
    stats,
    money,
    recurrenceLabel,
    todayDate,
    getOccurrenceDateForMonth,
    itemAppliesToMonth,
    clientForm,
    setClientForm,
    facturePreview,
    setFacturePreview,
    depenseForm,
    setDepenseForm,
    paiementForm,
    setPaiementForm,
    ajouterClient,
    ajouterApplicationClient,
    modifierApplicationClient,
    creerFactureDepuisPaiement,
    ajouterDepense,
    ajouterPaiement,
    fillFactureFromClient,
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          width: 100%;
          min-width: 100%;
          max-width: none;
          margin: 0;
          padding: 0;
        }

        body {
          margin: 0;
          background: #eef3fb;
          display: block;
          place-items: unset;
          overflow-x: hidden;
        }

        .app-compta {
          min-height: 100vh;
          width: 100vw;
          max-width: none;
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr);
          background: #eef3fb;
          color: #172033;
          font-family: Arial, sans-serif;
        }

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

        .sidebar-note {
          margin-top: auto;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 18px;
          padding: 16px;
        }

        .sidebar-note p {
          margin: 0 0 6px;
          color: #cbd5e1;
          font-size: 0.88rem;
        }

        .sidebar-note strong {
          font-size: 0.92rem;
          word-break: break-word;
          color: white;
        }

        .main {
          width: 100%;
          max-width: none;
          padding: 24px;
          overflow: auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
          background: white;
          border: 1px solid #dbe6f5;
          border-radius: 26px;
          padding: 22px;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
        }

        .topbar h2 {
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 2.75rem);
          color: #0f172a;
          letter-spacing: -0.045em;
        }

        .topbar p {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 1rem;
          font-weight: 600;
        }

        .month-picker {
          background: #f8fbff;
          border: 1px solid #dbe6f5;
          border-radius: 18px;
          padding: 13px 15px;
          display: grid;
          gap: 6px;
          min-width: 175px;
        }

        .month-picker label {
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #2563eb;
        }

        .month-picker input {
          border: none;
          font-weight: 900;
          color: #111827;
          font-size: 1rem;
          outline: none;
          background: transparent;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }

        .stat-card {
          background: white;
          border-radius: 22px;
          padding: 22px;
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.07);
          border: 1px solid #dbe6f5;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 6px;
          background: #2563eb;
        }

        .stat-card.positive::before {
          background: #059669;
        }

        .stat-card.danger::before {
          background: #dc2626;
        }

        .stat-card p {
          margin: 0;
          color: #475569;
          font-weight: 900;
          font-size: 0.9rem;
        }

        .stat-card h3 {
          margin: 10px 0 5px;
          color: #0f172a;
          font-size: 2.08rem;
          letter-spacing: -0.04em;
        }

        .stat-card span {
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .positive h3 {
          color: #047857;
        }

        .danger h3 {
          color: #dc2626;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
        }

        .panel {
          background: white;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
          border: 1px solid #dbe6f5;
        }

        .panel h3 {
          margin: 0 0 16px;
          font-size: 1.35rem;
          color: #0f172a;
          letter-spacing: -0.025em;
        }

        .panel-subtitle {
          margin: -8px 0 18px;
          color: #64748b;
          line-height: 1.45;
          font-weight: 600;
        }

        .form {
          display: grid;
          gap: 12px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field label {
          font-weight: 900;
          color: #334155;
          font-size: 0.86rem;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #cfd9e8;
          border-radius: 13px;
          padding: 12px;
          font-size: 0.95rem;
          outline: none;
          background: #f8fbff;
          color: #0f172a;
        }

        .field textarea {
          resize: vertical;
          min-height: 84px;
        }

        .field input:focus,
        .field textarea:focus,
        .field select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
          background: white;
        }

        .primary-btn {
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          padding: 13px 18px;
          font-weight: 900;
          cursor: pointer;
          font-size: 0.95rem;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.22);
        }

        .primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 24px rgba(37, 99, 235, 0.28);
        }

        .secondary-btn {
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 10px 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .secondary-btn:hover {
          background: #dbeafe;
        }

        .secondary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }

        .danger-btn {
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fee2e2;
          color: #b91c1c;
          padding: 10px 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .list {
          display: grid;
          gap: 10px;
        }

        .item {
          border: 1px solid #e2e8f0;
          background: #f8fbff;
          border-radius: 18px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .item strong {
          display: block;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .item p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.38;
          font-weight: 600;
        }

        .amount {
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
          font-size: 1rem;
        }

        .badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          background: #e8f0ff;
          color: #1d4ed8;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .badge.green {
          background: #dcfce7;
          color: #047857;
        }

        .badge.orange {
          background: #ffedd5;
          color: #c2410c;
        }

        .badge.gray {
          background: #e5e7eb;
          color: #374151;
        }

        .badge.dark {
          background: #0f172a;
          color: white;
        }

        .badge.future {
          background: #fef3c7;
          color: #92400e;
        }

        .empty {
          padding: 18px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          color: #64748b;
          background: #f8fafc;
          text-align: center;
          font-weight: 800;
        }

        .invoice-preview {
          border: 1px solid #dbe6f5;
          border-radius: 20px;
          padding: 22px;
          background: #f8fbff;
        }

        .invoice-preview-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 18px;
        }

        .invoice-preview h4 {
          margin: 0;
          font-size: 1.4rem;
          color: #0f172a;
        }

        .invoice-preview p {
          margin: 5px 0;
          color: #475569;
        }

        .invoice-total {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 1.25rem;
          font-weight: 900;
          color: #0f172a;
        }

        .dashboard-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .quick-btn {
          border: 1px solid #dbe6f5;
          background: white;
          border-radius: 20px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
          transition: 0.16s ease;
        }

        .quick-btn:hover {
          border-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.1);
        }

        .quick-btn strong {
          display: block;
          color: #0f172a;
          margin-bottom: 6px;
          font-size: 1rem;
        }

        .quick-btn span {
          color: #64748b;
          line-height: 1.35;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .section-header h3 {
          margin: 0;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border-radius: 18px;
          border: 1px solid #dbe6f5;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 950px;
          background: white;
        }

        .data-table th {
          text-align: left;
          background: #f1f5f9;
          color: #334155;
          padding: 13px;
          font-size: 0.83rem;
          border-bottom: 1px solid #dbe3ef;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .data-table td {
          padding: 13px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
          color: #0f172a;
        }

        .data-table tr:hover td {
          background: #f8fbff;
        }

        .table-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          backdrop-filter: blur(3px);
        }

        .modal {
          width: min(720px, 100%);
          max-height: 92vh;
          overflow: auto;
          background: white;
          border-radius: 26px;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.35);
          border: 1px solid #dbe6f5;
          padding: 24px;
        }

        .modal.large {
          width: min(1120px, 100%);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
        }

        .modal-header h3 {
          margin: 0;
          color: #0f172a;
          font-size: 1.45rem;
          letter-spacing: -0.025em;
        }

        .modal-header p {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 600;
        }

        .close-btn {
          border: none;
          background: #f1f5f9;
          color: #0f172a;
          border-radius: 12px;
          padding: 9px 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
        }

        .client-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .client-profile {
          background: linear-gradient(135deg, #eff6ff, #f8fbff);
          border: 1px solid #bfdbfe;
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 18px;
          display: grid;
          gap: 8px;
        }

        .client-profile h4 {
          margin: 0;
          color: #0f172a;
          font-size: 1.15rem;
        }

        .client-profile p {
          margin: 0;
          color: #475569;
          font-weight: 700;
        }

        .detail-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .detail-toolbar h3 {
          margin: 0;
        }

        .application-card {
          border: 1px solid #dbe6f5;
          background: white;
          border-radius: 18px;
          padding: 15px;
          display: grid;
          gap: 10px;
        }

        .application-card-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .application-card h4 {
          margin: 0;
          color: #0f172a;
          font-size: 1.02rem;
        }

        .application-card p {
          margin: 3px 0 0;
          color: #64748b;
          font-weight: 600;
        }

        .payment-card {
          border-radius: 18px;
          padding: 15px;
          display: grid;
          gap: 10px;
          border: 1px solid #cbd5e1;
          background: #0f172a;
          color: white;
        }

        .payment-card p,
        .payment-card strong,
        .payment-card h4 {
          color: white;
        }

        .payment-card .muted {
          color: #cbd5e1;
        }

        .payment-card.future {
          background: #fffbeb;
          border-color: #fbbf24;
          color: #78350f;
        }

        .payment-card.future p,
        .payment-card.future strong,
        .payment-card.future h4 {
          color: #78350f;
        }

        .payment-card.future .muted {
          color: #92400e;
        }

        .payment-card.invoiced {
          background: #f0fdf4;
          border-color: #86efac;
          color: #14532d;
        }

        .payment-card.invoiced p,
        .payment-card.invoiced strong,
        .payment-card.invoiced h4 {
          color: #14532d;
        }

        .payment-card.invoiced .muted {
          color: #166534;
        }

        .payment-card-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .payment-card h4 {
          margin: 0;
          font-size: 1.02rem;
        }

        .payment-card p {
          margin: 4px 0 0;
          font-weight: 650;
        }

        @media (max-width: 1150px) {
          .stats-grid,
          .dashboard-actions {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid-2,
          .client-detail-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .app-compta {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: relative;
            height: auto;
          }

          .menu {
            grid-template-columns: repeat(2, 1fr);
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .main {
            padding: 16px;
          }

          .stats-grid,
          .dashboard-actions,
          .form-row {
            grid-template-columns: 1fr;
          }

          .modal {
            padding: 18px;
          }

          .section-header,
          .detail-toolbar {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="app-compta">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">JS</div>
            <div>
              <h1>Jolab Solutions</h1>
              <p>Comptabilité</p>
            </div>
          </div>

          <nav className="menu">
            <button
              className={page === "accueil" ? "active" : ""}
              onClick={() => setPage("accueil")}
            >
              Accueil
            </button>

            <button
              className={page === "clients" ? "active" : ""}
              onClick={() => setPage("clients")}
            >
              Clients
            </button>

            <button
              className={page === "factures" ? "active" : ""}
              onClick={() => setPage("factures")}
            >
              Factures
            </button>

            <button
              className={page === "depenses" ? "active" : ""}
              onClick={() => setPage("depenses")}
            >
              Dépenses
            </button>

            <button
              className={page === "paiements" ? "active" : ""}
              onClick={() => setPage("paiements")}
            >
              Paiements
            </button>

            <button
              className={page === "resume" ? "active" : ""}
              onClick={() => setPage("resume")}
            >
              Résumé
            </button>
          </nav>

          <div className="sidebar-note">
            <p>Données Firestore</p>
            <strong>apps / jolab-solutions-comptabilite</strong>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <h2>Suivi travailleur autonome</h2>
              <p>
                Clients, factures, dépenses, paiements passés et paiements
                futurs au même endroit.
              </p>
            </div>

            <div className="month-picker">
              <label>Mois affiché</label>
              <input
                type="month"
                value={moisActif}
                onChange={(e) => setMoisActif(e.target.value)}
              />
            </div>
          </div>

          <section className="stats-grid">
            <div className="stat-card positive">
              <p>Paiements de l’année complète</p>
              <h3>{money(stats.totalPaiementsAnnee)}</h3>
              <span>
                Passés et futurs · {stats.paiementsAnnee.length} paiement(s) en{" "}
                {stats.anneeActive}
              </span>
            </div>

            <div className="stat-card danger">
              <p>Dépenses de l’année complète</p>
              <h3>{money(stats.totalDepensesAnnee)}</h3>
              <span>
                Passées et futures · {stats.depensesAnnee.length} dépense(s) en{" "}
                {stats.anneeActive}
              </span>
            </div>

            <div
              className={`stat-card ${
                stats.profitAnnee >= 0 ? "positive" : "danger"
              }`}
            >
              <p>Profit estimé annuel</p>
              <h3>{money(stats.profitAnnee)}</h3>
              <span>Prévision globale de {stats.anneeActive}</span>
            </div>
          </section>

          {page === "accueil" && (
            <>
              <section className="dashboard-actions">
                <button className="quick-btn" onClick={() => setPage("clients")}>
                  <strong>Ajouter un client</strong>
                  <span>Créer une fiche client et suivre ses applications.</span>
                </button>

                <button
                  className="quick-btn"
                  onClick={() => setPage("factures")}
                >
                  <strong>Voir les factures</strong>
                  <span>Aperçu de facture et historique par client.</span>
                </button>

                <button
                  className="quick-btn"
                  onClick={() => setPage("depenses")}
                >
                  <strong>Ajouter une dépense</strong>
                  <span>Suivre les dépenses passées et futures.</span>
                </button>

                <button
                  className="quick-btn"
                  onClick={() => setPage("paiements")}
                >
                  <strong>Ajouter un paiement</strong>
                  <span>Inscrire un paiement reçu ou prévu.</span>
                </button>
              </section>

              <section className="grid-2">
                <div className="panel">
                  <h3>Dernières factures</h3>

                  <div className="list">
                    {factures.slice(0, 6).map((item) => (
                      <div className="item" key={item.id}>
                        <div>
                          <strong>{item.entreprise}</strong>
                          <p>
                            {item.personne || "Aucun contact"} · {item.date}
                          </p>
                          {item.applicationNom && (
                            <p>
                              Application : {item.applicationNom} ·{" "}
                              {recurrenceLabel(
                                item.applicationRecurrencePaiement
                              )}
                            </p>
                          )}
                        </div>

                        <div className="amount">{money(item.montant)}</div>
                      </div>
                    ))}

                    {factures.length === 0 && (
                      <div className="empty">Aucune facture créée.</div>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <h3>Résumé du mois complet</h3>

                  <div className="list">
                    <div className="item">
                      <div>
                        <strong>Total reçu / prévu</strong>
                        <p>Paiements passés et futurs du mois sélectionné.</p>
                      </div>
                      <div className="amount">{money(stats.totalPaiements)}</div>
                    </div>

                    <div className="item">
                      <div>
                        <strong>À recevoir</strong>
                        <p>Factures du mois moins paiements du mois.</p>
                      </div>
                      <div className="amount">{money(stats.aRecevoir)}</div>
                    </div>

                    <div className="item">
                      <div>
                        <strong>Dépenses</strong>
                        <p>Dépenses passées et futures du mois sélectionné.</p>
                      </div>
                      <div className="amount">{money(stats.totalDepenses)}</div>
                    </div>

                    <div className="item">
                      <div>
                        <strong>Profit estimé</strong>
                        <p>Paiements moins dépenses pour tout le mois.</p>
                      </div>
                      <div className="amount">{money(stats.profit)}</div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {page === "clients" && <Clients {...sharedProps} />}
          {page === "factures" && <Factures {...sharedProps} />}
          {page === "depenses" && <Depenses {...sharedProps} />}
          {page === "paiements" && <Paiements {...sharedProps} />}
          {page === "resume" && <Resume {...sharedProps} />}
        </main>
      </div>
    </>
  );
}

export default Accueil;