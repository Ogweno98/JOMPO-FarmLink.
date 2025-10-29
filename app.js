// app.js - single file for Firebase + Marketplace + Services + AI + Weather + Auth
// Note: Make sure firebase CDN (compat) scripts are included in each HTML before this file.

// -------------------- CONFIG --------------------
const firebaseConfig = {
  apiKey: "AIzaSyCK2sZb2_O0K8tq0KWKwmSV8z4He30dcDc",
  authDomain: "jompo-farmlink-web.firebaseapp.com",
  projectId: "jompo-farmlink-web",
  storageBucket: "jompo-farmlink-web.appspot.com",
  messagingSenderId: "497296091103",
  appId: "1:497296091103:web:72b3e8223ea0cbb306066a"
};

// OpenWeather: replace with your real key
const OPENWEATHER_API_KEY = "YOUR_OPENWEATHER_API_KEY";

// AI cloud function endpoint (optional). Replace with your function URL if you have one.
const AI_CLOUD_FUNCTION_URL = "https://us-central1-jompo-farmlink-web.cloudfunctions.net/askAI"; // keep or replace

// -------------------- INIT --------------------
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// -------------------- NAVBAR AUTH LINKS (dynamic) --------------------
function updateAuthLinks(user) {
  const authLinks = document.getElementById("authLinks");
  if (!authLinks) return;
  if (user) {
    const email = user.email || "User";
    authLinks.innerHTML = `
      <span class="mr-4 text-white">Hi, ${email}</span>
      <a href="dashboard.html" class="mr-2 px-4 py-2 bg-white text-green-800 rounded">Dashboard</a>
      <button id="logoutBtn" class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Logout</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", ()=> auth.signOut());
  } else {
    authLinks.innerHTML = `
      <a href="login.html" class="mr-2 px-4 py-2 bg-transparent border border-white text-white rounded">Login</a>
      <a href="register.html" class="px-4 py-2 bg-white text-green-800 rounded">Register</a>
    `;
  }
}
auth.onAuthStateChanged(user => {
  updateAuthLinks(user);
});

// -------------------- REGISTER --------------------
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (document.getElementById("name") || {}).value || "";
    const email = (document.getElementById("email") || {}).value || "";
    const password = (document.getElementById("password") || {}).value || "";
    const location = (document.getElementById("location") || {}).value || "";
    const role = (document.getElementById("role") || {}).value || "";

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      await db.collection("users").doc(user.uid).set({
        name, email, location, role, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await user.sendEmailVerification();
      alert("Registration successful. Please verify your email before logging in.");
      registerForm.reset();
      window.location.href = "login.html";
    } catch (err) {
      alert(err.message);
    }
  });
}

// -------------------- LOGIN --------------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("loginEmail") || {}).value || "";
    const password = (document.getElementById("loginPassword") || {}).value || "";
    const loginError = document.getElementById("loginError");

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        if (loginError) {
          loginError.textContent = "Please verify your email before logging in.";
          loginError.classList.remove("hidden");
        } else {
          alert("Please verify your email before logging in.");
        }
        return;
      }
      window.location.href = "dashboard.html";
    } catch (err) {
      if (loginError) {
        loginError.textContent = err.message;
        loginError.classList.remove("hidden");
      } else {
        alert(err.message);
      }
    }
  });

  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = (document.getElementById("loginEmail") || {}).value || "";
      const loginError = document.getElementById("loginError");
      if (!email) {
        if (loginError) {
          loginError.textContent = "Enter your email above first.";
          loginError.classList.remove("hidden");
        }
        return;
      }
      try {
        await auth.sendPasswordResetEmail(email);
        if (loginError) {
          loginError.textContent = "Password reset email sent. Check your inbox.";
          loginError.classList.remove("hidden");
          loginError.classList.add("text-green-600");
        }
      } catch (err) {
        if (loginError) {
          loginError.textContent = err.message;
          loginError.classList.remove("hidden");
        }
      }
    });
  }
}

// -------------------- ADD LISTING (product or service) --------------------
const addListingForm = document.getElementById("addListingForm");
if (addListingForm) {
  addListingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (document.getElementById("productName") || {}).value || "";
    const category = (document.getElementById("category") || {}).value || "product";
    const quantity = (document.getElementById("quantity") || {}).value || null;
    const price = (document.getElementById("price") || {}).value || 0;
    const location = (document.getElementById("locationListing") || {}).value || "";
    const user = auth.currentUser;
    if (!user) return alert("Please log in to add a listing.");

    const data = {
      name, category, quantity: quantity || null, price: Number(price), location,
      farmerID: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (category === "service") {
        await db.collection("services").add(data);
      } else {
        await db.collection("listings").add(data);
      }
      alert("Listing added!");
      addListingForm.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

// -------------------- DASHBOARD: show user's items --------------------
const listingsContainer = document.getElementById("listingsContainer");
if (listingsContainer) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) return window.location.href = "login.html";
    // load user's listings + services
    const loadUserContent = async () => {
      listingsContainer.innerHTML = "";
      const products = await db.collection("listings").where("farmerID", "==", user.uid).get();
      products.forEach(doc => {
        const d = doc.data();
        listingsContainer.innerHTML += `
          <div class="bg-white p-4 rounded shadow">
            <h3 class="font-bold text-green-800">${d.name}</h3>
            <p>Category: ${d.category}</p>
            <p>Quantity: ${d.quantity || '-'}</p>
            <p>Price: KSh ${d.price}</p>
            <p>Location: ${d.location}</p>
          </div>
        `;
      });
      const services = await db.collection("services").where("farmerID", "==", user.uid).get();
      services.forEach(doc => {
        const d = doc.data();
        listingsContainer.innerHTML += `
          <div class="bg-white p-4 rounded shadow">
            <h3 class="font-bold text-green-800">${d.name}</h3>
            <p>Category: ${d.category}</p>
            <p>Price: KSh ${d.price}</p>
            <p>Location: ${d.location}</p>
          </div>
        `;
      });
    };
    loadUserContent();
  });
}

// -------------------- MARKETPLACE --------------------
async function loadMarketplaceOnceAndWireFilters() {
  const container = document.getElementById("marketplaceContainer");
  if (!container) return;
  const searchInput = document.getElementById("searchInput");
  const filterLocation = document.getElementById("filterLocation");
  const filterCategory = document.getElementById("filterCategory");
  const noResults = document.getElementById("noResults");

  async function fetchAll() {
    const snapshot = await db.collection("listings").get();
    return snapshot.docs;
  }

  async function render(docs) {
    container.innerHTML = "";
    if (!docs.length) {
      if (noResults) noResults.classList.remove("hidden");
      return;
    }
    if (noResults) noResults.classList.add("hidden");

    docs.forEach(doc => {
      const data = doc.data();
      container.innerHTML += `
        <div class="bg-white p-4 rounded shadow hover:shadow-lg transition">
          <h3 class="font-bold text-green-800">${data.name}</h3>
          <p>Category: ${data.category}</p>
          ${data.quantity ? `<p>Quantity: ${data.quantity}</p>` : ''}
          <p>Price: KSh ${data.price}</p>
          <p>Location: ${data.location}</p>
        </div>
      `;
    });
  }

  let docs = await fetchAll();

  // populate categories
  if (filterCategory) {
    const cats = [...new Set(docs.map(d => d.data().category).filter(Boolean))];
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
      filterCategory.appendChild(opt);
    });
  }

  render(docs);

  function applyFilters() {
    let filtered = docs;
    const s = (searchInput?.value || "").toLowerCase();
    const loc = (filterLocation?.value || "").toLowerCase();
    const cat = (filterCategory?.value || "");

    filtered = filtered.filter(d => {
      const data = d.data();
      const matchesSearch = !s || (data.name || "").toLowerCase().includes(s);
      const matchesLoc = !loc || (data.location || "").toLowerCase().includes(loc);
      const matchesCat = !cat || data.category === cat;
      return matchesSearch && matchesLoc && matchesCat;
    });
    render(filtered);
  }

  [searchInput, filterLocation, filterCategory].forEach(el => {
    if (el) el.addEventListener("input", applyFilters);
    if (el) el.addEventListener("change", applyFilters);
  });
}
document.addEventListener("DOMContentLoaded", loadMarketplaceOnceAndWireFilters);

// -------------------- SERVICES PAGE --------------------
async function loadServicesPage() {
  const container = document.getElementById("servicesContainer");
  if (!container) return;
  const searchService = document.getElementById("searchService");
  const filterServiceLocation = document.getElementById("filterServiceLocation");
  const categorySelect = document.getElementById("filterServiceCategory") || document.getElementById("filterServiceCategory") || document.getElementById("filterServiceCategory") || document.getElementById("filterServiceCategory");

  const snapshot = await db.collection("services").get();
  let services = snapshot.docs;

  // populate categories (if present)
  const catEl = document.getElementById("filterServiceCategory") || document.getElementById("filterServiceCategory");
  if (catEl) {
    const cats = [...new Set(services.map(d => d.data().category).filter(Boolean))];
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      catEl.appendChild(opt);
    });
  }

  function render(list) {
    container.innerHTML = "";
    if (!list.length) {
      const no = document.getElementById("noServices");
      if (no) no.classList.remove("hidden");
      return;
    }
    const no = document.getElementById("noServices");
    if (no) no.classList.add("hidden");
    list.forEach(doc => {
      const d = doc.data();
      container.innerHTML += `
        <div class="bg-white p-4 rounded shadow hover:shadow-lg transition">
          <h3 class="font-bold text-green-800">${d.name}</h3>
          <p>Category: ${d.category}</p>
          <p>Price: KSh ${d.price}</p>
          <p>Location: ${d.location}</p>
          <p class="text-sm mt-2">${d.description || ""}</p>
          <button class="mt-4 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800">Book Now</button>
        </div>
      `;
    });
  }

  render(services);

  function applyFilters() {
    let out = services;
    const s = (searchService?.value || "").toLowerCase();
    const loc = (filterServiceLocation?.value || "").toLowerCase();
    const cat = (catEl?.value || "");
    out = out.filter(d => {
      const data = d.data();
      const matchS = !s || (data.name || "").toLowerCase().includes(s);
      const matchL = !loc || (data.location || "").toLowerCase().includes(loc);
      const matchC = !cat || data.category === cat;
      return matchS && matchL && matchC;
    });
    render(out);
  }

  [searchService, filterServiceLocation, catEl].forEach(el => {
    if (el) el.addEventListener("input", applyFilters);
    if (el) el.addEventListener("change", applyFilters);
  });
}
document.addEventListener("DOMContentLoaded", loadServicesPage);

// -------------------- AI Assistant (ai.html) --------------------
const aiAskBtn = document.getElementById("askAI");
if (aiAskBtn) {
  aiAskBtn.addEventListener("click", async () => {
    const qEl = document.getElementById("userInput");
    const q = (qEl.value || "").trim();
    if (!q) return alert("Please ask a question.");
    const respText = document.getElementById("responseText");
    respText.textContent = "Thinking...";

    try {
      // try cloud function if provided
      let reply = "";
      if (AI_CLOUD_FUNCTION_URL && AI_CLOUD_FUNCTION_URL.includes("http")) {
        const r = await fetch(AI_CLOUD_FUNCTION_URL, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ query: q })
        });
        const json = await r.json();
        reply = json.reply || json.result || JSON.stringify(json);
      } else {
        // fallback: simple local logic
        reply = simpleAIFallback(q);
      }
      respText.textContent = reply;
      document.getElementById("aiResponse").classList.remove("hidden");
    } catch (err) {
      respText.textContent = "AI error: " + err.message;
    }
  });
}

function simpleAIFallback(q) {
  // tiny helpful heuristics as fallback
  const text = q.toLowerCase();
  if (text.includes("maize") || text.includes("corn")) {
    return "For maize: rotate crops, use certified seed, plant at correct spacing, scout weekly for fall armyworm and use neem or biopesticides when small infestations are present. Consider intercropping with legumes.";
  }
  if (text.includes("soil") || text.includes("fertility")) {
    return "Soil tips: do a soil test, add organic compost, use phosphate rock where needed, apply lime if pH < 5.5. Adopt contour bunding to reduce erosion.";
  }
  if (text.includes("irrigat") || text.includes("water")) {
    return "Water tips: prefer drip irrigation for water efficiency; schedule irrigation using crop stage; harvest rainwater and consider solar pump solutions.";
  }
  return "I don't have a specific answer yet — try asking about pests, soil, irrigation, harvest timing or market pricing.";
}

// -------------------- WEATHER (weather.html) --------------------
async function loadWeatherPage() {
  const wContainer = document.getElementById("weatherContainer");
  if (!wContainer) return;

  const cityInput = document.getElementById("weatherLocation");
  const btn = document.getElementById("weatherGet");

  async function fetchForCity(city) {
    try {
      const q = encodeURIComponent(city);
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${q}&appid=${OPENWEATHER_API_KEY}&units=metric`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Weather fetch failed");
      const data = await r.json();
      renderWeather(data);
    } catch (err) {
      wContainer.innerHTML = `<div class="text-red-600">Weather error: ${err.message}</div>`;
    }
  }

  function renderWeather(data) {
    wContainer.innerHTML = "";
    // show location & simple 3-day summary
    const city = data.city?.name || "Unknown";
    const list = data.list || [];
    // group by day
    const groups = {};
    list.forEach(i => {
      const day = i.dt_txt.split(" ")[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(i);
    });
    const days = Object.keys(groups).slice(0, 3);
    let html = `<h3 class="text-xl font-bold mb-3">Weather forecast: ${city}</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-4">`;
    days.forEach(day => {
      const samples = groups[day];
      // pick midday sample if exists
      const midday = samples.find(s => s.dt_txt.includes("12:00:00")) || samples[Math.floor(samples.length/2)];
      const t = midday.main.temp;
      const desc = midday.weather[0].description;
      html += `
        <div class="bg-white p-4 rounded shadow">
          <h4 class="font-bold">${day}</h4>
          <p class="mt-2">Temp: ${t} °C</p>
          <p>${desc}</p>
        </div>
      `;
    });
    html += `</div>`;
    wContainer.innerHTML = html;
  }

  btn?.addEventListener("click", ()=> {
    const c = (cityInput.value || "Nairobi").trim();
    fetchForCity(c);
  });

  // initial load for Nairobi
  fetchForCity("Nairobi");
}
document.addEventListener("DOMContentLoaded", loadWeatherPage);

// -------------------- CONTACT FORM --------------------
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", async (e)=> {
    e.preventDefault();
    const name = (document.getElementById("contactName") || {}).value || "";
    const email = (document.getElementById("contactEmail") || {}).value || "";
    const message = (document.getElementById("contactMessage") || {}).value || "";
    try {
      await db.collection("contacts").add({
        name, email, message, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Message sent. We'll get back to you.");
      contactForm.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

// -------------------- COMMUNITY (basic post create/display) --------------------
const communityForm = document.getElementById("postForm");
if (communityForm) {
  communityForm.addEventListener("submit", async (e)=> {
    e.preventDefault();
    const title = (document.getElementById("postTitle") || {}).value || "";
    const body = (document.getElementById("postBody") || {}).value || "";
    const user = auth.currentUser;
    if (!user) return alert("Login to post.");
    try {
      await db.collection("posts").add({
        title, body, author: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Post created.");
      communityForm.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function loadCommunityPage() {
  const container = document.getElementById("postsContainer");
  if (!container) return;
  const snapshot = await db.collection("posts").orderBy("createdAt","desc").get();
  container.innerHTML = "";
  snapshot.forEach(doc => {
    const d = doc.data();
    container.innerHTML += `
      <div class="bg-white p-4 rounded shadow mb-4">
        <h3 class="font-bold text-green-800">${d.title}</h3>
        <p class="text-sm text-gray-700">${d.body}</p>
      </div>
    `;
  });
}
document.addEventListener("DOMContentLoaded", loadCommunityPage);

// -------------------- END --------------------
console.log("app.js loaded");
