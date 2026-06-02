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

import SidebarCompta from "./SidebarCompta";
import Clients from "./Clients";
import Factures from "./Factures";
import Depenses from "./Depenses";
import Resume from "./Resume";
import HistoriqueClients from "./HistoriqueClients";
import InstallerApplication from "./InstallerApplication";
import BoutonNotifications from "./BoutonNotifications";

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

function monthNameFromKey(monthKey) {
  const [, monthText] = String(monthKey || currentMonth()).split("-");
  const monthIndex = Number(monthText || 1) - 1;

  const labels = [
    "Janv.",
    "Févr.",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juill.",
    "Août",
    "Sept.",
    "Oct.",
    "Nov.",
    "Déc.",
  ];

  return labels[monthIndex] || monthKey;
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function calculerPrixAvecRabais(
  montantBase,
  rabaisBienvenue = false,
  rabaisAnnuel = false
) {
  const prixBase = Number(montantBase || 0);
  const pourcentageRabais =
    (rabaisBienvenue ? 10 : 0) + (rabaisAnnuel ? 15 : 0);

  const montantRabais = Number(
    ((prixBase * pourcentageRabais) / 100).toFixed(2)
  );

  const montantFinal = Number((prixBase - montantRabais).toFixed(2));

  return {
    prixBase,
    rabaisBienvenue: Boolean(rabaisBienvenue),
    rabaisAnnuel: Boolean(rabaisAnnuel),
    pourcentageRabais,
    montantRabais,
    montantFinal,
  };
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
    prixBase: 0,
    rabaisBienvenue: false,
    rabaisAnnuel: false,
    pourcentageRabais: 0,
    montantRabais: 0,
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

  const moisDisponibles = useMemo(() => {
    return getMonthsOfYear(stats.anneeActive);
  }, [stats.anneeActive]);

  function changerAnnee(direction) {
    const year = Number(stats.anneeActive || new Date().getFullYear());
    const [, month] = moisActif.split("-");
    const nextYear = year + direction;

    setMoisActif(`${nextYear}-${month || "01"}`);
  }

  function actualiserApplication() {
    window.location.reload();
  }

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
      clientFerme: false,
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

  async function fermerClient(clientId) {
    if (!clientId) {
      alert("Client introuvable.");
      return;
    }

    await updateDoc(doc(db, "apps", ACCOUNTING_APP_ID, "clients", clientId), {
      clientFerme: true,
      dateFermeture: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    setPage("historique");
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

    const prix = calculerPrixAvecRabais(
      applicationForm.montant,
      applicationForm.rabaisBienvenue,
      applicationForm.rabaisAnnuel
    );

    const nouvelleApplication = {
      id: applicationId,
      nomApplication: applicationForm.nomApplication.trim(),
      dateOuverture: applicationForm.dateOuverture || todayDate(),
      prixBase: prix.prixBase,
      montant: prix.montantFinal,
      rabaisBienvenue: prix.rabaisBienvenue,
      rabaisAnnuel: prix.rabaisAnnuel,
      pourcentageRabais: prix.pourcentageRabais,
      montantRabais: prix.montantRabais,
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
      prixBase: prix.prixBase,
      montant: prix.montantFinal,
      rabaisBienvenue: prix.rabaisBienvenue,
      rabaisAnnuel: prix.rabaisAnnuel,
      pourcentageRabais: prix.pourcentageRabais,
      montantRabais: prix.montantRabais,
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

    const prix = calculerPrixAvecRabais(
      applicationForm.montant,
      applicationForm.rabaisBienvenue,
      applicationForm.rabaisAnnuel
    );

    const applicationsActuelles = Array.isArray(client.applications)
      ? client.applications
      : [];

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
        prixBase: prix.prixBase,
        montant: prix.montantFinal,
        rabaisBienvenue: prix.rabaisBienvenue,
        rabaisAnnuel: prix.rabaisAnnuel,
        pourcentageRabais: prix.pourcentageRabais,
        montantRabais: prix.montantRabais,
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
          prixBase: prix.prixBase,
          montant: prix.montantFinal,
          rabaisBienvenue: prix.rabaisBienvenue,
          rabaisAnnuel: prix.rabaisAnnuel,
          pourcentageRabais: prix.pourcentageRabais,
          montantRabais: prix.montantRabais,
          date: datePaiementFinale,
          mois: getMonthKey(datePaiementFinale),
          note: `Paiement prévu - ${applicationForm.nomApplication.trim()}`,
          recurrence: applicationForm.recurrencePaiement || "unique",
          updatedAt: serverTimestamp(),
        })
      )
    );
  }

  async function creerFactureDepuisPaiement(paiement, occurrenceDate) {
    if (!paiement) return;

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
      prixBase: Number(paiement.prixBase || paiement.montant || 0),
      rabaisBienvenue: Boolean(paiement.rabaisBienvenue),
      rabaisAnnuel: Boolean(paiement.rabaisAnnuel),
      pourcentageRabais: Number(paiement.pourcentageRabais || 0),
      montantRabais: Number(paiement.montantRabais || 0),
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
      prixBase: Number(paiement.prixBase || paiement.montant || 0),
      rabaisBienvenue: Boolean(paiement.rabaisBienvenue),
      rabaisAnnuel: Boolean(paiement.rabaisAnnuel),
      pourcentageRabais: Number(paiement.pourcentageRabais || 0),
      montantRabais: Number(paiement.montantRabais || 0),
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

  function fillFactureFromClient(client, application = null) {
    setFacturePreview({
      entreprise: client?.entreprise || "Nom de l’entreprise",
      personne: client?.personne || "Nom de la personne",
      applicationNom: application?.nomApplication || "Application / service",
      montant: application?.montant || 0,
      prixBase: application?.prixBase || application?.montant || 0,
      rabaisBienvenue: Boolean(application?.rabaisBienvenue),
      rabaisAnnuel: Boolean(application?.rabaisAnnuel),
      pourcentageRabais: Number(application?.pourcentageRabais || 0),
      montantRabais: Number(application?.montantRabais || 0),
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
    ajouterClient,
    ajouterApplicationClient,
    modifierApplicationClient,
    creerFactureDepuisPaiement,
    ajouterDepense,
    fillFactureFromClient,
    fermerClient,
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

        .main {
          width: 100%;
          max-width: none;
          padding: 22px;
          overflow: auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .page-title-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .page-header h2 {
          margin: 0;
          font-size: 1.85rem;
          color: #0f172a;
          letter-spacing: -0.04em;
        }

        .refresh-btn {
          border: 1px solid #dbe6f5;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.78);
          color: #334155;
          min-height: 38px;
          padding: 0 13px;
          font-size: 0.82rem;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
          transition: 0.16s ease;
          font-family: inherit;
          white-space: nowrap;
        }

        .refresh-btn:hover {
          background: #f8fbff;
          border-color: #93c5fd;
          color: #1d4ed8;
          transform: translateY(-1px);
        }

        .refresh-btn-icon {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.9rem;
          font-weight: 900;
        }

        .header-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .header-action-buttons {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid #dbe6f5;
          border-radius: 18px;
          padding: 6px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
          backdrop-filter: blur(8px);
        }

        .header-mini-btn {
          border: 1px solid #dbeafe;
          border-radius: 14px;
          background: #f8fbff;
          color: #1e3a8a;
          min-height: 40px;
          padding: 0 13px;
          font-size: 0.82rem;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: 0.16s ease;
          white-space: nowrap;
          font-family: inherit;
        }

        .header-mini-btn:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
          transform: translateY(-1px);
        }

        .header-mini-btn.install {
          color: #92400e;
          background: #fffbeb;
          border-color: #fde68a;
        }

        .header-mini-btn.install:hover {
          background: #fef3c7;
          border-color: #f59e0b;
        }

        .header-mini-btn.notify {
          color: #065f46;
          background: #ecfdf5;
          border-color: #a7f3d0;
        }

        .header-mini-btn.notify:hover {
          background: #d1fae5;
          border-color: #34d399;
        }

        .header-mini-icon {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.08);
          font-size: 0.82rem;
        }

        .year-nav {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #dbe6f5;
          border-radius: 18px;
          padding: 8px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .year-nav h1 {
          margin: 0;
          min-width: 128px;
          text-align: center;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1;
          letter-spacing: -0.035em;
        }

        .year-btn {
          border: 1px solid #bfdbfe;
          border-radius: 13px;
          background: #eff6ff;
          color: #1d4ed8;
          width: 40px;
          height: 40px;
          font-weight: 900;
          cursor: pointer;
          font-size: 1.25rem;
        }

        .year-btn:hover {
          background: #dbeafe;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 14px;
        }

        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 18px 20px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
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
          font-size: 0.86rem;
        }

        .stat-card h3 {
          margin: 9px 0 4px;
          color: #0f172a;
          font-size: 1.85rem;
          letter-spacing: -0.04em;
        }

        .stat-card span {
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .positive h3 {
          color: #047857;
        }

        .danger h3 {
          color: #dc2626;
        }

        .month-strip-wrap {
          margin-bottom: 18px;
          background: white;
          border: 1px solid #dbe6f5;
          border-radius: 20px;
          padding: 12px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
        }

        .month-strip {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 7px;
          width: 100%;
        }

        .month-tab {
          border: 1px solid #dbe6f5;
          background: #f8fbff;
          color: #334155;
          border-radius: 13px;
          padding: 11px 6px;
          font-weight: 900;
          cursor: pointer;
          text-align: center;
          font-size: 0.86rem;
          transition: 0.16s ease;
        }

        .month-tab:hover {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .month-tab.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
          box-shadow: 0 8px 16px rgba(37, 99, 235, 0.22);
        }

        .home-layout {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .panel {
          background: white;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
          border: 1px solid #dbe6f5;
        }

        .panel h3 {
          margin: 0 0 14px;
          font-size: 1.18rem;
          color: #0f172a;
          letter-spacing: -0.025em;
        }

        .summary-simple {
          display: grid;
          gap: 10px;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fbff;
          border-radius: 15px;
          padding: 13px;
        }

        .summary-line strong {
          color: #0f172a;
          font-size: 0.95rem;
        }

        .amount {
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
          font-size: 1rem;
        }

        .summary-line.total {
          background: #0f172a;
          border-color: #0f172a;
        }

        .summary-line.total strong,
        .summary-line.total .amount {
          color: white;
        }

        .summary-line.total.positive {
          background: #047857;
          border-color: #047857;
        }

        .summary-line.total.danger {
          background: #dc2626;
          border-color: #dc2626;
        }

        .home-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .home-mini-table-wrap {
          border: 1px solid #dbe6f5;
          border-radius: 16px;
          overflow: hidden;
          background: white;
        }

        .home-mini-title {
          margin: 0;
          padding: 12px 14px;
          background: #f8fbff;
          border-bottom: 1px solid #dbe6f5;
          font-size: 0.95rem;
          font-weight: 900;
          color: #0f172a;
        }

        .home-mini-table {
          width: 100%;
          border-collapse: collapse;
        }

        .home-mini-table th {
          background: #f1f5f9;
          color: #334155;
          text-align: left;
          padding: 8px 10px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #dbe3ef;
        }

        .home-mini-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          color: #0f172a;
          font-size: 0.86rem;
          vertical-align: middle;
          line-height: 1.2;
        }

        .home-mini-table tr:last-child td {
          border-bottom: none;
        }

        .home-mini-muted {
          color: #64748b;
          font-weight: 650;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
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

        .secondary-btn {
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 10px 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .secondary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
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
          padding: 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          color: #64748b;
          background: #f8fafc;
          text-align: center;
          font-weight: 800;
          font-size: 0.9rem;
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

        @media (max-width: 1150px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .grid-2,
          .home-layout,
          .home-details-grid {
            grid-template-columns: 1fr;
          }

          .month-strip {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .app-compta {
            grid-template-columns: 1fr;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-title-actions {
            width: 100%;
            justify-content: space-between;
          }

          .refresh-btn {
            min-height: 36px;
            padding: 0 11px;
          }

          .header-actions {
            width: 100%;
            justify-content: space-between;
          }

          .header-action-buttons {
            width: 100%;
            justify-content: space-between;
          }

          .header-mini-btn {
            flex: 1;
            justify-content: center;
          }

          .year-nav {
            width: 100%;
            justify-content: space-between;
          }

          .year-nav h1 {
            min-width: 0;
            flex: 1;
          }

          .main {
            padding: 16px;
          }

          .stats-grid,
          .form-row {
            grid-template-columns: 1fr;
          }

          .month-strip {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .modal {
            padding: 18px;
          }

          .section-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="app-compta">
        <SidebarCompta page={page} setPage={setPage} />

        <main className="main">
          <div className="page-header">
            <div className="page-title-actions">
              <h2>Suivi travailleur autonome</h2>

              <button
                className="refresh-btn"
                type="button"
                onClick={actualiserApplication}
                title="Actualiser l’application"
              >
                <span className="refresh-btn-icon">↻</span>
                <span>Actualiser</span>
              </button>
            </div>

            {page === "accueil" && (
              <div className="header-actions">
                <div className="header-action-buttons">
                  <InstallerApplication compact />
                  <BoutonNotifications compact />
                </div>

                <div className="year-nav">
                  <button
                    className="year-btn"
                    onClick={() => changerAnnee(-1)}
                    type="button"
                  >
                    ‹
                  </button>

                  <h1>Année {stats.anneeActive}</h1>

                  <button
                    className="year-btn"
                    onClick={() => changerAnnee(1)}
                    type="button"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>

          {page === "accueil" && (
            <>
              <section className="stats-grid">
                <div className="stat-card positive">
                  <p>Paiements de l’année complète</p>
                  <h3>{money(stats.totalPaiementsAnnee)}</h3>
                  <span>{stats.paiementsAnnee.length} paiement(s)</span>
                </div>

                <div className="stat-card danger">
                  <p>Dépenses de l’année complète</p>
                  <h3>{money(stats.totalDepensesAnnee)}</h3>
                  <span>{stats.depensesAnnee.length} dépense(s)</span>
                </div>

                <div
                  className={`stat-card ${
                    stats.profitAnnee >= 0 ? "positive" : "danger"
                  }`}
                >
                  <p>Profit estimé annuel</p>
                  <h3>{money(stats.profitAnnee)}</h3>
                  <span>{stats.anneeActive}</span>
                </div>
              </section>

              <div className="month-strip-wrap">
                <div className="month-strip">
                  {moisDisponibles.map((monthKey) => (
                    <button
                      key={monthKey}
                      type="button"
                      className={`month-tab ${
                        moisActif === monthKey ? "active" : ""
                      }`}
                      onClick={() => setMoisActif(monthKey)}
                    >
                      {monthNameFromKey(monthKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="home-layout">
                <section className="panel">
                  <h3>Résumé du mois</h3>

                  <div className="summary-simple">
                    <div className="summary-line">
                      <strong>Paiement :</strong>
                      <div className="amount">{money(stats.totalPaiements)}</div>
                    </div>

                    <div className="summary-line">
                      <strong>Dépense :</strong>
                      <div className="amount">{money(stats.totalDepenses)}</div>
                    </div>

                    <div
                      className={`summary-line total ${
                        stats.profit >= 0 ? "positive" : "danger"
                      }`}
                    >
                      <strong>Total :</strong>
                      <div className="amount">{money(stats.profit)}</div>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="home-details-grid">
                    <div className="home-mini-table-wrap">
                      <h3 className="home-mini-title">Paiements</h3>

                      <table className="home-mini-table">
                        <thead>
                          <tr>
                            <th>Client</th>
                            <th>Application</th>
                            <th>Montant</th>
                          </tr>
                        </thead>

                        <tbody>
                          {stats.paiementsMois.map((item) => (
                            <tr
                              key={`${item.id}-${
                                item.occurrenceDate || item.date
                              }`}
                            >
                              <td>
                                <strong>
                                  {item.clientEntreprise ||
                                    item.client ||
                                    "Sans client"}
                                </strong>
                              </td>

                              <td>
                                <span className="home-mini-muted">
                                  {item.applicationNom || item.note || "-"}
                                </span>
                              </td>

                              <td>
                                <strong>{money(item.montant)}</strong>
                              </td>
                            </tr>
                          ))}

                          {stats.paiementsMois.length === 0 && (
                            <tr>
                              <td colSpan="3">
                                <div className="empty">Aucun paiement.</div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="home-mini-table-wrap">
                      <h3 className="home-mini-title">Dépenses</h3>

                      <table className="home-mini-table">
                        <thead>
                          <tr>
                            <th>Dépense</th>
                            <th>Info</th>
                            <th>Montant</th>
                          </tr>
                        </thead>

                        <tbody>
                          {stats.depensesMois.map((item) => (
                            <tr
                              key={`${item.id}-${
                                item.occurrenceDate || item.date
                              }`}
                            >
                              <td>
                                <strong>{item.titre || "-"}</strong>
                              </td>

                              <td>
                                <span className="home-mini-muted">
                                  {item.fournisseur || item.categorie || "-"}
                                </span>
                              </td>

                              <td>
                                <strong>{money(item.montant)}</strong>
                              </td>
                            </tr>
                          ))}

                          {stats.depensesMois.length === 0 && (
                            <tr>
                              <td colSpan="3">
                                <div className="empty">Aucune dépense.</div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}

          {page === "clients" && (
            <Clients
              {...sharedProps}
              clients={clients.filter((client) => !client.clientFerme)}
            />
          )}

          {page === "factures" && <Factures {...sharedProps} />}
          {page === "depenses" && <Depenses {...sharedProps} />}
          {page === "resume" && <Resume {...sharedProps} />}

          {page === "historique" && (
            <HistoriqueClients {...sharedProps} clients={clients} />
          )}
        </main>
      </div>
    </>
  );
}

export default Accueil;