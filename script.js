/* --- 常數與狀態 --- */
const CATEGORIES = ['工作', '學習', '生活', '運動', '娛樂'];
const LOCATIONS = ['家', '公司', '學校', '圖書館', '咖啡廳', '戶外'];
const STORAGE_KEY = 'dailyPlannerData';
const HISTORY_KEY = 'dailyPlannerHistory';

// 分類顏色（用於後台長條圖）
const CATEGORY_COLORS = {
    '工作': '#3b82f6',
    '學習': '#10b981',
    '生活': '#f59e0b',
    '運動': '#ef4444',
    '娛樂': '#8b5cf6'
};
const DEFAULT_CATEGORY_COLOR = '#94a3b8';

// DOM 元素
const tasksContainer = document.getElementById('tasksContainer');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskCounter = document.getElementById('taskCounter');
const themeToggleBtn = document.getElementById('themeToggle');
const finishDayBtn = document.getElementById('finishDayBtn');
const lockedBanner = document.getElementById('lockedBanner');

const mainView = document.getElementById('mainView');
const adminView = document.getElementById('adminView');
const adminBtn = document.getElementById('adminBtn');
const backBtn = document.getElementById('backBtn');
const dailyList = document.getElementById('dailyList');

let appData = { date: '', isLocked: false, tasks: [] };

/* =========================================================
   自訂 UI：Toast 與確認彈窗
   ========================================================= */

/* ---------- Toast ---------- */
const toastContainer = document.getElementById('toastContainer');

const showToast = (message, type = 'info', duration = 3600) => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    let removed = false;
    const remove = () => {
        if (removed) return;
        removed = true;
        toast.classList.add('is-hiding');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        setTimeout(() => toast.remove(), 400);
    };

    toast.addEventListener('click', remove);
    const timer = setTimeout(remove, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => setTimeout(remove, 1200));

    return remove;
};

/* ---------- 確認彈窗 ---------- */
const modalOverlay = document.getElementById('confirmModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCancelBtn = document.getElementById('modalCancel');
const modalConfirmBtn = document.getElementById('modalConfirm');

let modalResolve = null;
let lastFocusedEl = null;

const ICON_CONFIRM = '<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>';
const ICON_WARN = '<svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>';

const resolveModal = (result) => {
    if (!modalResolve) return;
    const resolve = modalResolve;
    modalResolve = null;

    modalOverlay.classList.remove('is-open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalKeydown);

    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
    }
    lastFocusedEl = null;

    resolve(result);
};

const handleModalKeydown = (e) => {
    if (!modalResolve) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        resolveModal(false);
        return;
    }

    if (e.key === 'Tab') {
        const focusables = [modalCancelBtn, modalConfirmBtn];
        const idx = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const nextIdx = e.shiftKey
            ? (idx <= 0 ? focusables.length - 1 : idx - 1)
            : (idx === focusables.length - 1 ? 0 : idx + 1);
        focusables[nextIdx].focus();
    }
};

const showConfirm = ({
    title = '確認',
    message = '',
    confirmText = '確定',
    cancelText = '取消',
    danger = false,
    warning = false
} = {}) => {
    return new Promise((resolve) => {
        if (modalResolve) resolveModal(false);

        modalResolve = resolve;
        lastFocusedEl = document.activeElement;

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;
        modalConfirmBtn.classList.toggle('is-danger', danger);
        modalIcon.innerHTML = warning ? ICON_WARN : ICON_CONFIRM;
        modalIcon.style.color = warning ? 'var(--error-color)' : 'var(--success-color)';

        document.body.style.overflow = 'hidden';
        modalOverlay.classList.add('is-open');
        modalOverlay.setAttribute('aria-hidden', 'false');

        document.addEventListener('keydown', handleModalKeydown);

        requestAnimationFrame(() => modalConfirmBtn.focus());
    });
};

modalConfirmBtn.addEventListener('click', () => resolveModal(true));
modalCancelBtn.addEventListener('click', () => resolveModal(false));
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) resolveModal(false);
});

/* =========================================================
   日期工具
   ========================================================= */
const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getTodayString = () => formatDate(new Date());

const parseDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const addDays = (dateStr, days) => {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() + days);
    return formatDate(date);
};

/** 取得該日期所屬週的星期一日期字串 */
const getWeekStart = (dateStr) => {
    const date = parseDate(dateStr);
    const day = date.getDay(); // 0=日, 1=一, ...
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return formatDate(date);
};

const formatDateDisplay = (dateStr) => {
    const date = parseDate(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (週${weekdays[date.getDay()]})`;
};

const formatMinutes = (mins) => {
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h${m}min`;
};

/* =========================================================
   資料存取（當日 + 歷史）
   ========================================================= */
const loadData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const todayStr = getTodayString();

    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.date === todayStr) {
                appData = parsed;
                return;
            }
        } catch (e) {
            console.error("解析本地資料失敗", e);
        }
    }

    appData = { date: todayStr, isLocked: false, tasks: [] };
    for (let i = 0; i < 3; i++) {
        addTaskToData();
    }
    saveData();
};

const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
};

const loadHistory = () => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return {};
    try {
        return JSON.parse(saved) || {};
    } catch (e) {
        console.error("解析歷史資料失敗", e);
        return {};
    }
};

const saveHistory = (history) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

/** 將目前這一天（已鎖定）的快照同步至歷史紀錄 */
const syncCurrentDayToHistory = () => {
    if (!appData.isLocked) return;
    if (!appData.tasks || appData.tasks.length === 0) return;

    const history = loadHistory();
    history[appData.date] = {
        date: appData.date,
        tasks: appData.tasks.map((t) => ({ ...t })),
        lockedAt: (history[appData.date] && history[appData.date].lockedAt) || Date.now()
    };
    saveHistory(history);
};

/* --- 主題切換 --- */
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
};

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

/* =========================================================
   任務渲染
   ========================================================= */
const generateOptions = (options, selectedValue) => {
    return `<option value="" disabled ${!selectedValue ? 'selected' : ''}>請選擇</option>` +
           options.map(opt => `<option value="${opt}" ${opt === selectedValue ? 'selected' : ''}>${opt}</option>`).join('');
};

const createTaskHTML = (task, index) => {
    const lockedClass = appData.isLocked ? 'locked' : '';
    const checkedAttr = task.completed ? 'checked' : '';
    const completedClass = task.completed ? 'is-completed' : '';
    const checkboxDisabled = appData.isLocked ? '' : 'disabled';

    let durationText = "系統自動計算：—";
    if (task.start && task.end) {
        const [sh, sm] = task.start.split(':').map(Number);
        const [eh, em] = task.end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) durationText = `${Math.floor(diff / 60)} 小時 ${diff % 60} 分鐘`;
        else if (diff === 0) durationText = "0 分鐘";
        else durationText = "時間錯誤";
    }

    return `
        <div class="task-card ${lockedClass} ${completedClass}" data-index="${index}">
            <div class="task-header">
                <div class="task-title-group">
                    <label class="task-checkbox-wrapper" title="${appData.isLocked ? '標記完成' : '完成今日規劃後才可勾選'}">
                        <input type="checkbox" class="task-checkbox" ${checkedAttr} ${checkboxDisabled}>
                        <span class="custom-checkbox">
                            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </span>
                    </label>
                    <div class="task-title">任務 ${index + 1}</div>
                </div>
                <button class="btn-delete" type="button">刪除</button>
            </div>

            <div class="form-grid">
                <div class="form-group full-width">
                    <label>任務內容</label>
                    <input type="text" class="task-content" placeholder="例如：完成數學學習作" value="${task.content || ''}">
                </div>

                <div class="form-row-three">
                    <div class="form-group">
                        <label>任務分類</label>
                        <select class="task-category">
                            ${generateOptions(CATEGORIES, task.category)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>地點</label>
                        <select class="task-location">
                            ${generateOptions(LOCATIONS, task.location)}
                        </select>
                    </div>
                    <div class="form-group"></div>
                </div>

                <div class="form-row-time">
                    <div class="form-group">
                        <label>開始時間</label>
                        <input type="time" class="time-start" value="${task.start || ''}">
                    </div>
                    <div class="form-group">
                        <label>結束時間</label>
                        <input type="time" class="time-end" value="${task.end || ''}">
                    </div>
                    <div class="form-group">
                        <label>預計時間</label>
                        <input type="text" class="time-duration" value="${durationText}" readonly>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderTasks = () => {
    tasksContainer.innerHTML = '';
    appData.tasks.forEach((task, index) => {
        tasksContainer.insertAdjacentHTML('beforeend', createTaskHTML(task, index));
    });

    document.querySelectorAll('.task-card').forEach((card, index) => {
        bindCardEvents(card, index);
    });

    updateCounter();
    updateLayoutState();
};

const addTaskToData = () => {
    appData.tasks.push({
        content: '', category: '', location: '', start: '', end: '', completed: false
    });
};

const bindCardEvents = (card, index) => {
    const startInput = card.querySelector('.time-start');
    const endInput = card.querySelector('.time-end');
    const deleteBtn = card.querySelector('.btn-delete');
    const checkbox = card.querySelector('.task-checkbox');
    const contentInput = card.querySelector('.task-content');
    const categorySelect = card.querySelector('.task-category');
    const locationSelect = card.querySelector('.task-location');
    const durationInput = card.querySelector('.time-duration');

    if (!appData.isLocked) {
        contentInput.addEventListener('input', (e) => {
            appData.tasks[index].content = e.target.value;
            card.classList.remove('has-error');
            saveData();
        });
        categorySelect.addEventListener('change', (e) => {
            appData.tasks[index].category = e.target.value;
            saveData();
        });
        locationSelect.addEventListener('change', (e) => {
            appData.tasks[index].location = e.target.value;
            saveData();
        });

        const updateDuration = () => {
            const startVal = startInput.value;
            const endVal = endInput.value;
            appData.tasks[index].start = startVal;
            appData.tasks[index].end = endVal;

            if (startVal && endVal) {
                const [sh, sm] = startVal.split(':').map(Number);
                const [eh, em] = endVal.split(':').map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff > 0) durationInput.value = `${Math.floor(diff / 60)} 小時 ${diff % 60} 分鐘`;
                else if (diff === 0) durationInput.value = "0 分鐘";
                else durationInput.value = "結束時間不可早於開始時間";
            } else {
                durationInput.value = "系統自動計算：—";
            }
            saveData();
        };

        startInput.addEventListener('input', updateDuration);
        endInput.addEventListener('input', updateDuration);

        deleteBtn.addEventListener('click', () => {
            appData.tasks.splice(index, 1);
            saveData();
            renderTasks();
        });
    }

    // 勾選框（鎖定後才可操作）
    checkbox.addEventListener('change', (e) => {
        appData.tasks[index].completed = e.target.checked;
        if (e.target.checked) {
            card.classList.add('is-completed');
        } else {
            card.classList.remove('is-completed');
        }
        saveData();
        // 同步歷史紀錄（讓後台完成率保持即時）
        syncCurrentDayToHistory();
    });
};

const updateCounter = () => {
    taskCounter.textContent = `${appData.tasks.length} 項`;
};

const updateLayoutState = () => {
    if (appData.isLocked) {
        addTaskBtn.style.display = 'none';
        finishDayBtn.style.display = 'none';
        lockedBanner.style.display = 'block';
    } else {
        addTaskBtn.style.display = 'flex';
        finishDayBtn.style.display = 'flex';
        lockedBanner.style.display = 'none';
    }
};

/* =========================================================
   後台統計
   ========================================================= */

/** 計算某段區間（含）的完成率 */
const getStatsForRange = (history, startStr, endStr) => {
    let completed = 0;
    let total = 0;
    let days = 0;

    Object.values(history).forEach((day) => {
        if (day.date >= startStr && day.date <= endStr && Array.isArray(day.tasks)) {
            const dayTotal = day.tasks.length;
            if (dayTotal === 0) return;
            days++;
            total += dayTotal;
            completed += day.tasks.filter((t) => t.completed).length;
        }
    });

    return {
        completed,
        total,
        days,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
};

/** 統計某天各分類的時長（分鐘） */
const getCategoryDurations = (tasks) => {
    const result = {};
    (tasks || []).forEach((t) => {
        if (!t.category || !t.start || !t.end) return;
        const [sh, sm] = t.start.split(':').map(Number);
        const [eh, em] = t.end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) {
            result[t.category] = (result[t.category] || 0) + diff;
        }
    });
    return result;
};

const setOverviewCard = (key, stats) => {
    const rateEl = document.getElementById(`${key}Rate`);
    const countEl = document.getElementById(`${key}Count`);
    if (!rateEl || !countEl) return;

    if (stats.total > 0) {
        rateEl.textContent = `${stats.rate}%`;
        countEl.textContent = `${stats.completed} / ${stats.total} 項任務`;
    } else {
        rateEl.textContent = '—';
        countEl.textContent = '暫無數據';
    }
};

const renderDailyRecord = (day) => {
    const tasks = Array.isArray(day.tasks) ? day.tasks : [];
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const durations = getCategoryDurations(tasks);
    const entries = Object.entries(durations);
    const totalMins = entries.reduce((sum, [, m]) => sum + m, 0);

    let barHTML = '<div class="category-bar-empty">尚無分類時長紀錄</div>';
    if (totalMins > 0) {
        barHTML = '<div class="category-bar">';
        entries.forEach(([cat, mins]) => {
            const pct = (mins / totalMins) * 100;
            const color = CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLOR;
            barHTML += `
                <div class="cat-segment"
                     style="width:${pct}%;background-color:${color};"
                     title="${cat}：${formatMinutes(mins)}（${Math.round(pct)}%）">
                    <span class="cat-segment-label">${cat} ${formatMinutes(mins)}</span>
                </div>`;
        });
        barHTML += '</div>';
    }

    return `
        <div class="day-record">
            <div class="day-record-header">
                <div class="day-date">${formatDateDisplay(day.date)}</div>
                <div class="day-rate">
                    ${rate}%
                    <span class="day-rate-sub">(${completed}/${total})</span>
                </div>
            </div>
            ${barHTML}
        </div>
    `;
};

const renderAdmin = () => {
    const history = loadHistory();
    const todayStr = getTodayString();

    // ── 週 ──
    const weekStart = getWeekStart(todayStr);
    const weekEnd = addDays(weekStart, 6);
    setOverviewCard('week', getStatsForRange(history, weekStart, weekEnd));

    // ── 月 ──
    const ym = todayStr.slice(0, 7);
    setOverviewCard('month', getStatsForRange(history, `${ym}-01`, `${ym}-31`));

    // ── 年 ──
    const y = todayStr.slice(0, 4);
    setOverviewCard('year', getStatsForRange(history, `${y}-01-01`, `${y}-12-31`));

    // ── 每日記錄（新到舊） ──
    const days = Object.values(history)
        .filter((d) => d && d.date && Array.isArray(d.tasks) && d.tasks.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date));

    if (days.length === 0) {
        dailyList.innerHTML = '<div class="empty-state">還沒有任何已鎖定的規劃紀錄。<br>完成並鎖定今日規劃後，這裡就會出現統計資料。</div>';
    } else {
        dailyList.innerHTML = days.map(renderDailyRecord).join('');
    }
};

const showAdminView = () => {
    mainView.hidden = true;
    adminView.hidden = false;
    renderAdmin();
    window.scrollTo({ top: 0, behavior: 'auto' });
};

const showMainView = () => {
    adminView.hidden = true;
    mainView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
};

adminBtn.addEventListener('click', showAdminView);
backBtn.addEventListener('click', showMainView);

/* =========================================================
   主要事件
   ========================================================= */
addTaskBtn.addEventListener('click', () => {
    addTaskToData();
    saveData();
    renderTasks();
});

finishDayBtn.addEventListener('click', async () => {
    let hasEmptyTask = false;
    const cards = document.querySelectorAll('.task-card');

    cards.forEach(card => card.classList.remove('has-error'));

    appData.tasks.forEach((task, index) => {
        const isContentEmpty = !task.content || task.content.trim() === '';
        if (isContentEmpty) {
            hasEmptyTask = true;
            if (cards[index]) cards[index].classList.add('has-error');
        }
    });

    if (hasEmptyTask) {
        showToast(
            '⚠️ 無法鎖定規劃！\n請確認所有任務都已填寫「任務內容」，或刪除不需要的空任務。',
            'error',
            4500
        );
        const firstError = document.querySelector('.task-card.has-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const confirmed = await showConfirm({
        title: '完成今日規劃',
        message: '確定要完成今日規劃嗎？鎖定後將無法再修改任務內容、時間與新增刪除任務。',
        confirmText: '完成並鎖定',
        cancelText: '再想想'
    });

    if (!confirmed) return;

    appData.isLocked = true;
    saveData();
    // 同步歷史紀錄（供後台統計使用）
    syncCurrentDayToHistory();
    renderTasks();
    showToast('🎉 今日規劃已鎖定，開始執行吧！', 'success', 3200);
});

/* --- 初始化 --- */
const init = () => {
    initTheme();
    loadData();
    // 若今日已鎖定（例如重新整理頁面），同步一次歷史紀錄
    if (appData.isLocked) {
        syncCurrentDayToHistory();
    }
    renderTasks();
};

init();