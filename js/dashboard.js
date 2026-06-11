import { supabase } from "./supabase.js";

const transactionForm = document.getElementById("transaction-form");
const txTypeInput = document.getElementById("tx-type");
const txCategoryInput = document.getElementById("tx-category");
const txAmountInput = document.getElementById("tx-amount");
const txDateInput = document.getElementById("tx-date");
const txDescInput = document.getElementById("tx-desc");

document.addEventListener('DOMContentLoaded', async () => {
    
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('user-email').textContent = user.email;

    await fetchTransactions(); 
    await fetchBudgets();

    // Хуучин гүйлгээтэй хэрэглэгчид тэмдэг шалгана (toast харуулахгүй)
    await checkAndAwardBadges(user, false);
    await fetchBadges();
    
});

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = txTypeInput.value;
    const category = txCategoryInput.value;
    const amount = parseFloat(txAmountInput.value); 
    const date = txDateInput.value;
    const description = txDescInput.value;

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
        window.location.href = 'index.html';
        return;
    }

    // 1. ЗӨВХӨН ЗАРЛАГЫН ҮЕД ТӨСӨВ ШАЛГАХ
    if (type === 'expense') {
        const currentMonthYear = date.substring(0, 7);

        const { data: budgetRows } = await supabase
            .from('budgets')
            .select('limit_amount')
            .eq('user_id', user.id)
            .eq('category', category)
            .eq('month_year', currentMonthYear)
            .limit(1);

        const budgetData = budgetRows && budgetRows.length > 0 ? budgetRows[0] : null;

        if (budgetData) {
            const limitAmount = budgetData.limit_amount;

            const { data: pastExpenses } = await supabase
                .from('transactions')
                .select('amount, date')
                .eq('user_id', user.id)
                .eq('type', 'expense')
                .eq('category', category);
            
            let totalPastExpense = 0;
            if (pastExpenses) {
                pastExpenses.forEach(tx => {
                    if (tx.date && tx.date.substring(0, 7) === currentMonthYear) {
                        totalPastExpense += parseFloat(tx.amount);
                    }
                });
            }

            const currentTotal = totalPastExpense + amount;

            // ХЭТЭРСЭН БОЛ АНХААРУУЛГА ГАРГАХ
            if (currentTotal > limitAmount) {
                const proceed = confirm(
                    `АНХААРУУЛГА!\n\nТаны ${currentMonthYear} сарын "${category}" ангиллын төсвийн хязгаар: ${limitAmount.toLocaleString()} ₮\nОдоогийн нийт зарцуулалт: ${currentTotal.toLocaleString()} ₮ болох гэж байна.\n\nТөсөв хэтрүүлж гүйлгээг үргэлжлүүлэх үү?`
                );
                
                // Хэрэв үргэлжлүүлэхгүй бол функцээс энд зогсоно
                if (!proceed) {
                    return; 
                }
            }
        }
    }

    // 2. ДЭЭРХ АНХААРУУЛГА ДЭЭР "OK" ДАРСАН БОЛ ГҮЙЛГЭЭГ ХАДГАЛНА
    const { error } = await supabase
        .from('transactions')
        .insert([{
            user_id: user.id,
            type: type,
            category: category,
            amount: amount,
            description: description,
            date: date
        }]);

    if (error) {
        alert("Гүйлгээг хадгалахад алдаа гарлаа: " + error.message);
    } else {
        // ЭНД ХАДГАЛСАН ДАРААХ МЭДЭГДЭЛ ГАРНА
        alert("Гүйлгээ амжилттай бүртгэгдлээ!");
        transactionForm.reset();
        await fetchTransactions();

        // 3. ТЭМДЭГ ШАЛГАХ (Төсөв хэтэрсэн бол Мастер тэмдэг устгагдах логик энд ажиллана)
        await checkAndAwardBadges(user, true);
        await fetchBadges();
    }
});

async function fetchTransactions() {
    
    const { data: { user } } = await supabase.auth.getUser();
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error("Гүйлгээ ушшихад алдаа гарлаа:", error.message);
        return;
    }

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
            totalExpense += tx.amount;
        }
    });

    const totalBalance = totalIncome - totalExpense;

    document.getElementById('total-balance').textContent = `${totalBalance.toLocaleString()} ₮`;
    document.getElementById('total-income').textContent = `${totalIncome.toLocaleString()} ₮`;
    document.getElementById('total-expense').textContent = `${totalExpense.toLocaleString()} ₮`;

    renderTransactions(transactions);
}

function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');

    if (transactions.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fa-solid fa-folder-open fs-3 d-block mb-2"></i>
                    Одоогоор ямар нэгэн гүйлгээ бүртгэгдээгүй байна.
                </td>
            </tr>
        `;
        return;
    }

    let htmlContent = '';

    transactions.forEach(tx => {
        const isIncome = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date}</td>
                <td><span class="badge bg-light text-dark shadow-sm border">${tx.category}</span></td>
                <td class="text-secondary fw-medium">${tx.description}</td>
                <td><span class="badge ${badgeColor}">${typeText}</span></td>
                <td class="text-end fw-bold ${amountColor}">${amountSign}${tx.amount.toLocaleString()} ₮</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    listContainer.innerHTML = htmlContent;
}

fetchTransactions();


window.deleteTransaction = async function(id) {
    const confirmDelete = confirm("Та энэ гүйлгээг устгахдаа итгэлтэй байна уу?");
    
    if (!confirmDelete) {
        return;
    }

    try {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }

        alert("Гүйлгээ амжилттай устгагдлаа.");
        fetchTransactions();

    } catch (error) {
        alert("Гүйлгээ устгахад алдаа гарлаа: " + error.message);
        console.error("Устгах үеийн алдаа:", error);
    }
}

const btnLogout = document.getElementById('btn-logout');

btnLogout.addEventListener('click', async () => {
    const confirmLogout = confirm("Та системээс гарахдаа итгэлтэй байна уу?");
    
    if (!confirmLogout) {
        return;
    }

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href = 'index.html';

    } catch (error) {
        alert("Системээс гарахад алдаа гарлаа: " + error.message);
        console.error("Logout алдаа:", error);
    }
});


// --- ТӨСӨВ ТОГТООХ ФОРМЫН ЛОГИК ---
const budgetForm = document.getElementById('budget-form');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetMonthInput = document.getElementById('budget-month');

budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = budgetCategoryInput.value;
    const limitAmount = parseFloat(budgetAmountInput.value);
    const monthYear = budgetMonthInput.value; 

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Сешн дууссан байна!");
        return;
    }

    const { error } = await supabase
        .from('budgets')
        .insert([
            {
                user_id: user.id,
                category: category,
                limit_amount: limitAmount,
                month_year: monthYear
            }
        ]);

    if (error) {
        alert("Төсөв тогтооход алдаа гарлаа: " + error.message);
    } else {
        alert(`${monthYear} сарын ${category} ангилалд төсөв амжилттай тогтоогдлоо!`);
        budgetForm.reset();
        
        const instance = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasBudget'));
        if (instance) instance.hide();
        
        if (typeof fetchBudgets === 'function') fetchBudgets();
    }
});

async function fetchBudgets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('month_year', { ascending: false });

    if (error) {
        console.error("Төсөв уншихад алдаа гарлаа:", error.message);
        return;
    }

    const budgetsContainer = document.getElementById('current-budgets-list');
    
    if (!budgets || budgets.length === 0) {
        budgetsContainer.innerHTML = `
            <h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>
            <div class="text-center py-3 text-muted small bg-light rounded">Одоогоор төсөв тогтоогоогүй байна.</div>
        `;
        return;
    }

    let htmlContent = `<h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>`;
    
    budgets.forEach(b => {
        htmlContent += `
            <div class="card p-2 mb-2 bg-light border-0 shadow-sm">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="fw-bold small text-dark">${b.category}</span>
                        <span class="text-muted mx-1">•</span>
                        <span class="small text-secondary">${b.month_year}</span>
                    </div>
                    <span class="fw-bold text-primary small">${b.limit_amount.toLocaleString()} ₮</span>
                </div>
            </div>
        `;
    });

    budgetsContainer.innerHTML = htmlContent;
}


// ============================================================
// ТЭМДЭГИЙН СИСТЕМ (BADGE SYSTEM)
// ============================================================

// Тэмдэг аль хэдийн авсан эсэхийг шалгах
async function hasBadge(userId, badgeName) {
    const { data } = await supabase
        .from('badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_name', badgeName)
        .limit(1);
    return data && data.length > 0;
}

// Тэмдэг олгох
async function awardBadge(userId, badgeName, showToast = true) {
    const alreadyHas = await hasBadge(userId, badgeName);
    if (alreadyHas) return false;

    const { error } = await supabase
        .from('badges')
        .insert([{ user_id: userId, badge_name: badgeName }]);

    if (!error) {
        if (showToast) showBadgeToast(badgeName);
        return true;
    }
    return false;
}

// Тэмдэг авсан үед popup мэдэгдэл харуулах
function showBadgeToast(badgeName) {
    const badgeInfo = {
        'Анхны бүртгэл': { icon: '🎉', desc: 'Анхны гүйлгээгээ амжилттай бүртгэлээ!' },
        'Мастер':        { icon: '🏆', desc: 'Сарын төсвөө хэтрүүлэлгүй барьж чадлаа!' },
        'Хэмнэгч':       { icon: '💰', desc: 'Зарлага нийт орлогын 50%-аас бага байлаа!' },
    };

    const info = badgeInfo[badgeName] || { icon: '⭐', desc: '' };

    // Toast элемент үүсгэх
    const toastEl = document.createElement('div');
    toastEl.className = 'badge-toast';
    toastEl.innerHTML = `
        <div class="badge-toast-icon">${info.icon}</div>
        <div>
            <div class="badge-toast-title">Шинэ тэмдэг авлаа!</div>
            <div class="badge-toast-name">${badgeName}</div>
            <div class="badge-toast-desc">${info.desc}</div>
        </div>
    `;

    document.body.appendChild(toastEl);

    // 0.1 секундын дараа харагдуулах (CSS transition-д зориулж)
    setTimeout(() => toastEl.classList.add('show'), 100);

    // 4 секундын дараа арилгах
    setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.remove(), 500);
    }, 4000);
}

// Бүх тэмдгийн нөхцөлийг шалгах үндсэн функц
async function checkAndAwardBadges(user, showToast = true) {
    const userId = user.id;

    // 1. "Анхны бүртгэл" тэмдэг — нийт гүйлгээний тоог шалгах
    const { count: txCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (txCount >= 1) {
        await awardBadge(userId, 'Анхны бүртгэл', showToast);
    }

    // Одоогийн сар
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Энэ сарын гүйлгээнүүдийг татах
    const { data: thisMonthTx } = await supabase
        .from('transactions')
        .select('type, amount, date, category')
        .eq('user_id', userId);

    const monthTx = (thisMonthTx || []).filter(tx => tx.date && tx.date.substring(0, 7) === currentMonthYear);

    let monthIncome = 0;
    let monthExpense = 0;
    monthTx.forEach(tx => {
        if (tx.type === 'income') monthIncome += parseFloat(tx.amount);
        if (tx.type === 'expense') monthExpense += parseFloat(tx.amount);
    });

    // 2. "Хэмнэгч" тэмдэг — зарлага орлогын 50%-аас бага
    if (monthIncome > 0 && monthExpense < monthIncome * 0.5) {
        await awardBadge(userId, 'Хэмнэгч', showToast);
    }

    // 3. "Мастер" тэмдэг — энэ сарын бүх төсвийн ангилал хэтрээгүй эсэхийг шалгах
    const { data: budgets } = await supabase
        .from('budgets')
        .select('category, limit_amount')
        .eq('user_id', userId)
        .eq('month_year', currentMonthYear);

    if (budgets && budgets.length > 0) {
        let allUnderBudget = true;

        for (const budget of budgets) {
            const spent = monthTx
                .filter(tx => tx.type === 'expense' && tx.category === budget.category)
                .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

            if (spent > budget.limit_amount) {
                allUnderBudget = false;
                break;
            }
        }

        if (allUnderBudget) {
            await awardBadge(userId, 'Мастер', showToast);
        }
    }
}

// Хэрэглэгчийн авсан тэмдгүүдийг татаж харуулах
async function fetchBadges() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: badges, error } = await supabase
        .from('badges')
        .select('*')
        .eq('user_id', user.id)
        .order('awarded_at', { ascending: false });

    if (error) {
        console.error("Тэмдэг уншихад алдаа:", error.message);
        return;
    }

    renderBadges(badges || []);
}

const ALL_BADGES = [
    { name: 'Анхны бүртгэл', icon: '🎉', desc: 'Анхны гүйлгээгээ бүртгэсэн' },
    { name: 'Мастер',        icon: '🏆', desc: 'Сарын төсвөө хэтрүүлэлгүй барьсан' },
    { name: 'Хэмнэгч',       icon: '💰', desc: 'Зарлага орлогын 50%-аас бага байсан' },
];

function renderBadges(earnedBadges) {
    const container = document.getElementById('badges-container');
    if (!container) return;

    const earnedNames = earnedBadges.map(b => b.badge_name);

    let html = '';
    ALL_BADGES.forEach(badge => {
        const earned = earnedNames.includes(badge.name);
        html += `
            <div class="badge-card ${earned ? 'earned' : 'locked'}" title="${badge.desc}">
                <div class="badge-card-icon">${earned ? badge.icon : '🔒'}</div>
                <div class="badge-card-name">${badge.name}</div>
                <div class="badge-card-desc">${badge.desc}</div>
                ${earned ? '<div class="badge-card-status text-success">✓ Авсан</div>' : '<div class="badge-card-status text-muted">Аваагүй</div>'}
            </div>
        `;
    });

    container.innerHTML = html;
}
