/* ==========================================
   📄 ინვოისი / კომერციული შეთავაზება
   პროდუქტი ემატება სტოკიდან (კოდით ან სახელით) ან ხელით — ნებისმიერი კოდით, სტოკის გარეშეც
   ========================================== */
let calcTotal = 0; // დოკუმენტის ჯამი რიცხვად — ლიდზე მიბმისას ეკრანის ტექსტს აღარ ვპარსავთ

function generateInvoiceNumber() {
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    return yy + mm + dd + rand;
}

function openInvoice() {
    document.getElementById('invoiceModal').style.display = 'flex';
    document.getElementById('invDate').innerText = new Date().toLocaleDateString('ka-GE');
    document.getElementById('invNumber').innerText = generateInvoiceNumber();
    renderCalc();
}

function closeInvoice() { document.getElementById('invoiceModal').style.display = 'none'; }

function handleInvoiceSearch() {
    const q = document.getElementById('invoiceLiveSearch').value.toLowerCase().trim();
    const resBox = document.getElementById('invoiceSearchResults');
    if (!q) { resBox.style.display = 'none'; return; }

    const matches = DATA.filter(p => p.enabled && (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))).slice(0, 10);

    if (matches.length === 0) {
        resBox.innerHTML = '<div style="padding:10px; font-size:13px; color:#94a3b8;">სტოკში ვერ მოიძებნა — შეიყვანეთ დასახელება და დააჭირეთ „დამატებას“</div>';
        resBox.style.display = 'block';
        return;
    }

    const margin = currentMargin();
    resBox.innerHTML = matches.map(p => `
        <div class="search-item" onclick="addFromLiveSearch(${jsArg(p.code)})">
            <div class="search-item-info">
                <span style="font-weight:600; color:var(--text-dark);">#${escapeHtml(p.code)} - ${escapeHtml(p.name)}</span>
                <span style="font-size:11px; color:var(--text-light);">ბრენდი: ${escapeHtml(p.brand)} | ნაშთი: ${p.qty}ც | ფასი: ${formatLari(retailPrice(p.cost, margin))} ₾</span>
            </div>
            <span style="color:white; background:var(--primary); width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">+</span>
        </div>
    `).join('');
    resBox.style.display = 'block';
}

function clearInvoiceInputs() {
    document.getElementById('invoiceLiveSearch').value = '';
    document.getElementById('invoiceCustomName').value = '';
    document.getElementById('invoiceSearchResults').style.display = 'none';
}

function addFromLiveSearch(code) {
    addToCalc(code);
    clearInvoiceInputs();
}

// ძიების ჩამოსაშლელი სიების დახურვა, როცა მომხმარებელი სხვაგან აჭერს
const LIVE_SEARCH_BOXES = { invoiceLiveSearch: 'invoiceSearchResults', orderCodeInput: 'orderSearchResults' };
document.addEventListener('click', function(e) {
    Object.entries(LIVE_SEARCH_BOXES).forEach(([inputId, resultsId]) => {
        if (e.target.id === inputId) return;
        const res = document.getElementById(resultsId);
        if (res) res.style.display = 'none';
    });
});

function updateInvoiceHeader() { renderClientHeader('invoiceClientSearch', 'clientDisplay'); }

function findCalcItem(code) { return calcItems.find(i => i.code === code); }

// ჩანაწერი დოკუმენტის ასლია — დასახელების რედაქტირება სტოკის პროდუქტს არ ცვლის
function pushCalcItem(item) {
    const existingItem = findCalcItem(item.code);
    if (existingItem) existingItem.qty += 1;
    else calcItems.push({ qty: 1, ...item });
    renderCalc();
}

function stockCalcItem(product) {
    return {
        code: product.code,
        name: product.name,
        brand: product.brand !== '-' ? product.brand : '',
        model: product.model || '',
        features: product.features || '-',
        country: product.country || '-',
        warranty: product.warranty || '-',
        price: Math.round(retailPrice(product.cost))
    };
}

function addToCalc(code, btnElement = null) {
    const product = findProduct(code);
    if (!product) return;
    pushCalcItem(stockCalcItem(product));
    if (btnElement) {
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = '✓'; btnElement.style.background = '#10b981'; btnElement.style.color = 'white'; btnElement.style.borderColor = '#10b981';
        setTimeout(() => { btnElement.innerHTML = originalHTML; btnElement.style.background = ''; btnElement.style.color = ''; btnElement.style.borderColor = ''; }, 800);
    }
}

// ხელით დამატება: თუ კოდი სტოკშია — სტოკის პროდუქტი, თუ არა — ნებისმიერი კოდი და დასახელება
function addCustomItem() {
    const code = document.getElementById('invoiceLiveSearch').value.trim();
    const name = document.getElementById('invoiceCustomName').value.trim();
    if (!code) { alert("გთხოვთ, შეიყვანოთ პროდუქტის კოდი."); return; }

    const product = findProduct(code);
    if (product) {
        pushCalcItem({ ...stockCalcItem(product), ...(name ? { name } : {}) });
    } else {
        const aux = lookupAux(code);
        pushCalcItem({
            code,
            name: name || "-",
            brand: '',
            model: '',
            features: (aux && aux.features) || "-",
            country: (aux && aux.country) || "-",
            warranty: (aux && aux.warranty) || "-",
            price: 0
        });
    }
    clearInvoiceInputs();
}

function updateCalcQty(code, delta) {
    const item = findCalcItem(code);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) removeCalcItem(code);
    }
    renderCalc();
}

function updateCustomPrice(code, newPrice) {
    const item = findCalcItem(code);
    if (item) item.price = Math.round(parseFloat(newPrice)) || 0;
    renderCalc();
}

function updateUsdPrice(code, newUsdPrice) {
    const item = findCalcItem(code);
    if (item) item.price = Math.round((parseFloat(newUsdPrice) || 0) * currentUsdRate);
    renderCalc();
}

// დასახელება / ბრენდი / მოდელი — მხოლოდ ამ დოკუმენტში იცვლება, სტოკის პროდუქტი უცვლელი რჩება
const EDITABLE_FIELD_FALLBACK = { name: '-', brand: '', model: '' };

function updateItemField(code, field, el) {
    const item = findCalcItem(code);
    if (!item) return;
    const value = el.innerText.trim() || EDITABLE_FIELD_FALLBACK[field];
    if (item[field] === value) { el.textContent = value; return; } // ბრაუზერის დატოვებული <br>-ის მოშორება (:empty placeholder-ისთვის)
    item[field] = value;
    renderCalc();
}

function editableFieldHtml(code, field, value, placeholder, style = '') {
    return `<div class="editable-text" contenteditable="true" data-placeholder="${escapeHtml(placeholder)}" title="შეცვლა (მხოლოდ ამ დოკუმენტში)" style="${style}" onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.blur(); }" onblur="updateItemField(${code}, '${field}', this)">${escapeHtml(value)}</div>`;
}

function removeCalcItem(code) { calcItems = calcItems.filter(i => i.code !== code); renderCalc(); }

function renderCalc() {
    const tbody = document.getElementById('calcTableBody');
    calcTotal = 0;

    if (calcItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 30px; color: var(--text-light);">დოკუმენტი ცარიელია. დაამატეთ პროდუქტი.</td></tr>';
        document.getElementById('calcTotalRetail').innerText = '0 ₾';
        return;
    }

    tbody.innerHTML = calcItems.map(item => {
        const code = jsArg(item.code);
        const price = item.price > 0 ? Math.round(item.price) : 0;
        const rowTotal = price * item.qty;
        calcTotal += rowTotal;
        const usdPrice = price > 0 ? Math.round(price / currentUsdRate) : 0;
        const product = findProduct(item.code);

        return `
            <tr>
                <td>${productImageHtml(item.code)}</td>
                <td class="hide-on-pdf" style="font-weight: 600;">#${escapeHtml(item.code)}</td>
                <td>${editableFieldHtml(code, 'name', item.name, 'დასახელება', 'font-weight: 600;')}</td>
                <td>${editableFieldHtml(code, 'brand', item.brand, 'ბრენდი')}${editableFieldHtml(code, 'model', item.model, 'მოდელი', 'font-size:11px; color:#64748b; margin-top:3px;')}</td>
                <td class="text-left" style="font-size:12px; line-height: 1.4;">${escapeHtml(item.features)}</td>
                <td><input type="number" class="editable-price" value="${price > 0 ? price : ''}" placeholder="ფასი" step="1" onchange="updateCustomPrice(${code}, this.value)"></td>
                <td><div style="display:flex; align-items:center; justify-content:center; gap:2px;"><span style="color: #64748b; font-weight: 600;">$</span><input type="number" class="editable-price" style="color:#64748b; border-color:#cbd5e1;" value="${usdPrice > 0 ? usdPrice : ''}" step="1" onchange="updateUsdPrice(${code}, this.value)"></div></td>
                <td><div class="qty-controls"><button class="qty-btn hide-on-pdf" onclick="updateCalcQty(${code}, -1)">-</button><span class="qty-val">${item.qty}</span><button class="qty-btn hide-on-pdf" onclick="updateCalcQty(${code}, 1)">+</button></div></td>
                <td style="font-weight: 700;">${formatLariInt(rowTotal)}</td>
                <td style="font-size:12px;">${escapeHtml(item.country || '-')}</td>
                <td style="font-size:12px;">${escapeHtml(item.warranty || '-')}</td>
                ${marginCellHtml(product ? price : 0, product ? product.cost : 0)}
                <td class="hide-on-pdf"><button class="calc-remove-btn" onclick="removeCalcItem(${code})" title="წაშლა">✕</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('calcTotalRetail').innerText = formatLariInt(calcTotal) + ' ₾';
}

function generatePDF() {
    if (calcItems.length === 0) { alert("დოკუმენტი ცარიელია!"); return; }
    printDocument('printing-invoice', "Invoice_" + document.getElementById('invNumber').innerText);
}
