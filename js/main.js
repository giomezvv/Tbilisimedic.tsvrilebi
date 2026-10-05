/* ==========================================
   🚀 აპლიკაციის გაშვება და ავტორიზაცია (იტვირთება ბოლოს)
   ========================================== */

function showApp(user, admin) {
    currentUser = user;
    isAdmin = admin;
    setWelcomeMessage(user.email);

    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
    document.getElementById('uploadWrapper').style.display = admin ? 'flex' : 'none';
    document.getElementById('usdControlBox').style.display = admin ? 'flex' : 'none';
    document.getElementById('pipelineFilterAdmin').style.display = 'block'; // ძიება ყველასთვის; არაადმინი მხოლოდ საკუთარ ლიდებში ეძებს
    document.getElementById('taskFilterAdmin').style.display = admin ? 'block' : 'none';
}

function showLogin() {
    if (unsubscribeLeads) { unsubscribeLeads(); unsubscribeLeads = null; }
    if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
    currentUser = null;
    isAdmin = false;
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'none';
}

// საბანკო რეკვიზიტები ინვოისსა და შეთავაზებაზე — ერთი წყაროდან (COMPANY)
function renderBankDetails() {
    document.querySelectorAll('.bank-details').forEach(el => {
        el.innerHTML = `
            <h4>საბანკო რეკვიზიტები</h4>
            <p><strong>ბანკი:</strong> ${escapeHtml(COMPANY.bank)}</p>
            <p><strong>ანგ. #:</strong> ${escapeHtml(COMPANY.iban)}</p>
            <p><strong>ბანკის კოდი:</strong> ${escapeHtml(COMPANY.bankCode)}</p>`;
    });
}

function handleLogin(event) {
    if (event) event.preventDefault();
    if (isLocalMode) {
        showApp({ uid: "demo", email: "demo@example.com" }, true);
        renderPipeline();
        renderBacklog();
        return;
    }
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    errorEl.style.display = 'none';
    if (!email || !password) {
        errorEl.innerText = 'შეიყვანეთ ელ-ფოსტა და პაროლი.';
        errorEl.style.display = 'block';
        return;
    }
    btn.disabled = true;
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => {
            console.warn("Login failed:", err.code);
            // ზოგადი შეტყობინება: არ ვამხელთ, არსებობს თუ არა ანგარიში
            errorEl.innerText = err.code === 'auth/too-many-requests'
                ? 'ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით.'
                : 'არასწორი ელ-ფოსტა ან პაროლი.';
            errorEl.style.display = 'block';
        })
        .finally(() => { btn.disabled = false; });
}

function handleLogout() {
    if (isLocalMode) { location.reload(); return; }
    auth.signOut().then(() => location.reload(), err => console.error("Logout failed:", err));
}

// Escape ხურავს ზედა (ყველაზე მაღალი z-index-ის) ღია ფანჯარას
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = Array.from(document.querySelectorAll('.modal-overlay, .export-modal-overlay'))
        .filter(el => el.id !== 'loginOverlay' && getComputedStyle(el).display !== 'none')
        .sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0) - (parseInt(getComputedStyle(a).zIndex) || 0));
    if (!open.length) return;
    // წაგების მიზეზის ფანჯარა გაუქმებისას ლიდის სტატუსს აბრუნებს — ამიტომ მხოლოდ დამალვა საკმარისი არ არის
    if (open[0].id === 'lostReasonModal') cancelLostReason();
    else open[0].style.display = 'none';
});

renderBankDetails();

if (!isLocalMode) {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();

    // long-polling WebChannel-ის ნაცვლად: tracking prevention / ad blocker-ების მქონე ბრაუზერებში
    // WebChannel იბლოკება და Firestore "client is offline" შეცდომას აბრუნებს.
    // settings() უნდა გამოიძახოს ნებისმიერ სხვა Firestore ოპერაციამდე (enablePersistence-ის ჩათვლით).
    // ⚠️ merge: true არ დაამატოთ: ნაგულისხმევ experimentalAutoDetectLongPolling: true-სთან შერწყმისას SDK შეცდომას
    // აგდებს ("cannot be used together") და აპლიკაცია არ ჩაიტვირთება. კონსოლის გაფრთხილება
    // "You are overriding the original host" ამ გამოძახებით მოსალოდნელია და უვნებელია.
    db.settings({ experimentalForceLongPolling: true });

    // ლოკალური (IndexedDB) cache: მეორედ შესვლისას მონაცემები მყისიერად იტვირთება cache-იდან
    // და ფონზე სინქრონდება მხოლოდ ცვლილებები.
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore offline cache: რამდენიმე ტაბია ღია, cache ერთში ჩაირთვება.');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore offline cache არ არის მხარდაჭერილი ამ ბრაუზერში.');
        }
    });

    auth.onAuthStateChanged(user => {
        if (!user) { showLogin(); return; }
        showApp(user, ADMIN_EMAILS.includes(user.email));
        fetchAppData();
        fetchTarget();
        loadLeadsFromFirebase();
        loadTasksFromFirebase();
    });
} else {
    showApp({ uid: "local_user_1", email: "demo@tbilisimedic.ge" }, true);
    currentUsdRate = parseFloat(localStorage.getItem('stock_usd_rate')) || DEFAULT_USD_RATE;
    document.getElementById('usdRateInput').value = currentUsdRate;
    HISTORY_DATA = loadLocalJSON('stock_sales_history', []);

    fetchTarget();
    renderPipeline();
    renderBacklog();
    updateUsersDatalist();
}
