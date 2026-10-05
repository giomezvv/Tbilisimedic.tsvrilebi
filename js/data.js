/* ==========================================
   ☁️ საერთო მონაცემების ჩატვირთვა (სტოკი, კონტრაგენტები, გეგმა, კურსი)
   ========================================== */
async function fetchAppData() {
    if (isLocalMode) return;
    try {
        // 5 დოკუმენტი პარალელურად იტვირთება
        const appData = db.collection("appData");
        const [stockDoc, clientsDoc, featuresDoc, settingsDoc, historyDoc] = await Promise.all(
            ["stock", "clients", "features", "settings", "salesHistory"].map(id => appData.doc(id).get())
        );

        if (stockDoc.exists) setStockData(stockDoc.data().items || []);

        if (clientsDoc.exists) {
            CLIENTS = clientsDoc.data().items || [];
            renderClientsDatalist();
        }

        if (featuresDoc.exists) AUX_DATA = featuresDoc.data().items || {};

        currentUsdRate = (settingsDoc.exists && settingsDoc.data().usdRate) || DEFAULT_USD_RATE;
        const usdInput = document.getElementById('usdRateInput');
        if (usdInput) usdInput.value = currentUsdRate;

        applyAuxData();

        if (historyDoc.exists) {
            HISTORY_DATA = historyDoc.data().items || [];
            setStatus('historyUploadStatus', `✅ ჩაიტვირთა ${HISTORY_DATA.length} ისტორიული ჩანაწერი.`);
        } else {
            setStatus('historyUploadStatus', `⚠️ ისტორიის ბაზა ცარიელია`, false);
        }

        if (DATA.length > 0) {
            setStatus('uploadStatus', `✅ ჩაიტვირთა ${DATA.length} პოზიცია ბაზიდან.`);
        } else {
            setStatus('uploadStatus', `⚠️ სტოკის ბაზა ცარიელია`, false);
            document.getElementById('productContainer').innerHTML = '<p style="text-align:center; padding:50px; color: var(--text-light);">სტოკის ბაზა ცარიელია, გთხოვთ დაელოდოთ განახლებას.</p>';
        }

        if (CLIENTS.length > 0) setStatus('clientUploadStatus', `✅ ჩაიტვირთა ${CLIENTS.length} კონტრაგენტი ბაზიდან.`);
        if (Object.keys(AUX_DATA).length > 0) setStatus('auxUploadStatus', `✅ მახასიათებლები ჩატვირთულია ბაზიდან.`);
    } catch (err) {
        console.error("Error fetching data: ", err);
        document.getElementById('productContainer').innerHTML = '<p style="text-align:center; padding:50px; color:#ef4444;">მონაცემების ჩატვირთვა ვერ მოხერხდა. შეამოწმეთ ინტერნეტ კავშირი და განაახლეთ გვერდი.</p>';
    }
}

function renderClientsDatalist() {
    const dl = document.getElementById('clientsDatalist');
    if (dl) dl.innerHTML = CLIENTS.map(c => `<option value="${escapeHtml(`${c.name} (ს/კ: ${c.idCode})`)}">`).join('');
}

/* ---------- თვის გეგმა ---------- */
// ძველი ფორმატი: რიცხვი (მხოლოდ გეგმა); ახალი: { target, achieved }
function applyMonthTarget(data) {
    if (typeof data === 'object' && data !== null) {
        monthlyTarget = data.target || 0;
        monthlyAchieved = data.achieved || 0;
    } else {
        monthlyTarget = data || 0;
        monthlyAchieved = 0;
    }
    const targetInput = document.getElementById('monthlyTargetInput');
    if (targetInput) {
        targetInput.value = monthlyTarget || '';
        document.getElementById('monthlyAchievedInput').value = monthlyAchieved || '';
    }
    updateProgressBar();
}

async function fetchTarget() {
    const currentMonth = localISOMonth();
    if (isLocalMode) {
        applyMonthTarget(loadLocalJSON('stock_targets', {})[currentMonth]);
        return;
    }
    try {
        const doc = await db.collection("appData").doc("targets").get();
        applyMonthTarget(doc.exists ? doc.data()[currentMonth] : 0);
    } catch (err) {
        console.error("Error fetching target:", err);
    }
}

function saveTarget() {
    const tVal = parseFloat(document.getElementById('monthlyTargetInput').value) || 0;
    const aVal = parseFloat(document.getElementById('monthlyAchievedInput').value) || 0;
    const currentMonth = localISOMonth();
    monthlyTarget = tVal;
    monthlyAchieved = aVal;

    const dataObj = { target: tVal, achieved: aVal };

    if (isLocalMode) {
        const localData = loadLocalJSON('stock_targets', {});
        localData[currentMonth] = dataObj;
        localStorage.setItem('stock_targets', JSON.stringify(localData));
        updateProgressBar();
        alert("თვის გეგმა და ფაქტი შენახულია ლოკალურად!");
    } else {
        db.collection("appData").doc("targets").set({
            [currentMonth]: dataObj
        }, { merge: true }).then(() => {
            updateProgressBar();
            alert("თვის გეგმა და ფაქტი წარმატებით განახლდა ბაზაში!");
        }).catch(reportSaveError);
    }
}

function updateProgressBar() {
    const bar = document.getElementById('progressBar');
    const text = document.getElementById('targetText');
    if (monthlyTarget === 0) {
        text.innerText = "მიმდინარე თვის გეგმა არ არის მითითებული";
        bar.style.width = '0%';
        bar.className = 'progress-bar';
        return;
    }

    const percent = (monthlyAchieved / monthlyTarget) * 100;
    const fmt = n => n.toLocaleString('ka-GE', {maximumFractionDigits: 0});

    let barClass = "progress-bar ";
    if (percent < 50) barClass += "prog-red";
    else if (percent < 80) barClass += "prog-yellow";
    else barClass += "prog-green";

    text.innerText = `მიმდინარე თვის გეგმა: ${fmt(monthlyAchieved)} ₾ / ${fmt(monthlyTarget)} ₾ (${Math.round(percent)}%)`;
    bar.style.width = Math.min(percent, 100) + '%';
    bar.className = barClass;
}

/* ---------- USD კურსი ---------- */
function updateUsdRate(val) {
    const rate = parseFloat(val);
    // 0 ან უარყოფითი კურსი დოლარის ფასებს Infinity-ად აქცევდა
    currentUsdRate = rate > 0 ? rate : DEFAULT_USD_RATE;
    renderCalc();

    if (!isLocalMode && isAdmin) {
        db.collection("appData").doc("settings").set({ usdRate: currentUsdRate }, { merge: true })
          .catch(err => console.error("Error saving USD rate:", err));
    } else if (isLocalMode) {
        localStorage.setItem('stock_usd_rate', currentUsdRate);
    }
}

function updateUsersDatalist() {
    const users = new Set(ADMIN_EMAILS);
    if (currentUser) users.add(currentUser.email);
    leadsData.forEach(l => { if (l.userEmail) users.add(l.userEmail); });
    tasksData.forEach(t => { if (t.userEmail) users.add(t.userEmail); });
    const dl = document.getElementById('usersDatalist');
    if (dl) dl.innerHTML = Array.from(users).map(e => `<option value="${escapeHtml(e)}">`).join('');
}
