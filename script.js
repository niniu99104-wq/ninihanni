// 請務必更新成妳重新部署後的新網址！
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbyk5zgLaixBmVBwG_uICcFFq4wk6PqjD1APKqyO8TjsUnQ6KzWfS8YFlIXiDHddeker/exec";

let currentType = '支出', currentLedger = 'TWD';
let systemBalances = {}; // 儲存從試算表抓回來的「系統餘額」

document.getElementById('date').valueAsDate = new Date();

// --- 1. 底氣看板：抓取資料 ---
async function fetchDashboard() {
    try {
        const res = await fetch(`${GOOGLE_API_URL}?action=getDashboard`);
        const data = await res.json();
        systemBalances = data.accounts; // 存入全域變數供對帳使用
        
        document.getElementById('dash-netcash').innerText = `$${data.netCash}`;
        document.getElementById('dash-assets').innerText = `$${data.totalAsset}`;
        document.getElementById('dash-debt').innerText = `$${data.debt}`;
        
        // 如果目前校正框有數字，觸發一次比對邏輯
        calculateDiff();
    } catch (e) {
        document.getElementById('dash-netcash').innerText = '連線失敗';
    }
}

// --- 2. 抓帳比對邏輯 ---
function calculateDiff() {
    const acc = document.getElementById('quickAccount').value;
    const actualInput = document.getElementById('quickAmount').value;
    const msg = document.getElementById('quick-msg');
    
    if (!actualInput) {
        msg.innerText = "";
        return;
    }
    
    const actual = parseFloat(actualInput) || 0;
    const system = systemBalances[acc] || 0;
    const diff = actual - system;
    
    if (diff === 0) {
        msg.innerHTML = "✅ 與系統相符，帳目正確！";
    } else {
        const color = diff > 0 ? "blue" : "red";
        msg.innerHTML = `⚠️ 差額：<span style="color:${color}; font-weight:bold;">${diff > 0 ? '+' : ''}${diff}</span> (請確認是否有漏記)`;
    }
}

// 綁定輸入事件，讓妳打字時就自動算差額
document.getElementById('quickAmount').addEventListener('input', calculateDiff);
document.getElementById('quickAccount').addEventListener('change', calculateDiff);

// --- 3. 執行餘額校正 ---
async function updateWaterBalance() {
    const acc = document.getElementById('quickAccount').value;
    const amt = document.getElementById('quickAmount').value;
    const msg = document.getElementById('quick-msg');
    
    if (!amt) return;
    
    msg.innerText = "同步更新中...";
    try {
        await fetch(`${GOOGLE_API_URL}?action=updateBalance&accountName=${encodeURIComponent(acc)}&amount=${amt}`);
        msg.innerText = "✅ 水位已校正完畢！";
        document.getElementById('quickAmount').value = '';
        fetchDashboard(); // 更新完重新抓一次數字
    } catch (e) {
        msg.innerText = "❌ 更新失敗";
    }
}

// --- 4. 原有的記帳類別邏輯 (不變) ---
const categoryMap = {
    '支出': {
        '變動支出': ['娛樂費', '交通費', '線上購物', '實體購物', '早餐/午餐/晚餐', '點心/宵夜/飲料'],
        '固定支出': ['房租', '瓦斯費', '電信費', '燃料費', '債務還款', 'APP訂閱', '水費/電費', '保險(小孩)', '保險(大人)', '汽機車牌照稅'],
        '小孩支出': ['尿布', '健康', '娛樂', '學雜費'],
        '甜點支出': ['運費', '手續費', '包材進貨', '材料進貨'],
        '選品支出 (零售)': ['手續費', '選品進貨', '藍新沖銷', '國際運費', '國內運費', '斷貨退款', '活動購物金'],
        '代理支出 (批發)': ['成本', '代墊款', '斷貨退款', '國際運費', '國內運費', '批發儲值(台幣)']
    },
    '收入': {
        '個人收入': ['一般', '沐光毓師資', '沐光毓小幫手'],
        '甜點收入': ['實體門市', '私訊訂購', '表單訂購', 'PAYUNi 入帳'],
        '選品收入 (零售)': ['現貨出清', '記事本收款', 'EasyStore 訂單'],
        '代理收入 (批發)': ['倉庫整理費', '代墊款回收', '國際運費收回', '國內運費收回']
    }
};

function setLedger(l) { 
    currentLedger = l; 
    document.getElementById('tab-twd').className = l === 'TWD' ? 'ledger-tab active-twd' : 'ledger-tab';
    document.getElementById('tab-krw').className = l === 'KRW' ? 'ledger-tab active-krw' : 'ledger-tab';
    setType('支出'); 
}

function setType(t) { 
    currentType = t; 
    document.getElementById('btn-expense').className = t==='支出'?'radio-btn active-expense':'radio-btn';
    document.getElementById('btn-income').className = t==='收入'?'radio-btn active-income':'radio-btn';
    
    if (currentLedger === 'TWD') {
        document.getElementById('subTypeGroup').style.display = 'block';
        const subs = Object.keys(categoryMap[t]);
        document.getElementById('subType').innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
        updateCategories(); 
    } else {
        document.getElementById('subTypeGroup').style.display = 'none';
        document.getElementById('category').innerHTML = t === '支出' ? '<option value="代理下單">代理下單</option>' : '<option value="儲值">儲值</option>';
        document.getElementById('account').innerHTML = '<option value="批發網點數">批發網點數</option>';
    }
}

function updateCategories() {
    if (currentLedger === 'KRW') return;
    const sub = document.getElementById('subType').value;
    const cats = categoryMap[currentType][sub];
    document.getElementById('category').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    updateAccounts();
}

function updateAccounts() {
    if (currentLedger === 'KRW') return;
    const sub = document.getElementById('subType').value;
    const cat = document.getElementById('category').value;
    const isES = (cat === 'EasyStore 訂單');
    const isPayUni = (cat === 'PAYUNi 入帳');
    
    let list = ['現金', '信用卡', 'Line Pay', 'iPass Money', '銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)'];
    
    if (isPayUni) list = ['銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)'];
    else if (isES) list = ['Line Pay', '藍新待撥款', '銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)'];
    else if (cat === '記事本收款') list = ['Line Pay', 'iPass Money', '銀行轉帳 (台新銀行)'];
    else if (cat === '藍新沖銷') list = ['銀行轉帳 (中國信託)'];
    else if (cat === '活動購物金') list = ['ES購物金'];
    
    if (currentType === '收入' || sub.includes('代理')) list = list.filter(i => i !== '信用卡');
    list.sort((a, b) => a.length - b.length);
    document.getElementById('account').innerHTML = list.map(a => `<option value="${a}">${a}</option>`).join('');
    updateFields();
}

function updateFields() {
    const cat = document.getElementById('category').value;
    const isES = (cat === 'EasyStore 訂單');
    const isPayUni = (cat === 'PAYUNi 入帳');
    
    document.getElementById('esFields').style.display = isES ? 'block' : 'none';
    document.getElementById('payuniAutoFields').style.display = isPayUni ? 'block' : 'none';
    document.getElementById('logisticsGroup').style.display = (currentType === '支出' && (cat === '國內運費' || cat === '運費')) ? 'block' : 'none';
    document.getElementById('mainAmountLabel').innerText = isPayUni ? "銀行實收金額" : (isES ? "商品原價" : "金額");
}

// --- 5. 記帳表單提交 (提交後會自動更新看板) ---
document.getElementById('form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const mainAmt = parseInt(document.getElementById('amount').value.replace(/\D/g,'')) || 0;
    const creditAmt = parseInt(document.getElementById('creditAmount').value.replace(/\D/g,'')) || 0;
    const shipAmt = parseInt(document.getElementById('shippingAmount').value.replace(/\D/g,'')) || 0;
    const pShip = parseInt(document.getElementById('payuniShip').value.replace(/\D/g,'')) || 0;
    let note = document.getElementById('note').value;
    
    const sub = currentLedger === 'KRW' ? '批發網(韓幣)' : document.getElementById('subType').value;
    const cat = document.getElementById('category').value;
    const acc = document.getElementById('account').value;
    const date = document.getElementById('date').value;
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; 
    document.getElementById('loading').style.display = 'block';
    
    const send = async (d, t, st, c, a, am, n) => { 
        await fetch(`${GOOGLE_API_URL}?action=add&date=${d}&type=${t}&subType=${st}&category=${c}&account=${a}&amount=${am}&note=${encodeURIComponent(n)}`); 
    };
    
    try {
        // ... (這裡保留妳原本的 PAYUNi 和 EasyStore 拆單邏輯)
        if (cat === 'PAYUNi 入帳') {
            const estFee = Math.round(mainAmt * 0.02);
            const totalIncome = mainAmt + pShip + estFee;
            const splitNote = `[PAYUNi撥款實結: 實收${mainAmt}/扣運${pShip}/估手續${estFee}] ${note}`;
            await send(date, '收入', sub, cat, acc, totalIncome, splitNote);
            if (pShip > 0) await send(date, '支出', '甜點支出', '運費', acc, pShip, `(PAYUNi扣運)${note}`);
            await send(date, '支出', '甜點支出', '手續費', acc, estFee, `(PAYUNi估手續)${note}`);
        } else if (cat === 'EasyStore 訂單') {
            const paidAmt = mainAmt + shipAmt - creditAmt;
            const esNote = `[商${mainAmt}/運${shipAmt}${creditAmt?'/折'+creditAmt:''}] ${note}`;
            await send(date, '收入', sub, cat, acc, paidAmt, esNote);
            if (creditAmt > 0) await send(date, '收入', sub, cat, 'ES購物金', creditAmt, `(點數)${esNote}`);
        } else {
            let finalNote = note;
            if (document.getElementById('logisticsGroup').style.display === 'block') {
                finalNote = `[${document.getElementById('logistics').value}] ${note}`;
            }
            await send(date, currentType, sub, cat, acc, mainAmt, finalNote);
        }
        
        alert("記帳完畢！看板更新中..."); 
        fetchDashboard(); // 提交完順便更新看板水位
        document.getElementById('amount').value = '';
        document.getElementById('note').value = '';
    } catch (err) { 
        alert("失敗"); 
    } finally { 
        btn.disabled = false; 
        document.getElementById('loading').style.display = 'none';
    }
});

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    fetchDashboard();
    setLedger('TWD');
});
