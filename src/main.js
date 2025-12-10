import "./style.css";

// API Vélib temps réel (version v1 plus simple)
// On demande jusqu'à 200 enregistrements
const API_URL =
  "https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&rows=200";

let allStations = [];
let currentPage = 1;
const pageSize = 20;
let currentFilter = ""; // texte tapé dans la recherche (en minuscule)

// On construit le HTML de base dans la page
const app = document.querySelector("#app");

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
        <button id="go-stations" class="primary-button">Voir les stations</button>
      </div>

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

    <!-- PAGE LISTE / RECHERCHE -->
    <section id="stations-view" class="stations-view" style="display: none;">
      <section class="search-section">
        <input
          id="search-input"
          type="search"
          placeholder="Rechercher par nom de station ou code INSEE…"
          aria-label="Rechercher une station"
        />
        <button id="search-button">Rechercher</button>
      </section>

      <section id="error" class="error" hidden></section>

      <section id="results" class="results"></section>
    </section>
  </main>

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

// Récupération des éléments
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

// Affichage des vues
function showHome() {
  homeView.style.display = "block";
  stationsView.style.display = "none";
}

function showStations() {
  homeView.style.display = "none";
  stationsView.style.display = "block";
}

// Bouton Home (en haut à gauche)
homeTopBtn.addEventListener("click", () => {
  if (searchInput) searchInput.value = ""; // on vide la recherche
  fetchStations(); // on recharge toutes les stations (sans filtre)
  showHome(); // on revient sur la page d'accueil
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Bouton "Voir les stations" sur la page d'accueil
goStationsBtn.addEventListener("click", () => {
  showStations();
  if (!allStations.length) {
    fetchStations();
  } else {
    currentPage = 1;
    renderPage();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Événements sur la barre de recherche
searchButton.addEventListener("click", () => {
  const text = searchInput.value.trim().toLowerCase();
  currentFilter = text;
  showStations();
  currentPage = 1;
  renderPage();
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

// Formater la date/heure de mise à jour
function formatDateTime(raw) {
  if (!raw) return "Non renseignée";
  const parts = raw.split("T");
  if (parts.length < 2) return raw;

  const date = parts[0];
  let time = parts[1];

  time = time.split("+")[0];
  time = time.split("Z")[0];

  return `${date} à ${time}`;
}

// Récupérer les stations depuis l'API (TOUTES les données, sans filtre)
async function fetchStations() {
  resultsDiv.innerHTML = "";
  hideError();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Problème API");
    }

    const data = await response.json();
    const items = data.records || [];

    allStations = items;
    currentPage = 1;
    currentFilter = ""; // par défaut, aucun filtre
    updateStats();
    renderPage();
  } catch (error) {
    console.error(error);
    showError("Erreur lors du chargement des données. Réessaie plus tard.");
  }
}

// Met à jour les statistiques sur la page d'accueil
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

// Affiche une page de résultats (20 par page)
function renderPage() {
  resultsDiv.innerHTML = "";

  // 1. On construit un tableau filtré en fonction du texte recherché
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

    const nomMin = nom.toLowerCase();
    const arrMin = String(arrondissementTexte).toLowerCase();
    const inseeMin = String(insee).toLowerCase();

    if (!currentFilter) {
      // pas de filtre : on garde tout
      filteredStations.push(record);
    } else {
      if (
        nomMin.includes(currentFilter) ||
        arrMin.includes(currentFilter) ||
        inseeMin.includes(currentFilter)
      ) {
        filteredStations.push(record);
      }
    }
  }

  // 2. Pagination sur le tableau filtré
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const pageItems = filteredStations.slice(start, end);

  if (pageItems.length === 0) {
    resultsDiv.innerHTML = "<p>Aucun résultat trouvé.</p>";
    return;
  }

  // 3. Affichage des cartes
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

    const card = document.createElement("article");
    card.className = "card";

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

  // 4. Pagination en fonction du nombre de résultats filtrés
  renderPagination(filteredStations.length);
}

// Affiche la pagination (1, 2, 3, ...) en fonction du nombre de résultats filtrés
function renderPagination(filteredCount) {
  const totalPages = Math.ceil(filteredCount / pageSize);
  if (totalPages <= 1) return;

  const paginationDiv = document.createElement("div");
  paginationDiv.className = "pagination";

  for (let p = 1; p <= totalPages; p++) {
    const btn = document.createElement("button");
    btn.textContent = p;
    btn.className = p === currentPage ? "active-page" : "";
    btn.addEventListener("click", () => {
      currentPage = p;
      renderPage();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
    paginationDiv.appendChild(btn);
  }

  resultsDiv.appendChild(paginationDiv);
}

function showError(message) {
  errorDiv.hidden = false;
  errorDiv.textContent = message;
}

function hideError() {
  errorDiv.hidden = true;
  errorDiv.textContent = "";
}

// Chargement initial : on récupère les données
// et on affiche la page d'accueil
fetchStations();
showHome();