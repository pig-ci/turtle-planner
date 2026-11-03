/* --- 常數 --- */
const CATEGORIES = ['學習', '生活', '運動', '娛樂'];
const LOCATIONS = ['家', '學校', '圖書館', '咖啡廳', '戶外'];

const PLANNER_KEY = 'dailyPlannerMultiData'; // 多日規劃資料
const HISTORY_KEY = 'dailyPlannerHistory';   // 歷史（已鎖定的每日快照）
const LEGACY_KEY = 'dailyPlannerData';       // 舊版單日資料（用於遷移）
const PREPLAN_DAYS = 7;                      // 今天 + 未來 7 天 = 8 天可選

// 分類顏色（用於後台長條圖）
const CATEGORY_COLORS = {
    '學習': '#10b981',
    '生活': '#f59e0b',
    '運動': '#ef4444',
    '娛樂': '#8b5cf6'
};
const DEFAULT_CATEGORY_COLOR = '#94a3b8';

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

const getWeekStart = (dateStr) => {
    const date = parseDate(dateStr);
    const day = date.getDay();
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

const getWeekdayShort = (dateStr) => {
    return ['日', '一', '二', '三', '四', '五', '六'][parseDate(dateStr).getDay()];
};

/** 日期標籤文字（今天 / 明天 / 週X） */
const getDateLabel = (dateStr) => {
    const today = getTodayString();
    if (dateStr === today) return '今天';
    if (dateStr === addDays(today, 1)) return '明天';
    return `週${getWeekdayShort(dateStr)}`;
};

/** 可選日期列表：今天 + 未來 PREPLAN_DAYS 天 */
const getSelectableDates = () => {
    const today = getTodayString();
    const arr = [];
    for (let i = 0; i <= PREPLAN_DAYS; i++) {
        arr.push(addDays(today, i));
    }
    return arr;
};

/* =========================================================
   DOM 元素
   ========================================================= */
const tasksContainer = document.getElementById('tasksContainer');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskCounter = document.getElementById('taskCounter');
const themeToggleBtn = document.getElementById('themeToggle');
const finishDayBtn = document.getElementById('finishDayBtn');
const lockedBanner = document.getElementById('lockedBanner');
const dateTabs = document.getElementById('dateTabs');

const mainView = document.getElementById('mainView');
const adminView = document.getElementById('adminView');
const adminBtn = document.getElementById('adminBtn');
const backBtn = document.getElementById('backBtn');
const dailyList = document.getElementById('dailyList');

/* =========================================================
   狀態
   plannerData = { 'YYYY-MM-DD': { isLocked: bool, tasks: [...] } }
   appData  = plannerData[currentDate]（引用，修改即同步）
   ========================================================= */
let plannerData = {};
let currentDate = getTodayString();
let appData = { isLocked: false, tasks: [] };

/* =========================================================
   Toast
   ========================================================= */
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

/* =========================================================
   確認彈窗
   ========================================================= */
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
   資料存取
   ========================================================= */
const saveData = () => {
    localStorage.setItem(PLANNER_KEY, JSON.stringify(plannerData));
};

const loadHistory = () => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return {};
    try {
        return JSON.parse(saved) || {};
    } catch (e) {
        console.error('解析歷史資料失敗', e);
        return {};
    }
};

const saveHistory = (history) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const createEmptyTasks = (count) => {
    const tasks = [];
    for (let i = 0; i < count; i++) {
        tasks.push({ content: '', category: '', location: '', start: '', end: '', completed: false });
    }
    return tasks;
};

/** 頁面載入時整理資料 */
const loadPlanner = () => {
    const todayStr = getTodayString();
    const saved = localStorage.getItem(PLANNER_KEY);

    if (saved) {
        try {
            plannerData = JSON.parse(saved) || {};
        } catch (e) {
            console.error('解析規劃資料失敗', e);
            plannerData = {};
        }
    }

    // 舊版資料遷移（只在今天沒有資料時）
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
        try {
            const parsed = JSON.parse(legacy);
            if (parsed && parsed.date === todayStr && !plannerData[todayStr]) {
                plannerData[todayStr] = {
                    isLocked: !!parsed.isLocked,
                    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
                };
            }
            localStorage.removeItem(LEGACY_KEY);
        } catch (e) {
            console.error('遷移舊資料失敗', e);
        }
    }

    // 清除過期日期（< 今天）
    Object.keys(plannerData).forEach((d) => {
        if (d < todayStr) delete plannerData[d];
    });

    // 確保今天有資料（首次進入今天會建立 3 個空任務）
    if (!plannerData[todayStr]) {
        plannerData[todayStr] = { isLocked: false, tasks: createEmptyTasks(3) };
    }

    saveData();
};

/** 切換到某日，設定 appData 引用 */
const loadDayData = (date) => {
    if (!plannerData[date]) {
        plannerData[date] = { isLocked: false, tasks: createEmptyTasks(3) };
        saveData();
    }
    if (!Array.isArray(plannerData[date].tasks)) {
        plannerData[date].tasks = [];
    }
    appData = plannerData[date];
};

/** 把目前檢視日期的鎖定快照寫入歷史 */
const syncCurrentDayToHistory = () => {
    if (!appData.isLocked) return;
    if (!appData.tasks || appData.tasks.length === 0) return;

    const history = loadHistory();
    const date = currentDate;
    history[date] = {
        date,
        tasks: appData.tasks.map((t) => ({
            content: t.content,
            category: t.category,
            location: t.location,
            start: t.start,
            end: t.end,
            completed: !!t.completed
        })),
        lockedAt: (history[date] && history[date].lockedAt) || Date.now()
    };
    saveHistory(history);
};

/* =========================================================
   主題切換
   ========================================================= */
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
   日期切換列
   ========================================================= */
let hasAutoScrolledTabs = false;

const renderDateTabs = () => {
    const today = getTodayString();
    const dates = getSelectableDates();

    dateTabs.innerHTML = dates.map((d) => {
        const isActive = d === currentDate;
        const isLocked = !!(plannerData[d] && plannerData[d].isLocked);
        const dateObj = parseDate(d);
        const num = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
        const classes = ['date-tab'];
        if (isActive) classes.push('active');
        return `<button class="${classes.join(' ')}" data-date="${d}" type="button">
            <span class="date-tab-label">${getDateLabel(d)}</span>
            <span class="date-tab-num">${num}</span>
            ${isLocked ? '<span class="date-tab-dot" title="已鎖定"></span>' : ''}
        </button>`;
    }).join('');

    // 首次渲染時把 active 的日期標籤自動滾到中間
    if (!hasAutoScrolledTabs) {
        const active = dateTabs.querySelector('.date-tab.active');
        if (active) {
            dateTabs.scrollLeft =
                active.offsetLeft - dateTabs.clientWidth / 2 + active.clientWidth / 2;
        }
        hasAutoScrolledTabs = true;
    }
};

dateTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.date-tab');
    if (!tab) return;
    const newDate = tab.dataset.date;
    if (!newDate || newDate === currentDate) return;
    switchDate(newDate);
});

const switchDate = (newDate) => {
    currentDate = newDate;
    loadDayData(newDate);
    renderDateTabs();
    renderTasks();
    window.scrollTo({ top: 0, behavior: 'auto' });
};

/* =========================================================
   任務渲染
   ========================================================= */
const generateOptions = (options, selectedValue) => {
    return `<option value="" disabled ${!selectedValue ? 'selected' : ''}>請選擇</option>` +
        options.map((opt) => `<option value="${opt}" ${opt === selectedValue ? 'selected' : ''}>${opt}</option>`).join('');
};

const createTaskHTML = (task, index) => {
    const lockedClass = appData.isLocked ? 'locked' : '';
    const checkedAttr = task.completed ? 'checked' : '';
    const completedClass = task.completed ? 'is-completed' : '';
    const checkboxDisabled = appData.isLocked ? '' : 'disabled';

    let durationText = '系統自動計算：—';
    if (task.start && task.end) {
        const [sh, sm] = task.start.split(':').map(Number);
        const [eh, em] = task.end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) durationText = `${Math.floor(diff / 60)} 小時 ${diff % 60} 分鐘`;
        else if (diff === 0) durationText = '0 分鐘';
        else durationText = '時間錯誤';
    }

    return `
        <div class="task-card ${lockedClass} ${completedClass}" data-index="${index}">
            <div class="task-header">
                <div class="task-title-group">
                    <label class="task-checkbox-wrapper" title="${appData.isLocked ? '標記完成' : '完成當日規劃後才可勾選'}">
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

    const clearError = () => card.classList.remove('has-error');

    if (!appData.isLocked) {
        contentInput.addEventListener('input', (e) => {
            appData.tasks[index].content = e.target.value;
            clearError();
            saveData();
        });
        categorySelect.addEventListener('change', (e) => {
            appData.tasks[index].category = e.target.value;
            clearError();
            saveData();
        });
        locationSelect.addEventListener('change', (e) => {
            appData.tasks[index].location = e.target.value;
            clearError();
            saveData();
        });

        const updateDuration = () => {
            const startVal = startInput.value;
            const endVal = endInput.value;
            appData.tasks[index].start = startVal;
            appData.tasks[index].end = endVal;
            clearError();

            if (startVal && endVal) {
                const [sh, sm] = startVal.split(':').map(Number);
                const [eh, em] = endVal.split(':').map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff > 0) durationInput.value = `${Math.floor(diff / 60)} 小時 ${diff % 60} 分鐘`;
                else if (diff === 0) durationInput.value = '0 分鐘';
                else durationInput.value = '結束時間不可早於開始時間';
            } else {
                durationInput.value = '系統自動計算：—';
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

    checkbox.addEventListener('change', (e) => {
        appData.tasks[index].completed = e.target.checked;
        if (e.target.checked) {
            card.classList.add('is-completed');
        } else {
            card.classList.remove('is-completed');
        }
        saveData();
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
        const isToday = currentDate === getTodayString();
        lockedBanner.textContent = isToday
            ? '🎉 今日規劃已完成並鎖定！明天將自動刷新。'
            : `🎉 ${formatDateDisplay(currentDate)} 的規劃已完成並鎖定！`;
    } else {
        addTaskBtn.style.display = 'flex';
        finishDayBtn.style.display = 'flex';
        lockedBanner.style.display = 'none';
    }
};

/* =========================================================
   後台統計
   ========================================================= */
const getStatsForRange = (history, startStr, endStr) => {
    const today = getTodayString();
    let completed = 0;
    let total = 0;
    let days = 0;

    Object.values(history).forEach((day) => {
        if (!day || !day.date || !Array.isArray(day.tasks)) return;
        if (day.date < startStr || day.date > endStr) return;
        if (day.date > today) return; // 未來日期不計入完成率
        if (day.tasks.length === 0) return;
        days++;
        total += day.tasks.length;
        completed += day.tasks.filter((t) => t.completed).length;
    });

    return {
        completed,
        total,
        days,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
};

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
    const today = getTodayString();
    const tasks = Array.isArray(day.tasks) ? day.tasks : [];
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isFuture = day.date > today;

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
        <div class="day-record${isFuture ? ' is-future' : ''}">
            <div class="day-record-header">
                <div class="day-date">
                    ${formatDateDisplay(day.date)}
                    ${isFuture ? '<span class="day-date-future">已規劃</span>' : ''}
                </div>
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

    const weekStart = getWeekStart(todayStr);
    const weekEnd = addDays(weekStart, 6);
    setOverviewCard('week', getStatsForRange(history, weekStart, weekEnd));

    const ym = todayStr.slice(0, 7);
    setOverviewCard('month', getStatsForRange(history, `${ym}-01`, `${ym}-31`));

    const y = todayStr.slice(0, 4);
    setOverviewCard('year', getStatsForRange(history, `${y}-01-01`, `${y}-12-31`));

    // 每日記錄：顯示所有已鎖定的日期（含未來已提前規劃的日期）
    const days = Object.values(history)
        .filter((d) => d && d.date && Array.isArray(d.tasks) && d.tasks.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date));

    if (days.length === 0) {
        dailyList.innerHTML = '<div class="empty-state">還沒有任何已鎖定的規劃紀錄。<br>完成並鎖定規劃後，這裡就會出現統計資料。</div>';
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
    const cards = document.querySelectorAll('.task-card');
    const emptyTasks = [];
    const incompleteTasks = [];

    cards.forEach((card) => card.classList.remove('has-error'));

    appData.tasks.forEach((task, index) => {
        const contentEmpty = !task.content || task.content.trim() === '';
        const isCompletelyEmpty =
            contentEmpty &&
            !task.category &&
            !task.location &&
            !task.start &&
            !task.end;

        if (isCompletelyEmpty) {
            emptyTasks.push(`任務 ${index + 1}`);
            if (cards[index]) cards[index].classList.add('has-error');
            return;
        }

        const missing = [];
        if (contentEmpty) missing.push('任務內容');
        if (!task.category) missing.push('任務分類');
        if (!task.location) missing.push('地點');
        if (!task.start) missing.push('開始時間');
        if (!task.end) missing.push('結束時間');

        if (missing.length > 0) {
            incompleteTasks.push(`任務 ${index + 1}：缺少「${missing.join('、')}」`);
            if (cards[index]) cards[index].classList.add('has-error');
        }
    });

    if (emptyTasks.length > 0 || incompleteTasks.length > 0) {
        const messages = [];
        if (emptyTasks.length > 0) {
            messages.push(`以下任務為空白，請填寫或刪除：\n${emptyTasks.join('、')}`);
        }
        if (incompleteTasks.length > 0) {
            messages.push(`以下任務缺少必填欄位：\n${incompleteTasks.join('\n')}`);
        }
        showToast(`⚠️ 無法鎖定規劃！\n\n${messages.join('\n\n')}`, 'error', 5500);
        const firstError = document.querySelector('.task-card.has-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const isToday = currentDate === getTodayString();
    const dateDisplay = isToday ? '今日' : formatDateDisplay(currentDate);

    const confirmed = await showConfirm({
        title: '完成規劃',
        message: `確定要完成「${dateDisplay}」的規劃嗎？鎖定後將無法再修改任務內容、時間與新增刪除任務。`,
        confirmText: '完成並鎖定',
        cancelText: '再想想'
    });

    if (!confirmed) return;

    appData.isLocked = true;
    saveData();
    syncCurrentDayToHistory();
    renderDateTabs();
    renderTasks();

    showToast(
        isToday ? '🎉 今日規劃已鎖定，開始執行吧！' : `🎉 ${formatDateDisplay(currentDate)} 的規劃已鎖定！`,
        'success',
        3200
    );
});

/* =========================================================
   初始化
   ========================================================= */
const init = () => {
    initTheme();
    loadPlanner();
    currentDate = getTodayString();
    loadDayData(currentDate);
    renderDateTabs();
    renderTasks();

    // 若今天已鎖定，同步一次歷史（例如重新整理頁面時）
    if (appData.isLocked) {
        syncCurrentDayToHistory();
    }
};

init();