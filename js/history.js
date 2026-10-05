/* ==========================================
   📈 გაყიდვების ისტორიის მოდული
   ========================================== */
const HISTORY_DISPLAY_LIMIT = 300;

function openHistoryModal() {
    document.getElementById('historyModal').style.display = 'flex';
    document.getElementById('historySearch').value = '';
    renderHistory();
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

// ძიების ინდექსი: თითო ჩანაწერის lowercase ტექსტი ერთხელ გამოითვლება
// (და არა ყოველ დაჭერაზე, ათასობით ჩანაწერისთვის). HISTORY_DATA-ს შეცვლისას ავტომატურად ახლდება.
let historySearchSource = null;
let historySearchIndex = [];
function getHistorySearchIndex() {
    if (historySearchSource !== HISTORY_DATA) {
        historySearchSource = HISTORY_DATA;
        historySearchIndex = HISTORY_DATA.map(item =>
            [item.buyer, item.code, item.name, item.idCode, item.date].map(v => String(v ?? '')).join('\u0001').toLowerCase()
        );
    }
    return historySearchIndex;
}

function renderHistory() {
    const q = document.getElementById('historySearch').value.toLowerCase().trim();
    const tbody = document.getElementById('historyTableBody');

    let displayData;
    if (q) {
        const index = getHistorySearchIndex();
        displayData = [];
        for (let i = 0; i < HISTORY_DATA.length && displayData.length < HISTORY_DISPLAY_LIMIT; i++) {
            if (index[i].includes(q)) displayData.push(HISTORY_DATA[i]);
        }
    } else {
        displayData = HISTORY_DATA.slice(0, HISTORY_DISPLAY_LIMIT);
    }

    if (displayData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-light);">ჩანაწერი ვერ მოიძებნა.</td></tr>';
        return;
    }

    tbody.innerHTML = displayData.map(item => `
        <tr>
            <td style="font-size:12px;">${escapeHtml(item.date)}</td>
            <td style="font-weight:600; color:var(--text-light);">#${escapeHtml(item.code)}</td>
            <td class="text-left" style="font-size:12px;">${escapeHtml(item.name)}</td>
            <td class="text-left" style="font-weight:600; font-size:13px;">${escapeHtml(item.buyer)}</td>
            <td style="font-size:12px;">${escapeHtml(item.idCode)}</td>
            <td style="font-weight:600;">${escapeHtml(item.qty)}</td>
            <td style="font-size:13px;">${formatLari(item.price)}</td>
            <td style="font-weight:bold; color:var(--primary); font-size:13px;">${formatLari(item.amount)}</td>
        </tr>
    `).join('');
}
const debouncedRenderHistory = debounce(renderHistory, 200);

function handleHistoryUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; // იგივე ფაილის ხელახლა ატვირთვა onchange-ს ისევ გამოიწვევს
    readWorkbookRows(file, {defval: ""}, jsonData => {
        HISTORY_DATA = [];
        for (const row of jsonData) {
            const buyer = String(row['მყიდველი'] || "").trim();
            if (!buyer) continue;

            HISTORY_DATA.push({
                date: String(row['თარიღი'] || "").trim(),
                buyer: buyer,
                idCode: String(row['საიდენთიფიკაციო'] || row['საიდენტიფიკაციო'] || "").trim(),
                code: String(row['კოდი'] || "").trim(),
                name: String(row['დასახელება'] || "").trim(),
                qty: parseFloat(row['რაოდენობა']) || 0,
                price: parseFloat(row['ფასი']) || 0,
                amount: parseFloat(row['თანხა']) || 0
            });
        }

        if (isAdmin && !isLocalMode) {
            db.collection("appData").doc("salesHistory").set({ items: HISTORY_DATA })
                .then(() => setStatus('historyUploadStatus', `✅ აიტვირთა ${HISTORY_DATA.length} ჩანაწერი!`))
                .catch(reportSaveError);
        } else {
            setStatus('historyUploadStatus', `✅ ჩაიტვირთა ${HISTORY_DATA.length} ჩანაწერი.`);
            if (isLocalMode) localStorage.setItem('stock_sales_history', JSON.stringify(HISTORY_DATA));
        }
    });
}
