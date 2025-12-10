import "./style.css";

// ===============================
//  Configuration de l'API Vélib'
// ===============================
// URL de l'API OpenData Paris pour la disponibilité des stations Vélib'.
// Ici on demande jusqu'à 200 enregistrements (rows=200).
const API_URL =
  "https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&rows=200";

// ===============================
//  Variables globales
// ===============================
// allStations : tableau qui contiendra toutes les stations renvoyées par l'API.
let allStations = [];
// currentPage : numéro de la page actuelle pour la pagination.
let currentPage = 1;
// pageSize : nombre de stations affichées par page.
const pageSize = 20;
// currentFilter : texte tapé dans la barre de recherche (en minuscule).
let currentFilter = "";

// ===============================
//  Construction du HTML principal
// ===============================
// On sélectionne la div racine #app dans notre index.html.
const app = document.querySelector("#app");

// On injecte tout le HTML de notre application dans #app.
// Cela définit :
// - le header
// - la page d'accueil (home-view)
// - la page liste/recherche (stations-view)
// - le footer
app.innerHTML = `
  <header class="site-header">
    <button id="home-top" class="home-top-button">Home</button>
    <h1>🚲 Vélib' – Disponibilité en temps réel</h1>
    <p>Recherche de stations Vélib' (données OpenData Paris).</p>
  </header>

  <main>
    <!-- PAGE D'ACCUEIL (DASHBOARD) -->
    <section id="home-view" class="home-view">
      <div class="home-hero">
        <h2>Bienvenue 👋</h2>
        <p>
          Consulte en temps réel la disponibilité des stations Vélib' à Paris.
          Tu peux chercher par nom de station ou par code INSEE.
        </p>
        <!-- Bouton qui permet de passer à la page des stations -->
        <button id="go-stations" class="primary-button">Voir les stations</button>
      </div>

      <!-- BLOC STATISTIQUES SUR LES STATIONS -->
      <section class="home-stats">
        <h3>Statistiques rapides</h3>
        <div class="stats-grid">
          <article class="stat-card">
            <p class="stat-label">Stations chargées</p>
            <p class="stat-value" id="stat-total-stations">--</p>
          </article>
          <article class="stat-card">
            <p class="stat-label">Vélos disponibles</p>
            <p class="stat-value" id="stat-total-bikes">--</p>
          </article>
          <article class="stat-card">
            <p class="stat-label">Places libres</p>
            <p class="stat-value" id="stat-total-docks">--</p>
          </article>
        </div>
      </section>
    </section>

    <!-- PAGE LISTE / RECHERCHE DES STATIONS -->
    <section id="stations-view" class="stations-view" style="display: none;">
      <!-- Barre de recherche (nom station ou code INSEE) -->
      <section class="search-section">
        <input
          id="search-input"
          type="search"
          placeholder="Rechercher par nom de station ou code INSEE…"
          aria-label="Rechercher une station"
        />
        <button id="search-button">Rechercher</button>
      </section>

      <!-- Zone d'affichage des erreurs API -->
      <section id="error" class="error" hidden></section>

      <!-- Zone où on affiche toutes les cartes de stations -->
      <section id="results" class="results"></section>
    </section>
  </main>

  <!-- FOOTER avec infos sur la source des données -->
  <footer class="site-footer">
    <p class="footer-title">Vélib' – Disponibilité en temps réel</p>
    <p class="footer-text">
      Données fournies par l'API OpenData Paris :
      <a href="https://opendata.paris.fr/explore/dataset/velib-disponibilite-en-temps-reel/information/?disjunctive.is_renting&amp;disjunctive.is_installed&amp;disjunctive.is_returning&amp;disjunctive.name&amp;disjunctive.nom_arrondissement_communes"
         target="_blank"
         class="footer-link">
         Vélib - Vélos et bornes - Disponibilité temps réel
      </a>
    </p>
    <p class="footer-text">
      Projet Adataviz réalisé dans le cadre de la formation Ada Tech School.
    </p>
  </footer>
`;

// ===============================
//  Sélection des éléments du DOM
// ===============================
// On récupère tous les éléments dont on aura besoin dans le JS.
const searchInput = document.querySelector("#search-input");
const searchButton = document.querySelector("#search-button");
const resultsDiv = document.querySelector("#results");
const errorDiv = document.querySelector("#error");

const homeTopBtn = document.querySelector("#home-top");
const homeView = document.querySelector("#home-view");
const stationsView = document.querySelector("#stations-view");
const goStationsBtn = document.querySelector("#go-stations");

const statTotalStations = document.querySelector("#stat-total-stations");
const statTotalBikes = document.querySelector("#stat-total-bikes");
const statTotalDocks = document.querySelector("#stat-total-docks");

// ===============================
//  Fonctions d'affichage des vues
// ===============================
// showHome : affiche la page d'accueil (dashboard) et cache la liste.
function showHome() {
  homeView.style.display = "block";
  stationsView.style.display = "none";
}

// showStations : affiche la liste des stations et cache la page d'accueil.
function showStations() {
  homeView.style.display = "none";
  stationsView.style.display = "block";
}

// ===============================
//  Bouton Home (en haut à gauche)
// ===============================
// Quand on clique sur le bouton Home :
// - on vide la recherche
// - on recharge les données complètes
// - on revient sur la page d'accueil
// - on remonte en haut de la page
homeTopBtn.addEventListener("click", () => {
  if (searchInput) searchInput.value = ""; // on vide la recherche
  fetchStations(); // on recharge toutes les stations (sans filtre)
  showHome(); // on revient sur la page d'accueil
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===============================
//  Bouton "Voir les stations" (page d'accueil)
// ===============================
// Permet de passer de la page d'accueil à la page liste.
goStationsBtn.addEventListener("click", () => {
  showStations();
  if (!allStations.length) {
    // Si on n'a pas encore de données, on va les chercher
    fetchStations();
  } else {
    // Sinon, on affiche simplement la page 1
    currentPage = 1;
    renderPage();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===============================
//  Barre de recherche (station / INSEE)
// ===============================
// Deux façons de lancer la recherche :
// - clic sur le bouton "Rechercher"
// - appui sur la touche Entrée dans le champ
searchButton.addEventListener("click", () => {
  const text = searchInput.value.trim().toLowerCase();
  currentFilter = text;        // on stocke le texte tapé
  showStations();              // on s'assure d'être sur la page liste
  currentPage = 1;             // on repart à la page 1
  renderPage();                // on affiche les résultats filtrés
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const text = searchInput.value.trim().toLowerCase();
    currentFilter = text;
    showStations();
    currentPage = 1;
    renderPage();
  }
});

// ===============================
//  Formatage de la date/heure
// ===============================
// L'API renvoie une date au format ISO (2025-12-08T09:08:08+00:00).
// On la transforme en chaine plus lisible : "2025-12-08 à 09:08:08".
function formatDateTime(raw) {
  if (!raw) return "Non renseignée";
  const parts = raw.split("T");
  if (parts.length < 2) return raw;

  const date = parts[0];
  let time = parts[1];

  // On retire le fuseau horaire (+00:00) ou le Z final.
  time = time.split("+")[0];
  time = time.split("Z")[0];

  return `${date} à ${time}`;
}

// ===============================
//  Récupération des stations (fetch)
// ===============================
// Cette fonction récupère TOUTES les stations depuis l'API, sans filtre.
// Le filtrage par nom / INSEE se fait ensuite en JavaScript dans renderPage.
async function fetchStations() {
  resultsDiv.innerHTML = "";
  hideError();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      // Si l'API répond avec une erreur HTTP (404, 500...), on lève une erreur.
      throw new Error("Problème API");
    }

    const data = await response.json();
    const items = data.records || [];

    // On stocke toutes les stations dans notre variable globale.
    allStations = items;
    currentPage = 1;
    currentFilter = ""; // par défaut, aucun filtre

    updateStats(); // Mise à jour des stats de la page d'accueil
    renderPage();  // Affichage de la première page de résultats
  } catch (error) {
    console.error(error);
    showError("Erreur lors du chargement des données. Réessaie plus tard.");
  }
}

// ===============================
//  Mise à jour des statistiques (page d'accueil)
// ===============================
// On calcule :
// - le nombre total de stations
// - le total de vélos disponibles
// - le total de places libres
function updateStats() {
  if (!statTotalStations || !statTotalBikes || !statTotalDocks) return;

  const totalStations = allStations.length;
  let totalBikes = 0;
  let totalDocks = 0;

  for (let i = 0; i < allStations.length; i++) {
    const station = allStations[i].fields || {};
    const bikes = Number(station.numbikesavailable || 0);
    const docks = Number(station.numdocksavailable || 0);
    totalBikes += bikes;
    totalDocks += docks;
  }

  statTotalStations.textContent = totalStations || "--";
  statTotalBikes.textContent = totalBikes || "--";
  statTotalDocks.textContent = totalDocks || "--";
}

// ===============================
//  Affichage d'une page de résultats
// ===============================
// 1) On filtre les stations en fonction de currentFilter.
// 2) On applique la pagination (20 par page).
// 3) On crée dynamiquement les cartes de stations.
// 4) On affiche la pagination.
function renderPage() {
  resultsDiv.innerHTML = "";

  // 1. Construire un tableau filtré en fonction du texte recherché
  const filteredStations = [];

  for (let i = 0; i < allStations.length; i++) {
    const record = allStations[i];
    const station = record.fields || {};

    const nom = station.name || "";
    const arrondissementTexte =
      station.code_insee_commune ||
      station.nom_arrondissement_communes ||
      "";
    const insee = station.code_insee_commune || "";

    // On passe tout en minuscule pour une recherche insensible à la casse.
    const nomMin = nom.toLowerCase();
    const arrMin = String(arrondissementTexte).toLowerCase();
    const inseeMin = String(insee).toLowerCase();

    if (!currentFilter) {
      // Si aucun filtre saisi, on garde toutes les stations.
      filteredStations.push(record);
    } else {
      // Sinon, on vérifie si le filtre est inclus dans le nom ou le code INSEE.
      if (
        nomMin.includes(currentFilter) ||
        arrMin.includes(currentFilter) ||
        inseeMin.includes(currentFilter)
      ) {
        filteredStations.push(record);
      }
    }
  }

  // 2. Pagination : on prend seulement les éléments de la page actuelle
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const pageItems = filteredStations.slice(start, end);

  // Si aucun résultat après filtrage
  if (pageItems.length === 0) {
    resultsDiv.innerHTML = "<p>Aucun résultat trouvé.</p>";
    return;
  }

  // 3. Création et affichage des cartes pour chaque station
  for (let i = 0; i < pageItems.length; i++) {
    const station = pageItems[i].fields || {};

    const nom = station.name || "Nom de station inconnu";
    const arrondissement =
      station.code_insee_commune ||
      station.nom_arrondissement_communes ||
      "Arrondissement inconnu";
    const code = station.stationcode || "—";
    const velos = station.numbikesavailable ?? "—";
    const places = station.numdocksavailable ?? "—";
    const capacite = station.capacity ?? "—";
    const maj = formatDateTime(
      station.duedate || station.last_reported || station.datemiseajour
    );

    // On crée un élément <article> pour chaque station
    const card = document.createElement("article");
    card.className = "card";

    // On injecte le contenu HTML de la carte
    card.innerHTML = `
      <h2 class="card-title">${nom}</h2>
      <p class="card-meta"><strong>Code INSEE :</strong> ${arrondissement}</p>
      <p class="card-meta"><strong>Code station :</strong> ${code}</p>
      <p class="card-meta"><strong>Vélos disponibles :</strong> ${velos}</p>
      <p class="card-meta"><strong>Places libres :</strong> ${places}</p>
      <p class="card-meta"><strong>Capacité :</strong> ${capacite}</p>
      <p class="card-meta"><strong>Dernière mise à jour :</strong> ${maj}</p>
    `;

    resultsDiv.appendChild(card);
  }

  // 4. Affiche la pagination en fonction du nombre de résultats filtrés
  renderPagination(filteredStations.length);
}

// ===============================
//  Pagination (1, 2, 3, ...)
// ===============================
// Cette fonction crée les boutons de pagination en bas de la liste.
function renderPagination(filteredCount) {
  const totalPages = Math.ceil(filteredCount / pageSize);
  if (totalPages <= 1) return; // pas de pagination si une seule page

  const paginationDiv = document.createElement("div");
  paginationDiv.className = "pagination";

  for (let p = 1; p <= totalPages; p++) {
    const btn = document.createElement("button");
    btn.textContent = p;

    // On ajoute une classe spéciale pour la page active
    btn.className = p === currentPage ? "active-page" : "";

    // Quand on clique sur un numéro de page
    btn.addEventListener("click", () => {
      currentPage = p;  // on change la page actuelle
      renderPage();     // on ré-affiche les stations pour cette page

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });

    paginationDiv.appendChild(btn);
  }

  resultsDiv.appendChild(paginationDiv);
}

// ===============================
//  Gestion des messages d'erreur
// ===============================
function showError(message) {
  errorDiv.hidden = false;
  errorDiv.textContent = message;
}

function hideError() {
  errorDiv.hidden = true;
  errorDiv.textContent = "";
}

// ===============================
//  Chargement initial de l'application
// ===============================
// Au démarrage :
// - on récupère les données Vélib'
// - on affiche la page d'accueil (dashboard)
fetchStations();
showHome();