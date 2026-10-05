/* ==========================================
   📦 შეკვეთების მოდული (საწყობისთვის)
   ========================================== */
function openOrderModal() {
    document.getElementById('orderModal').style.display = 'flex';
    document.getElementById('orderDate').innerText = new Date().toLocaleDateString('ka-GE');
    renderOrderTable();
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

function updateOrderHeader() { renderClientHeader('orderClientSearch', 'orderClientDisplay'); }

function handleOrderSearch() {
    const q = document.getElementById('orderCodeInput').value.toLowerCase().trim();
    const resBox = document.getElementById('orderSearchResults');
    if (!q) { resBox.style.display = 'none'; return; }

    const matches = DATA.filter(p => p.enabled && p.code.toLowerCase().startsWith(q)).slice(0, 10);

    if (matches.length === 0) {
        resBox.style.display = 'none';
        return;
    }

    resBox.innerHTML = matches.map(p => `
        <div class="search-item" onclick="selectOrderCode(${jsArg(p.code)})">
            <div class="search-item-info">
                <span style="font-weight:600; color:var(--text-dark);">#${escapeHtml(p.code)}</span>
                <span style="font-size:11px; color:var(--text-light);">${escapeHtml(p.name)}</span>
            </div>
        </div>
    `).join('');
    resBox.style.display = 'block';
}

function selectOrderCode(code) {
    const product = findProduct(code);
    if (!product) return;
    document.getElementById('orderCodeInput').value = code;
    document.getElementById('orderNameInput').value = product.name;
    document.getElementById('orderPriceInput').value = retailPrice(product.cost).toFixed(2);
    document.getElementById('orderSearchResults').style.display = 'none';
}

function addOrderItem() {
    const code = document.getElementById('orderCodeInput').value.trim();
    const name = document.getElementById('orderNameInput').value.trim();
    const price = parseFloat(document.getElementById('orderPriceInput').value) || 0;
    const qty = parseFloat(document.getElementById('orderQtyInput').value) || 1;

    if (!code) { alert("გთხოვთ, შეიყვანოთ პროდუქტის კოდი."); return; }

    if (!findProduct(code)) {
        alert("პროდუქტი ამ კოდით სტოკში არ იძებნება!");
        return;
    }

    const existingItem = findOrderItem(code);
    if (existingItem) {
        existingItem.qty += qty;
        if (price > 0) existingItem.price = price;
    } else {
        orderItems.push({ code: code, name: name || "-", qty: qty, price: price });
    }

    document.getElementById('orderCodeInput').value = '';
    document.getElementById('orderNameInput').value = '';
    document.getElementById('orderPriceInput').value = '';
    document.getElementById('orderQtyInput').value = '1';
    renderOrderTable();
}

function findOrderItem(code) { return orderItems.find(i => i.code === code); }

function updateOrderPrice(code, newPrice) {
    const item = findOrderItem(code);
    if (item) item.price = parseFloat(newPrice) || 0;
    renderOrderTable();
}

function updateOrderQty(code, delta) {
    const item = findOrderItem(code);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) removeOrderItem(code);
    }
    renderOrderTable();
}

function removeOrderItem(code) {
    orderItems = orderItems.filter(i => i.code !== code);
    renderOrderTable();
}

function renderOrderTable() {
    const tbody = document.getElementById('orderTableBody');
    let total = 0;

    if (orderItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-light);">შეკვეთა ცარიელია. დაამატეთ პროდუქტი.</td></tr>';
        document.getElementById('orderTotalAmount').innerText = '0.00 ₾';
        return;
    }

    tbody.innerHTML = orderItems.map(item => {
        const code = jsArg(item.code);
        const rowTotal = item.price * item.qty;
        total += rowTotal;
        return `
            <tr>
                <td style="font-weight: 600;">#${escapeHtml(item.code)}</td>
                <td class="text-left" style="font-weight: 500;">${escapeHtml(item.name)}</td>
                <td><input type="number" class="editable-price" value="${item.price > 0 ? item.price : ''}" step="0.01" onchange="updateOrderPrice(${code}, this.value)"></td>
                <td>
                    <div class="qty-controls">
                        <button class="qty-btn hide-on-pdf" onclick="updateOrderQty(${code}, -1)">-</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="qty-btn hide-on-pdf" onclick="updateOrderQty(${code}, 1)">+</button>
                    </div>
                </td>
                <td style="font-weight: 700;">${formatLari(rowTotal)}</td>
                <td class="hide-on-pdf"><button class="calc-remove-btn" onclick="removeOrderItem(${code})" title="წაშლა">✕</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('orderTotalAmount').innerText = formatLari(total) + ' ₾';
}

function generateOrderPDF() {
    if (orderItems.length === 0) { alert("შეკვეთა ცარიელია!"); return; }
    printDocument('printing-order', "Order_" + new Date().toLocaleDateString('ka-GE'));
}
