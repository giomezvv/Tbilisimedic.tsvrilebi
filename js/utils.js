// --- დამხმარე ფუნქციები ---
// მომხმარებლის შეყვანილი ტექსტის უსაფრთხოდ ჩასმა innerHTML-ში (XSS-ისგან დაცვა)
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// ლოკალური (საქართველოს) თარიღი YYYY-MM-DD — toISOString() UTC-ს იყენებს და 00:00-04:00 შუალედში წინა დღეს აბრუნებს
function localISODate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localISOMonth() { return localISODate().slice(0, 7); }
// ისტორიის ჩანაწერის დრო, წუთები ყოველთვის ორნიშნა (14:05 და არა 14:5)
function nowStamp() {
    const d = new Date();
    return d.toLocaleDateString('ka-GE') + " " + d.getHours() + ":" + String(d.getMinutes()).padStart(2, '0');
}
// Firestore-ში ჩაწერის შეცდომის შეტყობინება (მაგ. დოკუმენტის 1MB ლიმიტის გადაჭარბება დიდი ფაილების გამო)
function reportSaveError(err) {
    console.error("შენახვის შეცდომა:", err);
    alert("შენახვა ვერ მოხერხდა: " + (err && err.message ? err.message : err) + "\n\nთუ მიმაგრებულია დიდი ფაილები, შესაძლოა გადაჭარბებულია ბაზის 1MB ლიმიტი.");
}

// inline onclick="fn(...)" ატრიბუტში სტრიქონის უსაფრთხოდ ჩასმა: JSON ციტატებს/backslash-ებს ამუშავებს,
// escapeHtml კი ატრიბუტიდან გასვლას უშლის ხელს. მაგ: onclick="addToCalc(${jsArg(p.code)})"
function jsArg(value) {
    return escapeHtml(JSON.stringify(String(value ?? '')));
}

// მიმაგრებული ფაილის ბმული — მხოლოდ data: და https: (javascript: და სხვა სქემები იბლოკება)
function safeFileHref(url) {
    const s = String(url || '').trim();
    return /^(data:|https:\/\/)/i.test(s) ? escapeHtml(s) : '#';
}

function formatLari(val) {
    if (val === 0 || isNaN(val)) return '0.00';
    return val.toLocaleString('ka-GE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function formatLariInt(val) {
    if (val === 0 || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('ka-GE', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

// Excel ფაილის წაკითხვა — ოთხივე ატვირთვის ფორმისთვის საერთო, დაზიანებული ფაილის შეცდომის დამუშავებით
function readWorkbookRows(file, sheetOptions, onRows) {
    const reader = new FileReader();
    reader.onload = function(e) {
        let rows;
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
            rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], sheetOptions);
        } catch (err) {
            console.error("Excel-ის წაკითხვის შეცდომა:", err);
            alert("ფაილის წაკითხვა ვერ მოხერხდა. დარწმუნდით, რომ ეს სწორი Excel ფაილია.");
            return;
        }
        onRows(rows);
    };
    reader.onerror = () => alert("ფაილის წაკითხვა ვერ მოხერხდა.");
    reader.readAsArrayBuffer(file);
}

// მიმაგრებული ფაილის წაკითხვა data URL-ად, ზომის შემოწმებით (Firestore-ის 1MB ლიმიტი)
function readAttachment(file, onLoad) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
        alert(`ფაილი ძალიან დიდია (${(file.size / 1024).toFixed(0)} KB). მაქსიმალური ზომაა ${MAX_ATTACHMENT_BYTES / 1024} KB.`);
        return false;
    }
    const reader = new FileReader();
    reader.onload = e => onLoad({ name: file.name, data: e.target.result });
    reader.onerror = () => alert("ფაილის წაკითხვა ვერ მოხერხდა.");
    reader.readAsDataURL(file);
    return true;
}

/* ---------- Firebase Storage-ში შენახული ფაილები ----------
   ფაილის ჩანაწერის სამი ფორმა არსებობს:
   - { name, path, size, contentType, amount }  — Storage-ში (ახალი ფორმატი)
   - { name, data, amount }                      — Firestore-ში ჩაშენებული data: URL (ძველი ფორმატი)
   - { name, blob, amount, pending: true }       — ჯერ არ ატვირთულა, მხოლოდ მეხსიერებაში, ბაზაში არ იწერება */

// "ფაილის გადმოწერა" ორიგინალი (ქართული) სახელით — Storage-ის ბმული სხვა დომენზეა და <a download> არ მუშაობს
function attachmentDisposition(name) {
    return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Storage-ის ობიექტის სახელი: უნიკალური პრეფიქსი + სახელი ბილიკისთვის სახიფათო სიმბოლოების გარეშე
function storageObjectName(name) {
    const safe = String(name || 'file').replace(/[\/\\#?\[\]*\x00-\x1f]/g, '_').slice(0, 150);
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
}

function uploadToStorage(folder, name, blob, contentType) {
    const path = `${folder}/${storageObjectName(name)}`;
    const type = contentType || blob.type || 'application/octet-stream';
    return storage.ref(path)
        .put(blob, { contentType: type, contentDisposition: attachmentDisposition(name) })
        .then(() => ({ name, path, size: blob.size, contentType: type }));
}

// მოლოდინში მყოფი ფაილების ატვირთვა. files — ბაზაში ჩასაწერი სია (ძველი/უკვე ატვირთული ჩანაწერები უცვლელია),
// uploadedPaths — ახლად ატვირთულები, რომ ბაზაში ჩაწერის ჩავარდნისას წაიშალოს.
// ატვირთვის შეცდომისას უკვე ატვირთულ ფაილებს თვითონ შლის, რომ Storage-ში ობოლი ობიექტები არ დარჩეს.
async function uploadPendingFiles(folder, files) {
    const uploaded = [];
    try {
        const result = [];
        for (const f of files) {
            if (!f.pending) { result.push(f); continue; }
            const stored = await uploadToStorage(folder, f.name, f.blob);
            uploaded.push(stored.path);
            result.push({ ...stored, amount: f.amount || 0 });
        }
        return { files: result, uploadedPaths: uploaded };
    } catch (err) {
        deleteStoredFiles(uploaded);
        throw err;
    }
}

// Storage-იდან წაშლა — "საუკეთესო მცდელობით": ჩავარდნა მხოლოდ ლოგდება (ობოლი ფაილი, და არა მონაცემის დაკარგვა)
function deleteStoredFiles(paths) {
    return Promise.all(paths.map(p => storage.ref(p).delete().catch(err => console.warn('Storage-იდან წაშლა ვერ მოხერხდა:', p, err))));
}

// გადმოწერის ბმული მოთხოვნისას იქმნება, რომ Storage-ის წესებმა ყოველ ჯერზე შეამოწმოს წვდომა
function openStoredFile(event, path) {
    event.preventDefault();
    storage.ref(path).getDownloadURL().then(url => {
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener';
        a.click();
    }).catch(err => {
        console.error('ფაილის გახსნა ვერ მოხერხდა:', path, err);
        alert(err && err.code === 'storage/unauthorized'
            ? 'ამ ფაილზე წვდომა არ გაქვთ.'
            : 'ფაილის გახსნა ვერ მოხერხდა: ' + (err && err.message ? err.message : err));
    });
}

// კონტრაგენტის სათაური ინვოისზე / შეთავაზებაზე / შეკვეთაზე ("სახელი (ს/კ: 123)" ფორმატიდან)
function renderClientHeader(inputId, displayId) {
    const val = document.getElementById(inputId).value;
    const display = document.getElementById(displayId);
    const match = val.match(/(.*)\s\(ს\/კ:\s(.*)\)/);
    const name = match ? match[1] : val;
    const idCode = match ? match[2] : '-';
    display.innerHTML = name
        ? `<h3>${escapeHtml(name)}</h3><p>ს/კ: ${escapeHtml(idCode)}</p>`
        : '<h3>კონტრაგენტი არ არის არჩეული</h3><p>ს/კ: -</p>';
}

function setStatus(elId, html, ok = true) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = html;
    if (ok) el.style.color = 'var(--primary)';
}

// მარჟის % და ფერი: <25% წითელი, 25–29% ყვითელი, ≥30% მწვანე
function marginCellHtml(price, cost) {
    if (!(price > 0)) return `<td class="hide-on-pdf" style="font-weight:bold; font-size:13px;">-</td>`;
    const pct = ((price - cost) / price) * 100;
    const color = pct >= 30 ? '#10b981' : pct >= 25 ? '#f59e0b' : '#ef4444';
    return `<td class="hide-on-pdf" style="color:${color}; font-weight:bold; font-size:13px;">${pct.toFixed(1)}%</td>`;
}

// ინვოისის / შეთავაზების / შეკვეთის ბეჭდვა: body-ს კლასი განსაზღვრავს, რომელი ფანჯარა დაიბეჭდება (იხ. @media print)
function printDocument(bodyClass, title) {
    const oldTitle = document.title;
    document.title = title;
    document.body.classList.add(bodyClass);
    window.print();
    document.title = oldTitle;
    setTimeout(() => document.body.classList.remove(bodyClass), 500);
}

function debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- ქართულად რიცხვების სიტყვიერად ჩაწერის ფუნქცია კონტრაქტისთვის ---
function numToWordsGE(num) {
    if (!num || isNaN(num) || num === 0) return "ნული";
    const o = ["", "ერთი", "ორი", "სამი", "ოთხი", "ხუთი", "ექვსი", "შვიდი", "რვა", "ცხრა", "ათი", "თერთმეტი", "თორმეტი", "ცამეტი", "თოთხმეტი", "თხუთმეტი", "თექვსმეტი", "ჩვიდმეტი", "თვრამეტი", "ცხრამეტი"];
    const t2 = ["", "", "ოცდა", "ოცდა", "ორმოცდა", "ორმოცდა", "სამოცდა", "სამოცდა", "ოთხმოცდა", "ოთხმოცდა"];
    const t2f = ["", "", "ოცი", "", "ორმოცი", "", "სამოცი", "", "ოთხმოცი", ""];
    const h = ["", "ას", "ორას", "სამას", "ოთხას", "ხუთას", "ექვსას", "შვიდას", "რვაას", "ცხრაას"];

    function under100(n, full) {
        if (n === 0) return "";
        if (n < 20) return full ? o[n] : (o[n].endsWith("ი") ? o[n].slice(0, -1) : o[n]);
        let tens = Math.floor(n / 20) * 2;
        let rem = n % 20;
        if (rem === 0) return full ? t2f[tens] : t2f[tens].slice(0, -1);
        let w = t2[tens] + o[rem];
        return full ? w : (w.endsWith("ი") ? w.slice(0, -1) : w);
    }

    function under1000(n, full) {
        if (n === 0) return "";
        let hund = Math.floor(n / 100);
        let rem = n % 100;
        if (rem === 0) return full ? h[hund] + "ი" : h[hund];
        return h[hund] + under100(rem, full);
    }

    let th = Math.floor(num / 1000);
    let rem = num % 1000;
    let res = "";

    if (th > 0) {
        if (th === 1) res += "ათას ";
        else res += under1000(th, false) + "ათას ";
    }
    if (rem > 0) {
        res += under1000(rem, true);
    } else if (th > 0) {
        res = res.trim() + "ი";
    }
    return res.trim();
}

function setWelcomeMessage(email) {
    if(!email) return;
    let namePart = email.split('@')[0];
    namePart = namePart.split('.')[0];
    const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const msgEl = document.getElementById('welcomeMessage');
    msgEl.innerText = `წარმატებები ${capitalized} ♥️`;
    msgEl.style.display = 'inline-block';
}
