const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const ACCOUNTING_APP_ID = "jolab-solutions-comptabilite";
const TIME_ZONE = "America/Toronto";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

function todayDateMontreal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getMonthKey(dateValue) {
  if (!dateValue) return todayDateMontreal().slice(0, 7);
  return String(dateValue).slice(0, 7);
}

function getLastDayOfMonth(year, monthIndexZeroBased) {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

function getMonthsOfYear(year) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
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

function factureEstEnvoyee(facture) {
  if (!facture) return false;

  const statut = String(
    facture.statut ||
      facture.statutFacture ||
      facture.statutPaiement ||
      ""
  )
    .trim()
    .toLowerCase();

  return (
    facture.envoye === true ||
    facture.envoyee === true ||
    facture.isEnvoye === true ||
    facture.sent === true ||
    statut === "envoyé" ||
    statut === "envoye" ||
    statut === "sent"
  );
}

function trouverFacturePourPaiement(factures, paiementId, occurrenceDate) {
  return (
    factures.find(
      (facture) =>
        facture.paiementId === paiementId &&
        facture.paiementOccurrenceDate === occurrenceDate
    ) || null
  );
}

function formatMoney(value) {
  const number = Number(value || 0);

  return number.toLocaleString("fr-CA", {
    style: "currency",
    currency: "CAD",
  });
}

async function getActiveTokens() {
  const tokensSnap = await admin
    .firestore()
    .collection("apps")
    .doc(ACCOUNTING_APP_ID)
    .collection("fcmTokens")
    .where("active", "==", true)
    .get();

  return tokensSnap.docs
    .map((doc) => doc.data()?.token)
    .filter(Boolean);
}

async function disableInvalidTokens(tokens, response) {
  const invalidTokens = [];

  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || "";

      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  await Promise.all(
    invalidTokens.map((token) =>
      admin
        .firestore()
        .collection("apps")
        .doc(ACCOUNTING_APP_ID)
        .collection("fcmTokens")
        .doc(token)
        .set(
          {
            active: false,
            disabledAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
    )
  );

  return invalidTokens.length;
}

async function envoyerPushATousLesTokens({ title, body, url = "/" }) {
  const tokens = await getActiveTokens();

  if (tokens.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Aucun token FCM actif trouvé dans Firestore."
    );
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,

    notification: {
      title,
      body,
    },

    data: {
      url,
    },

    webpush: {
      fcmOptions: {
        link: url,
      },
    },
  });

  const invalidTokensDisabled = await disableInvalidTokens(tokens, response);

  return {
    success: true,
    totalTokens: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokensDisabled,
  };
}

async function trouverFacturesNonEnvoyees() {
  const today = todayDateMontreal();
  const currentYear = today.slice(0, 4);
  const monthsOfYear = getMonthsOfYear(currentYear);

  const db = admin.firestore();
  const appRef = db.collection("apps").doc(ACCOUNTING_APP_ID);

  const [paiementsSnap, facturesSnap, clientsSnap] = await Promise.all([
    appRef.collection("paiements").get(),
    appRef.collection("factures").get(),
    appRef.collection("clients").get(),
  ]);

  const paiements = paiementsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const factures = facturesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const clients = clientsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const clientsMap = new Map(clients.map((client) => [client.id, client]));
  const lignes = [];

  paiements.forEach((paiement) => {
    if (!paiement.clientId) return;

    monthsOfYear.forEach((monthKey) => {
      if (!itemAppliesToMonth(paiement, monthKey)) return;

      const occurrenceDate = getOccurrenceDateForMonth(paiement, monthKey);

      if (!occurrenceDate) return;

      const isPastOrToday = occurrenceDate <= today;

      if (!isPastOrToday) return;

      const facture = trouverFacturePourPaiement(
        factures,
        paiement.id,
        occurrenceDate
      );

      if (factureEstEnvoyee(facture)) return;

      const client = clientsMap.get(paiement.clientId);

      lignes.push({
        paiementId: paiement.id,
        factureId: facture?.id || "",
        occurrenceDate,
        clientId: paiement.clientId || "",
        clientEntreprise:
          paiement.clientEntreprise ||
          paiement.client ||
          client?.entreprise ||
          "Sans client",
        applicationNom: paiement.applicationNom || paiement.note || "Paiement",
        montant: Number(paiement.montant || 0),
        recurrence: paiement.recurrence || "unique",
        factureExiste: Boolean(facture),
      });
    });
  });

  lignes.sort((a, b) => {
    const dateCompare = String(a.occurrenceDate).localeCompare(
      String(b.occurrenceDate)
    );

    if (dateCompare !== 0) return dateCompare;

    return String(a.clientEntreprise).localeCompare(String(b.clientEntreprise));
  });

  return lignes;
}

exports.envoyerNotificationTest = onCall(
  {
    region: "us-central1",
    maxInstances: 10,
  },
  async (request) => {
    const title = String(request.data?.title || "Test Jolab Comptabilité").slice(
      0,
      80
    );
    const body = String(
      request.data?.body || "La notification push fonctionne correctement."
    ).slice(0, 200);
    const url = String(request.data?.url || "/").slice(0, 300);

    return envoyerPushATousLesTokens({
      title,
      body,
      url,
    });
  }
);

exports.verifierFacturesNonEnvoyees = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
    maxInstances: 1,
  },
  async () => {
    const facturesNonEnvoyees = await trouverFacturesNonEnvoyees();

    if (facturesNonEnvoyees.length === 0) {
      console.log("Aucune facture non envoyée.");
      return {
        success: true,
        notified: false,
        count: 0,
      };
    }

    const total = facturesNonEnvoyees.reduce(
      (sum, ligne) => sum + Number(ligne.montant || 0),
      0
    );

    const firstItems = facturesNonEnvoyees
      .slice(0, 3)
      .map(
        (ligne) =>
          `${ligne.clientEntreprise} (${ligne.occurrenceDate})`
      )
      .join(", ");

    const extra =
      facturesNonEnvoyees.length > 3
        ? ` + ${facturesNonEnvoyees.length - 3} autre(s)`
        : "";

    const title =
      facturesNonEnvoyees.length === 1
        ? "1 facture non envoyée"
        : `${facturesNonEnvoyees.length} factures non envoyées`;

    const body = `${firstItems}${extra} — Total : ${formatMoney(total)}`;

    const result = await envoyerPushATousLesTokens({
      title,
      body,
      url: "/",
    });

    console.log("Notification factures non envoyées envoyée :", {
      count: facturesNonEnvoyees.length,
      total,
      result,
    });

    return {
      success: true,
      notified: true,
      count: facturesNonEnvoyees.length,
      total,
      ...result,
    };
  }
);