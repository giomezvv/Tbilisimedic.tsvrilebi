/* ==========================================
   📦 სტოკი: Excel ატვირთვა, პროდუქციის ბადე, ექსპორტი
   ========================================== */
const FAMILY_CLASSES = { "ენდოსკოპია": "f-endo", "ექოსკოპია": "f-echo", "ლაპარასკოპია": "f-lap", "ოფთალმოლოგია": "f-opht", "სხვა": "f-other", "-": "f-other" };
const FAMILY_COLORS = {
    "ენდოსკოპია": { dot: "#1D9E75", bg: "#E1F5EE" },
    "ექოსკოპია": { dot: "#378ADD", bg: "#E6F1FB" },
    "ლაპარასკოპია": { dot: "#BA7517", bg: "#FAEEDA" },
    "ოფთალმოლოგია": { dot: "#D4537E", bg: "#FBEAF0" },
    "სხვა": { dot: "#5F5E5A", bg: "#F1EFE8" }
};

/* ---------- დამხმარე ---------- */
function setStockData(items) {
    DATA = items;
    PRODUCT_INDEX = new Map(DATA.map(p => [p.code, p]));
}

function findProduct(code) {
    return PRODUCT_INDEX.get(code);
}

function familyOf(p) {
    const f = p.family;
    return (!f || f === '-') ? 'სხვა' : f;
}

function currentMargin() {
    return document.getElementById('marginRange').value / 100;
}

function retailPrice(cost, margin = currentMargin()) {
    return cost === 0 ? 0 : cost / (1 - margin);
}

// მახასიათებლების ძებნა კოდით; Excel-ში კოდი ხან "00123"-ია, ხან 123 — ამიტომ რიცხვითი ვარიანტიც მოწმდება
function lookupAux(code) {
    return AUX_DATA[code] || AUX_DATA[String(parseInt(code, 10))] || null;
}

function productImageUrl(code, ext = 'jpg') {
    return storageUrl(`${code}.${ext}`);
}

/* ---------- Excel ატვირთვები ---------- */
function handleAuxUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    readWorkbookRows(file, {header: "A", defval: ""}, jsonData => {
        AUX_DATA = {};
        let loadedCount = 0;
        const firstA = jsonData.length ? String(jsonData[0]["A"] || "").trim().toLowerCase() : '';
        const startRow = (firstA === "კოდი" || firstA === "code" || firstA === "a") ? 1 : 0;

        for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            const code = String(row["A"] || "").trim();
            if (!code || code === "-") continue;
            AUX_DATA[code] = { features: String(row["B"] || "").trim(), country: String(row["C"] || "").trim(), warranty: String(row["D"] || "").trim() };
            loadedCount++;
        }

        applyAuxData();

        if (isAdmin && !isLocalMode) {
            db.collection("appData").doc("features").set({ items: AUX_DATA })
                .then(() => setStatus('auxUploadStatus', `✅ ${loadedCount} მახასიათებელი განახლდა ბაზაში!`))
                .catch(reportSaveError);
        } else {
            setStatus('auxUploadStatus', `✅ ჩაიტვირთა ${loadedCount} მოდელის მონაცემი.`);
        }
    });
}

function applyAuxData() {
    if (DATA.length === 0) return;
    // AUX_DATA ცარიელიც რომ იყოს, სტოკი მაინც უნდა დაიხატოს
    if (Object.keys(AUX_DATA).length > 0) {
        DATA.forEach(p => {
            const aux = lookupAux(p.code);
            if (aux) { p.features = aux.features; p.country = aux.country; p.warranty = aux.warranty; }
        });
    }
    updateUI(); // updateUI თავად იძახებს renderCalc-ს
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    readWorkbookRows(file, {header: "A", defval: ""}, jsonData => {
        const items = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const code = String(row["B"] || "").trim();
            if (!code || code === "-") continue;
            const vatType = String(row["F"] || "").trim();
            const rawCost = parseFloat(row["M"]) || 0;
            const finalCost = (vatType === "18" || vatType === "18.0") ? rawCost * 1.18 : rawCost;
            items.push({
                code: code,
                name: String(row["D"] || "უცნობი დასახელება").trim(),
                family: String(row["I"] || "-").trim(),
                brand: String(row["K"] || "-").trim(),
                model: "",
                cost: finalCost,
                qty: parseInt(row["Q"]) || 0,
                features: "", country: "", warranty: "",
                enabled: true
            });
        }
        setStockData(items);
        applyAuxData();

        if (isAdmin && !isLocalMode) {
            db.collection("appData").doc("stock").set({ items: DATA })
                .then(() => setStatus('uploadStatus', `✅ სტოკი განახლდა ბაზაში (${DATA.length} პოზიცია).`))
                .catch(reportSaveError);
        } else {
            setStatus('uploadStatus', `✅ ჩაიტვირთა ${DATA.length} პოზიცია.`);
        }
    });
}

function handleClientUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    readWorkbookRows(file, {header: 1}, jsonData => {
        CLIENTS = [];
        for (let i = 1; i < jsonData.length; i++) {
            if (jsonData[i][0]) CLIENTS.push({ name: String(jsonData[i][0]).trim(), idCode: String(jsonData[i][1] || "-").trim() });
        }
        renderClientsDatalist();

        if (isAdmin && !isLocalMode) {
            db.collection("appData").doc("clients").set({ items: CLIENTS })
                .then(() => setStatus('clientUploadStatus', `✅ ${CLIENTS.length} კონტრაგენტი განახლდა ბაზაში!`))
                .catch(reportSaveError);
        } else {
            setStatus('clientUploadStatus', `✅ ჩაიტვირთა ${CLIENTS.length} კონტრაგენტი.`);
        }
    });
}

/* ---------- პროდუქციის ბადე ---------- */
function getQtyClass(q) {
    if (q === 0) return 'qty-zero'; if (q <= 2) return 'qty-low'; if (q <= 10) return 'qty-ok'; return 'qty-high';
}

// ძიება: სრული სიის ხელახლა აგება მხოლოდ მაშინ, როცა მომხმარებელი წერას წყვეტს
const debouncedUpdateUI = debounce(updateUI, 200);

// მარჟის სლაიდერი: მაქსიმუმ ერთი გადახატვა თითო კადრზე (ათასობით ბარათის შემთხვევაში)
let uiFrameRequested = false;
function scheduleUpdateUI() {
    document.getElementById('marginVal').innerText = document.getElementById('marginRange').value;
    if (uiFrameRequested) return;
    uiFrameRequested = true;
    requestAnimationFrame(() => { uiFrameRequested = false; updateUI(); });
}

function productCardHtml(p, margin) {
    const retail = retailPrice(p.cost, margin);
    const cbId = `cb_${p.code.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `
        <div class="card${p.enabled ? '' : ' disabled'}">
            <div class="card-checkbox-wrap">
                <input type="checkbox" id="${cbId}" ${p.enabled ? 'checked' : ''} onchange="toggleProduct(${jsArg(p.code)}, this.checked)">
                <label for="${cbId}" class="card-checkbox-label">${p.enabled ? 'კალკულაციაში' : 'გამორიცხულია'}</label>
            </div>
            <span class="qty-tag ${getQtyClass(p.qty)}">${p.qty} ცალი</span>
            <div class="card-title">${escapeHtml(p.name)}</div>
            <div class="card-meta">${escapeHtml(p.brand !== '-' ? p.brand : 'უცნობი ბრენდი')} | კოდი: #${escapeHtml(p.code)}</div>
            <div class="price-box">
                <div class="p-col"><span class="p-label">თვითღ.</span><span class="p-val">${formatLari(p.cost)} ₾</span></div>
                <div class="p-col"><span class="p-label">გასაყიდი</span><span class="p-val sale">${formatLari(retail)} ₾</span></div>
                <button class="card-add-btn" onclick="addToCalc(${jsArg(p.code)}, this)" title="შეთავაზებაში დამატება">+</button>
            </div>
        </div>`;
}

function updateUI() {
    if (DATA.length === 0) return;
    const query = document.getElementById('searchInput').value.toLowerCase();
    const margin = currentMargin();
    document.getElementById('marginVal').innerText = Math.round(margin * 100);
    const filtered = query
        ? DATA.filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
        : DATA;

    let totalCost = 0, totalRetail = 0, totalQty = 0;
    const groups = {};
    filtered.forEach(p => {
        const f = familyOf(p);
        (groups[f] = groups[f] || []).push(p);
        if (!p.enabled) return;
        totalCost += p.cost * p.qty;
        totalRetail += retailPrice(p.cost, margin) * p.qty;
        totalQty += p.qty;
    });

    document.getElementById('summaryBar').innerHTML = `
        <div class="summary-card"><div class="summary-val">${filtered.length}</div><div class="summary-label">პოზიცია მენიუში</div></div>
        <div class="summary-card"><div class="summary-val">${totalQty}</div><div class="summary-label">პროდუქცია სტოკზე</div></div>
        <div class="summary-card"><div class="summary-val">${formatLari(totalCost)} ₾</div><div class="summary-label">ჯამური თვითღ.</div></div>
        <div class="summary-card"><div class="summary-val">${formatLari(totalRetail)} ₾</div><div class="summary-label">პოტენციური გაყიდვა</div></div>
    `;

    let html = '';
    Object.keys(groups).sort().forEach(family => {
        const familyItems = groups[family];
        let famClass = 'f-other';
        Object.keys(FAMILY_CLASSES).forEach(key => { if (family.includes(key)) famClass = FAMILY_CLASSES[key]; });

        const enabledItems = familyItems.filter(p => p.enabled);
        let famTotalCost = 0, famTotalRetail = 0, enabledQty = 0;
        enabledItems.forEach(p => {
            famTotalCost += p.cost * p.qty;
            famTotalRetail += retailPrice(p.cost, margin) * p.qty;
            enabledQty += p.qty;
        });

        html += `
            <div class="family-block">
                <div class="family-header ${famClass}">
                    <span>${escapeHtml(family)}</span>
                    <span class="family-stats">
                        ${enabledItems.length}/${familyItems.length} მოდელი | ${enabledQty} ერთეული<br>
                        <span style="font-size:11px; opacity:0.8;">ჯამური თვითღ.: ${formatLari(famTotalCost)} ₾ | გასაყიდი: ${formatLari(famTotalRetail)} ₾</span>
                    </span>
                </div>
                <div class="product-grid">
                    ${familyItems.map(p => productCardHtml(p, margin)).join('')}
                </div>
            </div>
        `;
    });
    document.getElementById('productContainer').innerHTML = html || '<p style="text-align:center; color: var(--text-light);">შედეგი ვერ მოიძებნა</p>';
    renderCalc();
}

function toggleProduct(code, enabled) {
    const product = findProduct(code);
    if (product) { product.enabled = enabled; updateUI(); }
}

/* ---------- სურათები ---------- */
// .jpg → .png → .jpeg → .webp → placeholder
function imageFallback(el) {
    const code = el.getAttribute('data-code');
    const next = ['png', 'jpeg', 'webp'].find(ext => !el.dataset['tried_' + ext]);
    if (next) {
        el.dataset['tried_' + next] = "true";
        el.src = productImageUrl(code, next);
    } else {
        el.parentNode.innerHTML = '<div class="prod-img-placeholder">ფოტო<br>არ არის</div>';
    }
}

function imageFallbackStamp(el) {
    if (!el.dataset.triedPng) {
        el.dataset.triedPng = "true";
        el.src = storageUrl("stamp.png");
    } else if (!el.dataset.triedJpg) {
        el.dataset.triedJpg = "true";
        el.src = storageUrl("stamp.jpg");
    } else {
        el.parentNode.innerHTML = '<span style="font-size:11px; color:#94a3b8; text-align:center;">ბეჭდის ფოტო<br>ვერ მოიძებნა</span>';
    }
}

function productImageHtml(code) {
    return `<div class="prod-img-box"><img loading="lazy" src="${escapeHtml(productImageUrl(code))}" data-code="${escapeHtml(code)}" alt="" onerror="imageFallback(this)"></div>`;
}

/* ==========================================
   📥 Excel ექსპორტი
   ========================================== */
function openExportModal() {
    if (DATA.length === 0) { alert("პირველ რიგში ატვირთეთ სტოკის ბაზა!"); return; }
    const cats = {};
    DATA.forEach(p => { const f = familyOf(p); cats[f] = (cats[f] || 0) + 1; });
    const list = document.getElementById('exportCatList');
    list.innerHTML = Object.keys(cats).sort().map(cat => {
        const col = FAMILY_COLORS[cat] || { dot: "#64748b", bg: "#f1f5f9" };
        return `
            <label class="export-cat-item selected">
                <input type="checkbox" value="${escapeHtml(cat)}" checked onchange="updateExportCatStyle(this)">
                <span style="width:10px;height:10px;border-radius:50%;background:${col.dot};flex-shrink:0;display:inline-block;"></span>
                <span class="export-cat-label">${escapeHtml(cat)}</span>
                <span class="export-cat-count">${cats[cat]} პოზიცია</span>
            </label>
        `;
    }).join('');
    document.getElementById('exportModal').style.display = 'flex';
    updateExportBtn();
}
function updateExportCatStyle(cb) {
    cb.closest('.export-cat-item').classList.toggle('selected', cb.checked);
    updateExportBtn();
}
function exportCheckboxes() {
    return Array.from(document.querySelectorAll('#exportCatList input[type="checkbox"]'));
}
function exportToggleAll() {
    const checkboxes = exportCheckboxes();
    const anyUnchecked = checkboxes.some(cb => !cb.checked);
    checkboxes.forEach(cb => { cb.checked = anyUnchecked; updateExportCatStyle(cb); });
}
function updateExportBtn() {
    document.getElementById('exportGoBtn').disabled = !exportCheckboxes().some(cb => cb.checked);
}
function closeExportModal() { document.getElementById('exportModal').style.display = 'none'; }
function runExport() {
    const selectedCats = new Set(exportCheckboxes().filter(cb => cb.checked).map(cb => cb.value));
    if (selectedCats.size === 0) return;
    const filtered = DATA.filter(p => selectedCats.has(familyOf(p)));
    if (filtered.length === 0) { alert("არჩეულ კატეგორიებში პროდუქტი არ მოიძებნა."); return; }
    const rows = filtered.map(p => ({
        "პროდუქტის კოდი": p.code,
        "დასახელება": p.name,
        "თვითღირებულება (₾)": parseFloat(p.cost.toFixed(2)),
        "ბრენდი": p.brand !== '-' ? p.brand : '',
        "რაოდენობა": p.qty,
        "კატეგორია": familyOf(p)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [ { wch: 18 }, { wch: 45 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 20 } ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "სტოკი");
    XLSX.writeFile(wb, `სტოკი_${localISODate()}.xlsx`);
    closeExportModal();
}
