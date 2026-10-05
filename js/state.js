/* ==========================================
   🗂 აპლიკაციის გლობალური მდგომარეობა
   ========================================== */
let isLocalMode = firebaseConfig.apiKey === "YOUR_API_KEY";
let db, auth, storage, currentUser = null;
let isAdmin = false;
let unsubscribeLeads = null;
let unsubscribeTasks = null;

// დაზიანებულმა localStorage-მა აპლიკაციის ჩატვირთვა არ უნდა შეაჩეროს
function loadLocalJSON(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (err) {
        console.warn(`localStorage-ის "${key}" ჩანაწერი დაზიანებულია, გამოიყენება ცარიელი მნიშვნელობა.`);
        return fallback;
    }
}
let localLeads = loadLocalJSON('stock_pipeline_leads', []);
let localTasks = loadLocalJSON('stock_pipeline_tasks', []);

let DATA = [];
let PRODUCT_INDEX = new Map(); // code → product, სწრაფი ძიებისთვის
let CLIENTS = [];
let calcItems = [];
let orderItems = [];
let HISTORY_DATA = [];
let AUX_DATA = {};
let currentUsdRate = DEFAULT_USD_RATE;
let monthlyTarget = 0;
let monthlyAchieved = 0;
let tasksData = [];
