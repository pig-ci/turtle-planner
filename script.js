/* --- 常數與狀態 --- */
const CATEGORIES = ['工作', '學習', '生活', '運動', '娛樂'];
const LOCATIONS = ['家', '公司', '學校', '圖書館', '咖啡廳', '戶外'];
const STORAGE_KEY = 'dailyPlannerData';

// DOM 元素
const tasksContainer = document.getElementById('tasksContainer');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskCounter = document.getElementById('taskCounter');
const themeToggleBtn = document.getElementById('themeToggle');
const finishDayBtn = document.getElementById('finishDayBtn');
const lockedBanner = document.getElementById('lockedBanner');

let appData = { date: '', isLocked: false, tasks: [] };

/* =========================================================
   自訂 UI：Toast 與確認彈窗（取代原生 alert / confirm）
   ========================================================= */

/* ---------- Toast ---------- */
const toastContainer = document.getElementById('toastContainer');

/**
 * 顯示一則浮動通知
 * @param {string} message 訊息內容（支援 \n 換行）
 * @param {'info'|'success'|'error'} type 類型
 * @param {number} duration 顯示毫秒數
 */
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
        // 保險：若動畫未觸發也要移除
        setTimeout(() => toast.remove(), 400);
    };

    toast.addEventListener('click', remove);
    const timer = setTimeout(remove, duration);

    // 滑鼠移入時暫停計時
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
        // 焦點鎖在彈窗的兩顆按鈕之間
        const focusables = [modalCancelBtn, modalConfirmBtn];
        const idx = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const nextIdx = e.shiftKey
            ? (idx <= 0 ? focusables.length - 1 : idx - 1)
            : (idx === focusables.length - 1 ? 0 : idx + 1);
        focusables[nextIdx].focus();
    }
};

/**
 * 顯示確認彈窗，回傳 Promise<boolean>
 * @param {object} opts
 * @param {string} opts.title 標題
 * @param {string} opts.message 內容
 * @param {string} opts.confirmText 確認鈕文字
 * @param {string} opts.cancelText 取消鈕文字
 * @param {boolean} opts.danger 是否為危險操作（紅色確認鈕）
 * @param {boolean} opts.warning 是否顯示警告圖示
 */
const showConfirm = ({
    title = '確認',
    message = '',
    confirmText = '確定',
    cancelText = '取消',
    danger = false,
    warning = false
} = {}) => {
    return new Promise((resolve) => {
        // 若已有彈窗，先取消前一個
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

        // 等畫面更新後再設定焦點，避免瀏覽器搶回焦點
        requestAnimationFrame(() => modalConfirmBtn.focus());
    });
};

modalConfirmBtn.addEventListener('click', () => resolveModal(true));
modalCancelBtn.addEventListener('click', () => resolveModal(false));
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) resolveModal(false);
});

/* =========================================================
   日期與資料處理
   ========================================================= */
const getTodayString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

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

    // 重置為全新的一天
    appData = { date: todayStr, isLocked: false, tasks: [] };
    for (let i = 0; i < 3; i++) {
        addTaskToData();
    }
    saveData();
};

const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
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

/* --- 任務渲染 --- */
const generateOptions = (options, selectedValue) => {
    return `<option value="" disabled ${!selectedValue ? 'selected' : ''}>請選擇</option>` +
           options.map(opt => `<option value="${opt}" ${opt === selectedValue ? 'selected' : ''}>${opt}</option>`).join('');
};

const createTaskHTML = (task, index) => {
    const lockedClass = appData.isLocked ? 'locked' : '';
    const checkedAttr = task.completed ? 'checked' : '';
    const completedClass = task.completed ? 'is-completed' : '';

    // 核心邏輯：如果還沒鎖定，勾選框要 disabled
    const checkboxDisabled = appData.isLocked ? '' : 'disabled';

    // 計算時長
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
            card.classList.remove('has-error'); // 輸入時移除錯誤紅框
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

    // 勾選框 (鎖定後才可操作)
    checkbox.addEventListener('change', (e) => {
        appData.tasks[index].completed = e.target.checked;
        if (e.target.checked) {
            card.classList.add('is-completed');
        } else {
            card.classList.remove('is-completed');
        }
        saveData();
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

/* --- 事件監聽 --- */
addTaskBtn.addEventListener('click', () => {
    addTaskToData();
    saveData();
    renderTasks();
});

finishDayBtn.addEventListener('click', async () => {
    // 1. 驗證是否有空任務
    let hasEmptyTask = false;
    const cards = document.querySelectorAll('.task-card');

    // 先清除所有錯誤標記
    cards.forEach(card => card.classList.remove('has-error'));

    appData.tasks.forEach((task, index) => {
        // 判斷是否為空：內容為空字串，或所有欄位都沒填
        const isContentEmpty = !task.content || task.content.trim() === '';

        if (isContentEmpty) {
            hasEmptyTask = true;
            // 標記該張卡片為錯誤狀態
            if (cards[index]) cards[index].classList.add('has-error');
        }
    });

    if (hasEmptyTask) {
        showToast(
            '⚠️ 無法鎖定規劃！\n請確認所有任務都已填寫「任務內容」，或刪除不需要的空任務。',
            'error',
            4500
        );
        // 將畫面捲動到第一個錯誤的卡片
        const firstError = document.querySelector('.task-card.has-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    // 2. 驗證通過，跳出確認彈窗
    const confirmed = await showConfirm({
        title: '完成今日規劃',
        message: '確定要完成今日規劃嗎？鎖定後將無法再修改任務內容、時間與新增刪除任務。',
        confirmText: '完成並鎖定',
        cancelText: '再想想'
    });

    if (!confirmed) return;

    // 3. 執行鎖定
    appData.isLocked = true;
    saveData();
    renderTasks();
    showToast('🎉 今日規劃已鎖定，開始執行吧！', 'success', 3200);
});

/* --- 初始化 --- */
const init = () => {
    initTheme();
    loadData();
    renderTasks();
};

init();