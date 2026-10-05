/* ==========================================
   📊 PIPELINE / KANBAN ლოგიკა & უსაფრთხო ჩატვირთვა
   ========================================== */
const STAGES = {
    "new": { title: "🆕 ახალი ლიდი", color: "#3b82f6" },
    "processing": { title: "⏳ ლიდის დამუშავება", color: "#0ea5e9" },
    "with_sales": { title: "🧑‍💼 შეთავაზება სეილთანაა", color: "#8b5cf6" },
    "offer": { title: "📄 შეთავაზება გაგზავნილია", color: "#BA7517" },
    "negotiation": { title: "🤝 მოლაპარაკება", color: "#d97706" },
    "delivery_planned": { title: "🚚 მიწოდება დაგეგმილია / გაფორმებულია", color: "#14b8a6" },
    "closed_won": { title: "✅ მოგებული", color: "#1D9E75" },
    "closed_lost": { title: "❌ წაგებული", color: "#ef4444" }
};

let leadsData = [];

function isModalOpen(id) {
    const el = document.getElementById(id);
    return !!el && el.style.display !== 'none' && el.style.display !== '';
}

function openPipeline() {
    document.getElementById('pipelineModal').style.display = 'flex';
    renderPipeline();
}

function closePipeline() {
    document.getElementById('pipelineModal').style.display = 'none';
}

function loadLeadsFromFirebase() {
    if (isLocalMode) return;

    if (unsubscribeLeads) unsubscribeLeads();

    // ადმინი ყველა ლიდს ხედავს; სხვები — საკუთარს და (CREATOR_KEEPS_LEAD_ACCESS-ისას) მათ მიერ შექმნილს.
    // Firestore-ის წესები თითოეულ მოთხოვნას ცალკე ამოწმებს, ამიტომ ორი ცალკე მოთხოვნაა და შედეგები ერთიანდება.
    const leads = db.collection("leads");
    const queries = isAdmin ? [leads]
        : CREATOR_KEEPS_LEAD_ACCESS
            ? [leads.where("userEmail", "==", currentUser.email), leads.where("userId", "==", currentUser.uid)]
            : [leads.where("userEmail", "==", currentUser.email)];

    const results = queries.map(() => new Map());
    const publish = () => {
        const merged = new Map();
        results.forEach(r => r.forEach((lead, id) => merged.set(id, lead)));
        leadsData = [...merged.values()];
        updateUsersDatalist();
        renderPipeline();
    };
    const unsubscribers = queries.map((query, i) => query.onSnapshot((querySnapshot) => {
        results[i] = new Map(querySnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
        publish();
    }, (error) => {
        console.error("ლიდების ჩატვირთვის შეცდომა:", error);
        results[i] = new Map();
        publish();
    }));
    unsubscribeLeads = () => unsubscribers.forEach(u => u());
}

// ლიდი სხვას ეკუთვნის — ბარათსა და ფანჯარაში ვაჩვენებთ, ვისთანაა (ადმინს ყოველთვის)
function showLeadOwner(lead) {
    return isAdmin || !!(lead.userEmail && currentUser && lead.userEmail !== currentUser.email);
}

function updateLeadSelectors() {
    const leadOption = l => `<option value="${escapeHtml(`${l.clinic || 'უცნობი'} - ${l.product || ''} (${l.amount ? l.amount + ' ₾' : '0 ₾'}) | ID: ${l.id}`)}">`;
    const allLeadsHtml = leadsData.map(leadOption).join('');
    const wonLeadsHtml = leadsData.filter(l => l.stage === 'closed_won').map(leadOption).join('');

    const leadsDl = document.getElementById('leadsDatalist');
    const wonLeadsDl = document.getElementById('wonLeadsDatalist');

    if (leadsDl) leadsDl.innerHTML = allLeadsHtml;
    if (wonLeadsDl) wonLeadsDl.innerHTML = wonLeadsHtml;
}

function renderPipeline() {
    if (isLocalMode) leadsData = localLeads;
    updateLeadSelectors();
    // დაფა მხოლოდ მაშინ იხატება, როცა ფანჯარა ღიაა — ყოველი snapshot-ზე დამალული DOM-ის აგება ზედმეტია
    if (!isModalOpen('pipelineModal')) return;

    const board = document.getElementById('kanbanBoard');
    let html = '';

    let filteredLeads = leadsData;
    const searchVal = document.getElementById('pipelineFilterAdmin').value.toLowerCase().trim();
    const monthVal = document.getElementById('pipelineMonthFilter').value;

    if (searchVal) {
        filteredLeads = leadsData.filter(l =>
            (l.userEmail || '').toLowerCase().includes(searchVal) ||
            (l.clinic || '').toLowerCase().includes(searchVal) ||
            (l.product || '').toLowerCase().includes(searchVal)
        );
    }

    // დროის ფილტრი ვრცელდება ყველა ლიდზე
    if (monthVal) {
        filteredLeads = filteredLeads.filter(l => (l.updatedAt || l.createdAt || '').startsWith(monthVal));
    }

    const today = localISODate();
    const leadTime = l => new Date(l.updatedAt || l.createdAt || 0).getTime();

    Object.keys(STAGES).forEach(stageKey => {
        // ახალი/განახლებული ლიდები ზევით
        const stageLeads = filteredLeads.filter(l => l.stage === stageKey).sort((a, b) => leadTime(b) - leadTime(a));
        const stageAmount = stageLeads.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

        html += `
            <div class="kanban-col" ondragover="allowDrop(event)" ondragleave="removeColHighlight(event)" ondrop="dropLead(event, '${stageKey}')">
                <div class="col-header" style="border-bottom-color: ${STAGES[stageKey].color};">
                    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 5px;">
                        <span>${STAGES[stageKey].title}</span>
                        <span class="col-count" style="background:${STAGES[stageKey].color}">${stageLeads.length}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-light); font-weight: 500;">
                        ჯამი: <b>${formatLari(stageAmount)} ₾</b>
                    </div>
                </div>
                <div class="kanban-cards">
                    ${stageLeads.map(l => {
                        const fileCount = (l.files && l.files.length > 0) ? l.files.length : (l.fileName ? 1 : 0);
                        const isOverdue = l.followUpDate && l.followUpDate < today && l.stage !== 'closed_won' && l.stage !== 'closed_lost';
                        const cardClass = isOverdue ? "lead-card lead-overdue" : "lead-card";

                        return `
                        <div class="${cardClass}" draggable="true" ondragstart="dragLead(event, ${jsArg(l.id)})" onclick="openLeadModal(${jsArg(l.id)})">
                            ${showLeadOwner(l) ? `<div style="font-size:10.5px; color:#3b82f6; margin-bottom:6px; font-weight:600;">👤 ${escapeHtml(l.userEmail || 'უცნობი')}</div>` : ''}
                            ${l.product ? `<div class="lead-interest">🎯 ${escapeHtml(l.product)}</div>` : ''}
                            <div class="lead-title">${escapeHtml(l.clinic || 'უცნობი კლინიკა')}</div>
                            <div class="lead-clinic">👤 ${escapeHtml(l.contact || '-')}</div>
                            <div class="lead-meta-row">
                                <span>💰 ${l.amount ? parseFloat(l.amount).toLocaleString('ka-GE') + ' ₾' : '0 ₾'}</span>
                                <span>${fileCount > 0 ? '📎 ' + fileCount + ' ფაილი' : ''}</span>
                            </div>
                            ${l.followUpDate ? `<div style="font-size:11px; margin-top:5px; padding-top:5px; border-top:1px dashed var(--border); color:${isOverdue ? '#ef4444' : '#1D9E75'}; font-weight:600;">🗓 Follow-up: ${escapeHtml(l.followUpDate)} ${isOverdue ? '<span class="overdue-badge">გადაცილებული</span>' : ''}</div>` : ''}
                            ${stageKey === 'closed_lost' && l.lostReason ? `
                            <div class="lead-lost-reason">
                                <b>წაგების მიზეზი:</b> ${escapeHtml(l.lostReason)}
                                ${l.lostComment ? `<div class="lead-lost-comment">💬 ${escapeHtml(l.lostComment)}</div>` : ''}
                            </div>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    board.innerHTML = html;
}

function dragLead(event, leadId) {
    event.dataTransfer.setData("lead_id", leadId);
}

function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function removeColHighlight(event) {
    event.currentTarget.classList.remove('drag-over');
}

function dropLead(event, newStage) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const leadId = event.dataTransfer.getData("lead_id");
    if (!leadId) return;

    const lead = leadsData.find(l => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    const moveLead = (lostFields) => {
        // ლიდი შეიძლება snapshot-ით განახლდა, სანამ ფანჯარა ღია იყო
        const current = leadsData.find(l => l.id === leadId) || lead;
        const history = [...(current.history || []), {
            date: nowStamp(),
            text: `სტატუსი შეიცვალა (${STAGES[newStage].title})`,
            author: "სისტემა"
        }];
        updateLeadInDB(leadId, { stage: newStage, updatedAt: new Date().toISOString(), history, ...lostFields });
    };

    // „წაგებულში" გადატანა მხოლოდ მიზეზის არჩევის შემდეგ; გაუქმებისას ლიდი თავის სვეტში რჩება
    if (newStage === 'closed_lost') {
        openLostReasonModal(moveLead);
    } else {
        moveLead(lead.stage === 'closed_lost' ? { lostReason: null, lostComment: null } : {});
    }
}

/* ==========================================
   ❌ წაგების მიზეზი (სავალდებულო „წაგებულში" გადატანისას)
   ========================================== */
const LOST_REASONS = ["ფასი", "კონკურენტი აირჩიეს", "ყიდვა გადაიფიქრეს", "სხვა"];
const LOST_REASON_OTHER = "სხვა"; // ამ მიზეზისთვის კომენტარი სავალდებულოა

let lostReasonCallbacks = null;

// onConfirm იღებს { lostReason, lostComment }; onCancel — ფანჯრის დახურვისას დადასტურების გარეშე
function openLostReasonModal(onConfirm, onCancel = () => {}) {
    lostReasonCallbacks = { onConfirm, onCancel };
    document.getElementById('lostReasonList').innerHTML = LOST_REASONS.map(r => `
        <label class="export-cat-item lost-reason-item">
            <input type="radio" name="lostReason" value="${escapeHtml(r)}" onchange="onLostReasonChange()">
            <span class="export-cat-label">${escapeHtml(r)}</span>
        </label>
    `).join('');
    document.getElementById('lostReasonComment').value = '';
    clearLostReasonError();
    onLostReasonChange();
    document.getElementById('lostReasonModal').style.display = 'flex';
}

function selectedLostReason() {
    const checked = document.querySelector('#lostReasonList input[name="lostReason"]:checked');
    return checked ? checked.value : '';
}

function onLostReasonChange() {
    const reason = selectedLostReason();
    document.querySelectorAll('#lostReasonList .lost-reason-item').forEach(item => {
        item.classList.toggle('selected', item.querySelector('input').checked);
    });
    document.getElementById('lostCommentHint').innerText = reason === LOST_REASON_OTHER ? '(სავალდებულო)' : '(არასავალდებულო)';
    clearLostReasonError();
}

function showLostReasonError(msg) {
    const el = document.getElementById('lostReasonError');
    el.innerText = msg;
    el.classList.add('visible');
}

function clearLostReasonError() {
    document.getElementById('lostReasonError').classList.remove('visible');
}

function closeLostReasonModal() {
    document.getElementById('lostReasonModal').style.display = 'none';
    lostReasonCallbacks = null;
}

function confirmLostReason() {
    const reason = selectedLostReason();
    const comment = document.getElementById('lostReasonComment').value.trim();
    if (!reason) {
        showLostReasonError('გთხოვთ აირჩიოთ წაგების მიზეზი.');
        return;
    }
    if (reason === LOST_REASON_OTHER && !comment) {
        showLostReasonError('„სხვა" მიზეზის არჩევისას კომენტარი სავალდებულოა.');
        document.getElementById('lostReasonComment').focus();
        return;
    }
    const { onConfirm } = lostReasonCallbacks || {};
    closeLostReasonModal();
    if (onConfirm) onConfirm({ lostReason: reason, lostComment: comment });
}

// გამოიძახება „გაუქმების" ღილაკით და Escape-ით (main.js)
function cancelLostReason() {
    const { onCancel } = lostReasonCallbacks || {};
    closeLostReasonModal();
    if (onCancel) onCancel();
}

// მხოლოდ შეცვლილი ველები იგზავნება — ლიდის დოკუმენტი შეიძლება შეიცავდეს დიდ base64 ფაილებს,
// რომელთა ყოველ ცვლილებაზე ხელახლა ჩაწერა ზედმეტია.
function updateLeadInDB(id, fields) {
    if (isLocalMode) {
        const idx = localLeads.findIndex(l => l.id === id);
        if (idx !== -1) localLeads[idx] = { ...localLeads[idx], ...fields };
        localStorage.setItem('stock_pipeline_leads', JSON.stringify(localLeads));
        renderPipeline();
        return Promise.resolve();
    }
    return db.collection("leads").doc(id).update(fields).catch(err => { reportSaveError(err); throw err; });
}

/* ==========================================
   📝 ლიდის დეტალები, ფაილები და თანხა
   ========================================== */
let currentEditingLead = null;
let tempFiles = [];
let removedStoredPaths = []; // Storage-იდან წასაშლელი ფაილები — იშლება მხოლოდ ლიდის წარმატებით შენახვის შემდეგ
let leadSaving = false;
let leadStagePrev = 'new';  // სტატუსი „წაგებულის" არჩევამდე — მიზეზის გაუქმებისას მას ვუბრუნდებით
let leadLostInfo = null;    // ფანჯარაში დადასტურებული { lostReason, lostComment }

function openLeadModal(leadId = null) {
    document.getElementById('leadModal').style.display = 'flex';
    document.getElementById('leadNote').value = '';
    document.getElementById('leadFileUpload').value = '';
    document.getElementById('leadManagerSection').style.display = 'block';
    tempFiles = [];
    removedStoredPaths = [];

    const sourceLead = leadId ? leadsData.find(l => l.id === leadId) : null;
    document.getElementById('leadDeleteBtn').style.display = isAdmin && sourceLead ? 'inline-block' : 'none';

    if (sourceLead) {
        // ასლი, რომ შეუნახავი კომენტარები ორიგინალ ლიდში არ მოხვდეს, თუ ფანჯარა შენახვის გარეშე დაიხურა
        currentEditingLead = { ...sourceLead, history: [...(sourceLead.history || [])] };
        document.getElementById('leadModalTitle').innerText = "ლიდის რედაქტირება";
        document.getElementById('leadId').value = leadId;
        document.getElementById('leadManagerEmail').value = currentEditingLead.userEmail || '';
        document.getElementById('leadClinic').value = currentEditingLead.clinic || '';
        document.getElementById('leadContact').value = currentEditingLead.contact || '';
        document.getElementById('leadProduct').value = currentEditingLead.product || '';
        document.getElementById('leadAmount').value = currentEditingLead.amount || '';
        document.getElementById('leadStage').value = currentEditingLead.stage || 'new';
        document.getElementById('leadFollowUp').value = currentEditingLead.followUpDate || '';

        const authorEl = document.getElementById('leadAuthorDisplay');
        if (showLeadOwner(currentEditingLead)) {
            authorEl.style.display = 'block';
            authorEl.innerText = (isAdmin ? 'დაამატა: ' : 'პასუხისმგებელი: ') + currentEditingLead.userEmail;
        } else {
            authorEl.style.display = 'none';
        }

        renderComments(currentEditingLead.history);

        if (currentEditingLead.files && currentEditingLead.files.length > 0) {
            tempFiles = [...currentEditingLead.files];
        } else if (currentEditingLead.fileName) {
            // ძველი ფორმატი: ერთი ფაილი fileName/fileData ველებში
            tempFiles.push({ name: currentEditingLead.fileName, data: currentEditingLead.fileData, amount: 0 });
        }
        renderLeadFiles(tempFiles);
    } else {
        currentEditingLead = null;
        document.getElementById('leadModalTitle').innerText = "ახალი ლიდი";
        document.getElementById('leadAuthorDisplay').style.display = 'none';
        document.getElementById('leadManagerEmail').value = currentUser ? currentUser.email : '';
        ['leadId', 'leadClinic', 'leadContact', 'leadProduct', 'leadAmount', 'leadFollowUp']
            .forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('leadStage').value = "new";
        renderComments([]);
        renderLeadFiles([]);
    }
    leadStagePrev = document.getElementById('leadStage').value;
    leadLostInfo = null;
}

function onLeadStageChange() {
    const select = document.getElementById('leadStage');
    if (select.value !== 'closed_lost') {
        leadStagePrev = select.value;
        leadLostInfo = null;
        return;
    }
    if (currentEditingLead && currentEditingLead.stage === 'closed_lost') {
        // უკვე წაგებული ლიდი — არსებული მიზეზი რჩება
        leadStagePrev = select.value;
        return;
    }
    openLostReasonModal(
        info => { leadLostInfo = info; leadStagePrev = 'closed_lost'; },
        () => { select.value = leadStagePrev; }
    );
}

function closeLeadModal() {
    document.getElementById('leadModal').style.display = 'none';
}

// წაშლა მხოლოდ ადმინისთვის (firestore.rules-იც მხოლოდ ადმინს აძლევს უფლებას)
async function deleteLead() {
    const id = document.getElementById('leadId').value;
    if (!isAdmin || !id) return;
    const lead = leadsData.find(l => l.id === id) || currentEditingLead || {};
    if (!confirm(`ლიდი „${lead.clinic || 'უცნობი'}" სამუდამოდ წაიშლება მიმაგრებულ ფაილებთან ერთად.\n\nგავაგრძელოთ?`)) return;

    if (isLocalMode) {
        const idx = localLeads.findIndex(l => l.id === id);
        if (idx !== -1) localLeads.splice(idx, 1);
        localStorage.setItem('stock_pipeline_leads', JSON.stringify(localLeads));
        closeLeadModal();
        renderPipeline();
        return;
    }

    try {
        await db.collection("leads").doc(id).delete();
    } catch (err) {
        console.error("ლიდის წაშლის შეცდომა:", err);
        alert("წაშლა ვერ მოხერხდა: " + (err && err.message ? err.message : err));
        return;
    }
    deleteStoredFiles((lead.files || []).filter(f => f.path).map(f => f.path));
    closeLeadModal();
}

function handleLeadFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    // ლოკალურ რეჟიმში Storage არ არის — ფაილი ისევ data: URL-ად ინახება
    if (isLocalMode) {
        readAttachment(file, f => {
            tempFiles.push({ ...f, amount: 0 });
            renderLeadFiles(tempFiles);
        });
        return;
    }
    if (file.size >= MAX_STORAGE_UPLOAD_BYTES) {
        alert(`ფაილი ძალიან დიდია (${(file.size / 1048576).toFixed(1)} MB). მაქსიმალური ზომაა ${MAX_STORAGE_UPLOAD_BYTES / 1048576} MB.`);
        return;
    }
    // ატვირთვა ხდება შენახვისას, რომ ფანჯრის გაუქმებისას Storage-ში ობოლი ფაილები არ დარჩეს
    tempFiles.push({ name: file.name, blob: file, amount: 0, pending: true });
    renderLeadFiles(tempFiles);
}

function fileBadgeLink(f) {
    const style = "color:var(--primary); font-size:12px; text-decoration:none; font-weight:600;";
    if (f.pending) {
        return `<span style="color:#64748b; font-size:12px; font-weight:600;" title="აიტვირთება შენახვისას">⏳ ${escapeHtml(f.name)}</span>`;
    }
    if (f.path) {
        return `<a href="#" onclick="openStoredFile(event, ${jsArg(f.path)})" style="${style}">📎 ${escapeHtml(f.name)}</a>`;
    }
    return `<a href="${safeFileHref(f.data)}" download="${escapeHtml(f.name)}" style="${style}">📎 ${escapeHtml(f.name)}</a>`;
}

function renderFileBadges(files, removeFn) {
    return files.map((f, i) => `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#e2f0eb; padding:6px 10px; border-radius:6px; border:1px solid #a7d8c6;">
            ${fileBadgeLink(f)}
            <span style="cursor:pointer; color:#ef4444; font-size:14px; font-weight:bold;" onclick="${removeFn}(${i})" title="ფაილის წაშლა">✕</span>
        </div>
    `).join('');
}

function renderLeadFiles(files) {
    const box = document.getElementById('leadFileContainer');
    box.innerHTML = (files && files.length)
        ? renderFileBadges(files, 'removeTempFile')
        : '<span style="font-size:11px; color:#94a3b8">ფაილი არ არის მიმაგრებული</span>';
}

function removeTempFile(index) {
    const removedFile = tempFiles[index];
    if (removedFile && removedFile.amount) {
        const currentAmt = parseFloat(document.getElementById('leadAmount').value) || 0;
        document.getElementById('leadAmount').value = Math.max(0, currentAmt - removedFile.amount).toFixed(2);
    }
    if (removedFile && removedFile.path) removedStoredPaths.push(removedFile.path);
    tempFiles.splice(index, 1);
    renderLeadFiles(tempFiles);
}

function renderComments(historyArr) {
    const box = document.getElementById('leadHistoryBox');
    if (!historyArr || historyArr.length === 0) {
        box.innerHTML = '<span style="color:#94a3b8">კომენტარები არ არის...</span>';
        return;
    }
    const myEmail = currentUser ? currentUser.email : 'Admin';

    box.innerHTML = historyArr.map(h => {
        if (h.author === "სისტემა") {
            return `
            <div style="font-size: 11px; color: var(--text-light); text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
                <i>${escapeHtml(h.text)} (${escapeHtml(h.date)})</i>
            </div>`;
        }

        const cClass = h.author === myEmail ? 'comment-mine' : 'comment-other';
        return `
        <div class="comment-box ${cClass}">
            <div class="comment-meta">
                <b>${escapeHtml(h.author || 'უცნობი მომხმარებელი')}</b>
                <span>${escapeHtml(h.date)}</span>
            </div>
            <div>${escapeHtml(h.text)}</div>
        </div>
        `;
    }).reverse().join('');
}

function addLeadNote() {
    const note = document.getElementById('leadNote').value.trim();
    if (!note) return;
    if (!currentEditingLead) {
        alert("ჯერ შეინახეთ ლიდი და შემდეგ დაამატეთ კომენტარი.");
        return;
    }
    currentEditingLead.history.push({
        date: nowStamp(),
        text: note,
        author: currentUser ? currentUser.email : 'Admin'
    });
    renderComments(currentEditingLead.history);
    document.getElementById('leadNote').value = '';
}

async function saveLead() {
    if (leadSaving) return;
    const id = document.getElementById('leadId').value;
    const data = {
        clinic: document.getElementById('leadClinic').value.trim(),
        contact: document.getElementById('leadContact').value.trim(),
        product: document.getElementById('leadProduct').value.trim(),
        amount: parseFloat(document.getElementById('leadAmount').value) || 0,
        stage: document.getElementById('leadStage').value,
        followUpDate: document.getElementById('leadFollowUp').value,
        updatedAt: new Date().toISOString(),
        fileName: null,
        fileData: null
    };

    const wasLost = !!(currentEditingLead && currentEditingLead.stage === 'closed_lost');
    if (data.stage === 'closed_lost' && !wasLost) {
        // ლიდი „წაგებულში" მხოლოდ მიზეზით გადადის
        if (!leadLostInfo) {
            openLostReasonModal(info => { leadLostInfo = info; leadStagePrev = 'closed_lost'; saveLead(); });
            return;
        }
        Object.assign(data, leadLostInfo);
    } else if (data.stage !== 'closed_lost' && wasLost) {
        data.lostReason = null;
        data.lostComment = null;
    }

    const myEmail = currentUser ? currentUser.email : "";
    const customEmail = document.getElementById('leadManagerEmail').value.trim();
    if (customEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail)) {
        alert("პასუხისმგებელი მენეჯერის ელ-ფოსტა არასწორია.");
        return;
    }
    // ამჟამინდელი მფლობელი (ახალი ლიდისთვის — თავად მომხმარებელი); ცარიელი ველი მფლობელს არ ცვლის
    const prevOwner = (id && currentEditingLead && currentEditingLead.userEmail) || myEmail;
    if (customEmail) data.userEmail = customEmail;
    else if (!id) data.userEmail = myEmail;
    else if (!isAdmin) data.userEmail = prevOwner;

    // არაადმინი ლიდს სხვას გადასცემს: ჯერ ძველი მფლობელით ვინახავთ (ფაილების ატვირთვა/წაშლა Storage-ის წესებით
    // წვდომას მოითხოვს) და მფლობელს ბოლოს ვცვლით
    const transferTo = (!isAdmin && !isLocalMode && data.userEmail !== prevOwner) ? data.userEmail : null;
    if (transferTo) {
        const isCreator = !id || !!(currentEditingLead && currentUser && currentEditingLead.userId === currentUser.uid);
        const after = CREATOR_KEEPS_LEAD_ACCESS && isCreator
            ? 'ლიდი თქვენს დაფაზეც დარჩება (თქვენ შექმენით) და მისი რედაქტირება კვლავ შეგეძლებათ.'
            : 'შენახვის შემდეგ ის თქვენს დაფაზე აღარ გამოჩნდება.';
        if (!confirm(`ლიდი გადაეცემა: ${transferTo}\n\n${after} გავაგრძელოთ?`)) return;
        data.userEmail = prevOwner;
    }

    if (id) {
        data.history = currentEditingLead ? currentEditingLead.history : [];
    } else {
        data.userId = currentUser ? currentUser.uid : "local_user_1";
        data.history = [{ date: nowStamp(), text: "შეიქმნა ლიდი", author: "სისტემა" }];
        data.createdAt = data.updatedAt;
    }

    if (isLocalMode) {
        data.files = tempFiles;
        if (id) {
            updateLeadInDB(id, data).then(closeLeadModal, () => {});
            return;
        }
        data.id = "lead_" + Date.now();
        localLeads.push(data);
        localStorage.setItem('stock_pipeline_leads', JSON.stringify(localLeads));
        closeLeadModal();
        renderPipeline();
        return;
    }

    leadSaving = true;
    let leadId = id;
    let uploadedPaths = [];
    try {
        if (!leadId) {
            // ახალი ლიდი ჯერ ფაილების გარეშე იქმნება: Storage-ის წესები ატვირთვისას ლიდის მფლობელს Firestore-იდან ამოწმებს
            const ref = db.collection("leads").doc();
            await ref.set({ ...data, files: [] });
            leadId = ref.id;
            // განმეორებითი შენახვა (მაგ. ატვირთვის ჩავარდნის შემდეგ) ამ ლიდს განაახლებს და დუბლიკატს არ შექმნის
            document.getElementById('leadId').value = leadId;
            currentEditingLead = { ...data, id: leadId, files: [] };
        }

        const uploaded = await uploadPendingFiles(`leads/${leadId}`, tempFiles);
        uploadedPaths = uploaded.uploadedPaths;
        if (id) {
            await db.collection("leads").doc(leadId).update({ ...data, files: uploaded.files });
        } else if (uploadedPaths.length) {
            await db.collection("leads").doc(leadId).update({ files: uploaded.files });
        }

        if (transferTo) {
            await deleteStoredFiles(removedStoredPaths);
            await db.collection("leads").doc(leadId).update({ userEmail: transferTo });
        } else {
            deleteStoredFiles(removedStoredPaths);
        }
        closeLeadModal();
    } catch (err) {
        deleteStoredFiles(uploadedPaths);
        if (!id && leadId) {
            console.error("ფაილების ატვირთვა ვერ მოხერხდა:", err);
            alert("ლიდი შეინახა, მაგრამ ფაილების ატვირთვა ვერ მოხერხდა: " + (err && err.message ? err.message : err) +
                "\n\nსცადეთ ხელახლა შენახვა.");
        } else {
            reportSaveError(err);
        }
    } finally {
        leadSaving = false;
    }
}

function extractLeadId(inputValue) {
    const match = inputValue.match(/\| ID: (.*)$/);
    return match ? match[1] : null;
}

/* ---------- ინვოისის / შეთავაზების / შეკვეთის ლიდზე მიბმა ---------- */
// amount: რიცხვითი ჯამი (არა ეკრანიდან წაკითხული ტექსტი, რომელიც ქართულ ფორმატში "1234,50" ჩანს)
async function attachDocumentToLead({ inputId, printAreaId, filePrefix, amount, historyText, emptyMsg, successMsg, onDone }) {
    const leadId = extractLeadId(document.getElementById(inputId).value);
    if (!leadId) { alert(emptyMsg); return; }

    const lead = leadsData.find(l => l.id === leadId);
    if (!lead) { alert("ლიდი ვერ მოიძებნა. განაახლეთ სია და სცადეთ თავიდან."); return; }

    const name = `${filePrefix}_${localISODate()}_${Date.now()}.html`;
    // მიმაგრებულ ასლში, PDF-ის მსგავსად, არ ხვდება მხოლოდ ეკრანისთვის განკუთვნილი სვეტები/ღილაკები (კოდი, მარჟა, წაშლა)
    const snapshot = document.getElementById(printAreaId).cloneNode(true);
    snapshot.querySelectorAll('.hide-on-pdf').forEach(el => el.remove());
    snapshot.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    const html = snapshot.innerHTML;
    let file;
    try {
        file = isLocalMode
            ? { name, data: "data:text/html;charset=utf-8," + encodeURIComponent(html), amount }
            : { ...(await uploadToStorage(`leads/${leadId}`, name, new Blob([html], { type: 'text/html;charset=utf-8' }))), amount };
    } catch (err) {
        reportSaveError(err);
        return;
    }
    const fields = {
        amount: (parseFloat(lead.amount) || 0) + amount,
        files: [...(lead.files || []), file],
        history: [...(lead.history || []), {
            date: nowStamp(),
            text: historyText,
            author: currentUser ? currentUser.email : "სისტემა"
        }],
        updatedAt: new Date().toISOString()
    };
    updateLeadInDB(leadId, fields).then(() => {
        alert(successMsg);
        onDone();
    }, () => {
        if (file.path) deleteStoredFiles([file.path]);
    });
}

function attachInvoiceToLead() {
    attachDocumentToLead({
        inputId: 'invoiceLeadTarget', printAreaId: 'invoicePrintArea', filePrefix: 'ინვოისი',
        amount: calcTotal,
        historyText: `მიმაგრდა ახალი ინვოისი/კომერციული შეთავაზება (თანხა დაემატა: ${calcTotal} ₾)`,
        emptyMsg: "გთხოვთ აირჩიოთ ლიდი სიიდან!",
        successMsg: "ინვოისი/კომერციული შეთავაზება წარმატებით მიმაგრდა არჩეულ ლიდს და თანხა დაჯამდა!",
        onDone: closeInvoice
    });
}

function attachOrderToLead() {
    attachDocumentToLead({
        inputId: 'orderLeadTarget', printAreaId: 'orderPrintArea', filePrefix: 'შეკვეთა',
        amount: 0, // შეკვეთა მოგებულ ლიდზეა — თანხა უკვე დათვლილია
        historyText: `მიმაგრდა ახალი შეკვეთა`,
        emptyMsg: "გთხოვთ აირჩიოთ მოგებული ლიდი სიიდან!",
        successMsg: "შეკვეთა წარმატებით მიმაგრდა არჩეულ მოგებულ ლიდს!",
        onDone: closeOrderModal
    });
}
