/* ==========================================
   📈 ANALYTICS & CHARTS LOGIC
   ========================================== */
let conversionChartInstance = null;
let managerChartInstance = null;

function openAnalytics() {
    document.getElementById('analyticsModal').style.display = 'flex';
    // დეფოლტად ვირჩევთ მიმდინარე თვეს, თუ არ არის არჩეული
    if (!document.getElementById('analyticsMonthFilter').value) {
        document.getElementById('analyticsMonthFilter').value = localISOMonth();
    }
    renderAnalytics();
}

function closeAnalytics() {
    document.getElementById('analyticsModal').style.display = 'none';
}

function renderAnalytics() {
    const monthVal = document.getElementById('analyticsMonthFilter').value;
    let filteredLeads = leadsData;

    // თვის ფილტრი
    if (monthVal) {
        filteredLeads = filteredLeads.filter(l => {
            const targetDate = l.createdAt || l.updatedAt || '';
            return targetDate.startsWith(monthVal);
        });
    }

    // 1. ციფრული მონაცემების დათვლა
    const totalLeads = filteredLeads.length;
    const wonLeads = filteredLeads.filter(l => l.stage === 'closed_won');
    const lostLeads = filteredLeads.filter(l => l.stage === 'closed_lost');
    const activeLeadsCount = totalLeads - wonLeads.length - lostLeads.length;

    const totalAmount = filteredLeads.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const wonAmount = wonLeads.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

    // ზედა შემაჯამებელი ბლოკის განახლება
    document.getElementById('analyticsSummary').innerHTML = `
        <div class="summary-card" style="flex:1"><div class="summary-val">${totalLeads}</div><div class="summary-label">ახალი ლიდი თვეში</div></div>
        <div class="summary-card" style="flex:1"><div class="summary-val" style="color:#1D9E75;">${wonLeads.length}</div><div class="summary-label">მოგებული (რაოდ.)</div></div>
        <div class="summary-card" style="flex:1"><div class="summary-val" style="color:#ef4444;">${lostLeads.length}</div><div class="summary-label">წაგებული (რაოდ.)</div></div>
        <div class="summary-card" style="flex:1"><div class="summary-val" style="color:#3b82f6;">${totalAmount.toLocaleString('ka-GE')} ₾</div><div class="summary-label">ჯამური პოტენციალი</div></div>
        <div class="summary-card" style="flex:1"><div class="summary-val" style="color:#1D9E75;">${wonAmount.toLocaleString('ka-GE')} ₾</div><div class="summary-label">მოგებული თანხა</div></div>
    `;

    // 2. კონვერსიის ჩარტი (Doughnut)
    const convCtx = document.getElementById('conversionChart').getContext('2d');
    if (conversionChartInstance) conversionChartInstance.destroy();
    conversionChartInstance = new Chart(convCtx, {
        type: 'doughnut',
        data: {
            labels: ['✅ მოგებული', '❌ წაგებული', '⏳ პროცესში'],
            datasets: [{
                data: [wonLeads.length, lostLeads.length, activeLeadsCount],
                backgroundColor: ['#1D9E75', '#ef4444', '#3b82f6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // აუცილებელია კონტეინერის ზომის მოსარგებად
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });

    // 3. მენეჯერების შედეგების დათვლა და ათასებში (k) გადაყვანა
    let managerStats = {};
    filteredLeads.forEach(l => {
        let mgr = l.userEmail || 'უცნობი';
        let shortMgr = mgr.split('@')[0];

        if (!managerStats[shortMgr]) managerStats[shortMgr] = { won: 0, pipeline: 0, lost: 0 };

        let amt = parseFloat(l.amount) || 0;
        if (l.stage === 'closed_won') managerStats[shortMgr].won += amt;
        else if (l.stage === 'closed_lost') managerStats[shortMgr].lost += amt;
        else managerStats[shortMgr].pipeline += amt;
    });

    const labels = Object.keys(managerStats);

    const wonData = labels.map(m => Math.round(managerStats[m].won / 100) / 10);
    const pipeData = labels.map(m => Math.round(managerStats[m].pipeline / 100) / 10);
    const lostData = labels.map(m => Math.round(managerStats[m].lost / 100) / 10);

    // 4. მენეჯერების ჩარტი (Bar)
    const mgrCtx = document.getElementById('managerChart').getContext('2d');
    if (managerChartInstance) managerChartInstance.destroy();
    managerChartInstance = new Chart(mgrCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'მოგებული', data: wonData, backgroundColor: '#1D9E75' },
                { label: 'პროცესში', data: pipeData, backgroundColor: '#3b82f6' },
                { label: 'წაგებული', data: lostData, backgroundColor: '#ef4444' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // აუცილებელია კონტეინერის ზომის მოსარგებად
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return value + 'k'; }
                    }
                }
            },
            datasets: {
                bar: {
                    maxBarThickness: 35 // ზღუდავს სვეტის მაქსიმალურ სისქეს
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' ათასი ₾';
                        }
                    }
                }
            }
        }
    });
}
