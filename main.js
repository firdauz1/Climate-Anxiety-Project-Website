const fadeElements = document.querySelectorAll(".fade-in");

const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  },
  { threshold: 0.15 }
);

fadeElements.forEach((el) => fadeObserver.observe(el));

const impactCards = document.querySelectorAll(".impact-animate");

const impactObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add("visible");
        }, index * 160);
      }
    });
  },
  { threshold: 0.2 }
);

impactCards.forEach((card) => impactObserver.observe(card));

const footprintMap = L.map("footprintMap").setView([39.5, -98.35], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors"
}).addTo(footprintMap);

const footprintLayer = L.layerGroup().addTo(footprintMap);

const serviceUrl =
  "https://services6.arcgis.com/XuuS3ECSkwKdrSQz/arcgis/rest/services/US_Data_Center_FracTracker_Database_published___Oct2025/FeatureServer/0/query";

const queryUrl =
  serviceUrl +
  "?where=1%3D1" +
  "&outFields=*" +
  "&returnGeometry=true" +
  "&resultRecordCount=2000" +
  "&f=geojson";

let allDataCenters = [];
let activeStatus = "all";

function getStatusColor(status) {
  if (!status) return "#bbb";

  const cleanStatus = String(status).toLowerCase().trim();

  if (cleanStatus.includes("operating")) return "#2a9d8f";
  if (cleanStatus.includes("proposed")) return "#e76f51";
  if (cleanStatus.includes("approved") || cleanStatus.includes("permitted")) return "#f6d365";
  if (cleanStatus.includes("suspended")) return "#9b5de5";
  if (cleanStatus.includes("cancelled") || cleanStatus.includes("canceled")) return "#777";
  if (cleanStatus.includes("unknown")) return "#bbb";

  return "#bbb";
}

function statusMatches(status) {
  if (activeStatus === "all") return true;
  if (!status) return activeStatus === "Unknown";

  return String(status).toLowerCase().includes(activeStatus.toLowerCase());
}

function getValue(props, possibleNames) {
  for (const name of possibleNames) {
    if (props[name] !== undefined && props[name] !== null && props[name] !== "") {
      return props[name];
    }
  }

  return "Unknown";
}

function makeFootprintPopup(props) {
  const name = getValue(props, ["Name", "name"]);
  const city = getValue(props, ["City", "city"]);
  const state = getValue(props, ["State", "state"]);
  const operator = getValue(props, ["Operator", "operator"]);
  const status = getValue(props, ["Status", "status"]);
  const statusDetail = getValue(props, ["Status_detail", "status_detail"]);
  const mw = getValue(props, ["MW", "mw"]);
  const powerSource = getValue(props, ["Power_source", "power_source"]);
  const communityPushback = getValue(props, ["Community_push_back", "community_push_back"]);

  return `
    <strong>${name}</strong><br>
    ${city}, ${state}<br><br>

    <strong>Operator:</strong> ${operator}<br>
    <strong>Status:</strong> ${status}<br>
    <strong>Status detail:</strong> ${statusDetail}<br><br>

    <strong>Power demand:</strong> ${mw} MW<br>
    <strong>Power source:</strong> ${powerSource}<br>
    <strong>Community pushback:</strong> ${communityPushback}
  `;
}

function renderFootprintMap() {
  footprintLayer.clearLayers();

  allDataCenters.forEach((feature) => {
    const props = feature.properties || {};
    const status = getValue(props, ["Status", "status"]);

    if (!statusMatches(status)) return;
    if (!feature.geometry || !feature.geometry.coordinates) return;

    const [lon, lat] = feature.geometry.coordinates;

    const marker = L.circleMarker([lat, lon], {
      radius: 8,
      color: "#f4f1e8",
      fillColor: getStatusColor(status),
      fillOpacity: 0.85,
      weight: 1.5
    }).addTo(footprintLayer);

    marker.bindPopup(makeFootprintPopup(props));

    marker.on("mouseover", function () {
      this.setStyle({
        radius: 12,
        fillOpacity: 1
      });
    });

    marker.on("mouseout", function () {
      this.setStyle({
        radius: 8,
        fillOpacity: 0.85
      });
    });
  });
}

fetch(queryUrl)
  .then((response) => response.json())
  .then((geojson) => {
    allDataCenters = geojson.features || [];
    renderFootprintMap();
    setTimeout(() => footprintMap.invalidateSize(), 300);
  })
  .catch((error) => console.error("Error loading FracTracker data:", error));

document.querySelectorAll("#statusFilters .filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#statusFilters .filter-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    activeStatus = button.dataset.status;
    renderFootprintMap();
  });
});

const communityMap = L.map("communityMap").setView([39.5, -98.35], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors"
}).addTo(communityMap);

const communityLayer = L.layerGroup().addTo(communityMap);

let communityRows = [];
let activeIssue = "all";

function getPrimaryEmotion(emotionString) {
  if (!emotionString) return "Concern";
  return emotionString.split(";")[0].trim();
}

function getEmotionIcon(emotionString) {
  const primary = getPrimaryEmotion(emotionString);

  if (primary === "Anxiety") return "⚠️";
  if (primary === "Concern") return "❓";
  if (primary === "Distrust") return "👁️";
  if (primary === "Anger") return "🔥";
  if (primary === "Agency") return "✊";

  return "❓";
}

function formatTags(tagString) {
  if (!tagString) return "Unknown";
  return tagString
    .split(";")
    .map((tag) => tag.trim())
    .join(" • ");
}

function issueMatches(issueType) {
  if (activeIssue === "all") return true;
  if (!issueType) return false;

  return issueType
    .split(";")
    .map((issue) => issue.trim().toLowerCase())
    .includes(activeIssue.toLowerCase());
}

function makeCommunityPopup(row) {
  return `
    <strong>${row.place}, ${row.state}</strong><br>
    <em>${row.project}</em><br><br>

    <strong>Issue Types:</strong><br>
    ${formatTags(row.issue_type)}<br><br>

    <strong>Emotions:</strong><br>
    ${formatTags(row.emotion)}<br><br>

    <strong>Community Response:</strong><br>
    ${row.community_response}<br><br>

    <strong>Outcome:</strong><br>
    ${row.outcome}<br><br>

    <strong>Source:</strong> ${row.source_name}<br>
    <a href="${row.source_url}" target="_blank" rel="noopener noreferrer">
      Read more
    </a>
  `;
}

function renderCommunityMap() {
  communityLayer.clearLayers();

  communityRows.forEach((row) => {
    if (!issueMatches(row.issue_type)) return;

    const lat = Number(row.lat);
    const lon = Number(row.lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    const iconHTML = `
      <div class="emotion-marker">
        ${getEmotionIcon(row.emotion)}
      </div>
    `;

    const emotionIcon = L.divIcon({
      html: iconHTML,
      className: "",
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -22]
    });

    const marker = L.marker([lat, lon], { icon: emotionIcon }).addTo(communityLayer);
    marker.bindPopup(makeCommunityPopup(row));
  });

  const bounds = communityLayer.getBounds();

  if (bounds.isValid()) {
    communityMap.fitBounds(bounds, {
      padding: [50, 50]
    });
  }
}

Papa.parse("data/community_responses_utf8_plain.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (results) {
    communityRows = results.data;
    renderCommunityMap();
    setTimeout(() => communityMap.invalidateSize(), 300);
  },
  error: function (error) {
    console.error("Error loading community response CSV:", error);
  }
});

document.querySelectorAll("#issueFilters .filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#issueFilters .filter-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    activeIssue = button.dataset.issue;
    renderCommunityMap();
  });
});