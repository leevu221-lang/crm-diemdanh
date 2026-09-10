/**
 * Hệ Thống Điểm Danh BOSS (Đồng Bộ Google Sheets Siêu Tốc)
 * app.js - Đồng bộ liên tục từ sheet "DanhSach_SieuThi"
 * 
 * Các tính năng nổi bật:
 * 1. Danh sách Boss được cập nhật liên tục thời gian thực từ trang tính "DanhSach_SieuThi".
 * 2. Tự động nhận diện khi có Boss mới được thêm, đổi tên hoặc xoá trên Google Sheet.
 * 3. Zero-Latency Optimistic UI (< 1ms): Phản hồi ngay lập tức khi bấm, không chờ mạng.
 * 4. Ghi trực tiếp vào CỘT E của sheet "DanhSach_SieuThi" (gộp tất cả các siêu thị cùng Boss).
 * 5. Smart Auto-Polling (mỗi 5s): Tự động đồng bộ ngầm 2 chiều giữa tất cả các thiết bị.
 * 6. Non-destructive DOM Diffing: Cập nhật êm dịu, không giật màn hình hay mất vị trí cuộn.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. DỮ LIỆU GỐC DỰ PHÒNG CHUẨN TỪ SHEET "DanhSach_SieuThi"
  // ==========================================================================

  const DEFAULT_BOSS = [
    { row: 2, rows: [2], stt: 1, name: 'Hoa_7721', isChecked: false, tag: '@7721' },
    { row: 3, rows: [3], stt: 2, name: 'An_59690', isChecked: false, tag: '@59690' },
    { row: 4, rows: [4], stt: 3, name: 'Thi_51929', isChecked: false, tag: '@51929' },
    { row: 5, rows: [5, 17, 24], stt: 4, name: 'Ngoan_21966', isChecked: false, tag: '@21966' },
    { row: 6, rows: [6, 25], stt: 5, name: 'Tâm_146168', isChecked: false, tag: '@146168' },
    { row: 7, rows: [7], stt: 6, name: 'Phi_161470', isChecked: false, tag: '@161470' },
    { row: 8, rows: [8], stt: 7, name: 'Sơn_7699', isChecked: false, tag: '@7699' },
    { row: 9, rows: [9], stt: 8, name: 'Thảo_40924', isChecked: false, tag: '@40924' },
    { row: 10, rows: [10, 20], stt: 9, name: 'Nhẫn_7712', isChecked: false, tag: '@7712' },
    { row: 11, rows: [11], stt: 10, name: 'Quy_63172', isChecked: false, tag: '@63172' },
    { row: 12, rows: [12, 21], stt: 11, name: 'Toàn_44474', isChecked: false, tag: '@44474' },
    { row: 13, rows: [13, 15], stt: 12, name: 'Nhựt_63527', isChecked: false, tag: '@63527' },
    { row: 14, rows: [14], stt: 13, name: 'Tính_43746', isChecked: false, tag: '@43746' },
    { row: 16, rows: [16, 23], stt: 14, name: 'Nam_171275', isChecked: false, tag: '@171275' },
    { row: 18, rows: [18, 19, 22], stt: 15, name: 'Khắc_30653', isChecked: false, tag: '@30653' }
  ];

  const STORAGE_KEYS = {
    BOSS: 'ATTENDANCE_BOSS_DS_SIEUTHI_V1'
  };

  const POLL_INTERVAL_MS = 3000; // Chu kỳ đồng bộ ngầm: 3 giây siêu tốc

  // ==========================================================================
  // 2. STATE CỦA ỨNG DỤNG
  // ==========================================================================
  let state = {
    currentCategory: 'BOSS',
    bossList: [],
    memberToDelete: null,
    isSyncing: false,
    lastSyncTime: 0
  };

  // Hàng đợi gửi đồng bộ tối ưu (Batch Queue)
  const pendingSyncQueue = [];
  const pendingSyncKeys = new Set();
  let syncDebounceTimer = null;
  let isFlushingQueue = false;
  let pollingTimer = null;

  // ==========================================================================
  // 3. KHỞI TẠO ỨNG DỤNG
  // ==========================================================================
  function init() {
    setupClock();
    setupEventListeners();
    loadLocalFallbackData();
    checkAndSyncGoogleSheet(false, false);
    startSmartPolling();
  }

  function loadLocalFallbackData() {
    try {
      const savedBoss = localStorage.getItem(STORAGE_KEYS.BOSS);
      state.bossList = savedBoss ? JSON.parse(savedBoss) : [...DEFAULT_BOSS];
    } catch (e) {
      state.bossList = [...DEFAULT_BOSS];
    }

    renderTabs();
    renderTable();
    updateStats();
  }

  function saveLocalFallback() {
    try {
      localStorage.setItem(STORAGE_KEYS.BOSS, JSON.stringify(state.bossList));
    } catch (e) {}
  }

  function getActiveList() {
    return state.bossList;
  }

  function setActiveList(newList) {
    state.bossList = newList;
    saveLocalFallback();
  }

  function getCurrentSheetName() {
    return 'DanhSach_SieuThi';
  }

  // ==========================================================================
  // 4. KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS SIÊU TỐC TỪ "DanhSach_SieuThi"
  // ==========================================================================
  function getSheetUrl() {
    return (window.DEFAULT_SHEET_URL || '').trim();
  }

  async function checkAndSyncGoogleSheet(isManual = false, isBackground = false) {
    const sheetUrl = getSheetUrl();
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (!sheetUrl) {
      if (statusDot) statusDot.className = 'status-dot offline';
      if (statusText) statusText.textContent = 'Lưu Cục Bộ';
      return;
    }

    if (state.isSyncing && isBackground) return;

    if (!isBackground) {
      if (statusDot) statusDot.className = 'status-dot offline';
      if (statusText) statusText.textContent = 'Đang Đồng Bộ DanhSach_SieuThi...';
    }

    state.isSyncing = true;

    try {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      // Luôn luôn truyền noCache=1 và timestamp để các trình duyệt luôn nhận dữ liệu mới nhất tức thời
      const fetchUrl = `${sheetUrl}${sep}action=getAll&sheet=DanhSach_SieuThi&noCache=1&_t=${Date.now()}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      const json = await res.json();

      if (json.status === 'success') {
        if (statusDot) statusDot.className = 'status-dot online';
        if (statusText) statusText.textContent = 'Google Sheet: Đã Kết Nối';

        let incomingBossList = [];

        // 1. Dữ liệu từ mảng bossList chuẩn (đã được Apps Script gom nhóm từ DanhSach_SieuThi)
        if (Array.isArray(json.bossList) && json.bossList.length > 0) {
          incomingBossList = json.bossList.map((b, idx) => ({
            row: b.row || (idx + 2),
            rows: b.rows || [b.row || (idx + 2)],
            stt: b.stt || (idx + 1),
            name: b.name,
            isChecked: Boolean(b.isChecked),
            tag: b.tag || extractTag(b.name)
          }));
        }
        // 2. Dự phòng: Gom nhóm từ mảng stores nếu cần
        else if (Array.isArray(json.stores) && json.stores.length > 0) {
          const bossMap = new Map();
          json.stores.forEach((st, idx) => {
            const bName = (st.boss || '').trim();
            if (!bName) return;
            const rowNum = idx + 2;
            const isChecked = Boolean(
              st.isChecked || 
              (json.attendance && json.attendance[st.id]) ||
              (json.attendance && json.attendance[bName])
            );

            if (!bossMap.has(bName)) {
              bossMap.set(bName, {
                row: rowNum,
                rows: [rowNum],
                stt: bossMap.size + 1,
                name: bName,
                isChecked: isChecked,
                tag: extractTag(bName)
              });
            } else {
              const existing = bossMap.get(bName);
              existing.rows.push(rowNum);
              if (isChecked) existing.isChecked = true;
            }
          });

          if (bossMap.size > 0) {
            incomingBossList = Array.from(bossMap.values());
          }
        }

        if (incomingBossList.length > 0) {
          mergeIncomingBossData(incomingBossList, isBackground);
        }

        state.lastSyncTime = Date.now();

        if (isManual) {
          showToast('Đồng bộ danh sách Boss từ sheet "DanhSach_SieuThi" thành công!', 'success');
        }
      } else {
        throw new Error(json.message || 'Lỗi từ Sheet');
      }
    } catch (err) {
      if (!isBackground) {
        console.warn('Lỗi kết nối Google Sheets:', err);
        if (statusDot) statusDot.className = 'status-dot offline';
        if (statusText) statusText.textContent = 'Lỗi Kết Nối Google Sheet';
        if (isManual) {
          showToast('Không thể kết nối Google Sheet: ' + err.message, 'error');
        }
      }
    } finally {
      state.isSyncing = false;
    }
  }

  // Hợp nhất dữ liệu mới từ sheet DanhSach_SieuThi liên tục giữa các trình duyệt
  function mergeIncomingBossData(incomingList, isBackground) {
    const incomingSignature = incomingList.map(b => b.name).join('||');
    const currentSignature = state.bossList.map(b => b.name).join('||');
    const isStructureChanged = incomingSignature !== currentSignature || state.bossList.length === 0;

    // NẾU LÀ LẦN ĐẦU MỞ TRANG (!isBackground) HOẶC CÓ BOSS MỚI / THAY ĐỔI CẤU TRÚC:
    // Vẽ lại toàn bộ bảng để đảm bảo hiển thị đồng bộ 100% không bị lệch
    if (!isBackground || isStructureChanged) {
      incomingList.forEach(item => {
        if (pendingSyncKeys.has(item.name)) {
          const existing = state.bossList.find(i => i.name === item.name);
          if (existing) item.isChecked = existing.isChecked;
        }
      });

      state.bossList = incomingList;
      saveLocalFallback();
      renderTabs();
      renderTable();
      updateStats();
      return;
    }

    // NẾU LÀ ĐỒNG BỘ NGẦM (BACKGROUND POLLING): CẬP NHẬT TỪNG Ô ÊM DỊU, KHÔNG GIẬT MÀN HÌNH
    let hasChanges = false;
    incomingList.forEach(incoming => {
      const localItem = state.bossList.find(i => i.name === incoming.name);
      if (!localItem) return;

      localItem.row = incoming.row;
      localItem.rows = incoming.rows;

      // Không ghi đè nếu Boss này người dùng vừa click trên máy hiện tại
      if (pendingSyncKeys.has(localItem.name)) return;

      if (localItem.isChecked !== incoming.isChecked) {
        localItem.isChecked = incoming.isChecked;
        updateSingleRowInDOM(localItem);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      saveLocalFallback();
      updateStats();
    }
  }

  // ==========================================================================
  // 5. HÀNG ĐỢI GỬI LÊN SHEET "DanhSach_SieuThi" (DEBOUNCE BATCH QUEUE)
  // ==========================================================================

  function queueSyncAction(item) {
    pendingSyncKeys.add(item.name);

    const existingIdx = pendingSyncQueue.findIndex(q => q.boss === item.name);
    if (existingIdx >= 0) {
      pendingSyncQueue[existingIdx].isChecked = item.isChecked;
      pendingSyncQueue[existingIdx].timestamp = Date.now();
    } else {
      pendingSyncQueue.push({
        boss: item.name,
        row: item.row,
        rows: item.rows || [item.row],
        isChecked: item.isChecked,
        timestamp: Date.now()
      });
    }

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(flushSyncQueue, 250);
  }

  async function flushSyncQueue() {
    if (isFlushingQueue || pendingSyncQueue.length === 0) return;
    const sheetUrl = getSheetUrl();
    if (!sheetUrl) return;

    isFlushingQueue = true;
    const batch = pendingSyncQueue.splice(0, pendingSyncQueue.length);
    const sep = sheetUrl.includes('?') ? '&' : '?';

    try {
      if (batch.length === 1) {
        // Gửi lệnh đơn lẻ siêu nhanh vào sheet DanhSach_SieuThi
        const item = batch[0];
        const params = new URLSearchParams({
          action: 'updateCheck',
          sheet: 'DanhSach_SieuThi',
          boss: item.boss,
          row: String(item.row || ''),
          rows: (item.rows || [item.row]).join(','),
          isChecked: String(item.isChecked),
          _t: String(Date.now())
        });
        await fetch(`${sheetUrl}${sep}${params.toString()}`);
      } else {
        // Gộp nhiều lượt check vào 1 lệnh batchCheck duy nhất
        const payload = batch.map(b => ({
          boss: b.boss,
          row: b.row,
          isChecked: b.isChecked
        }));
        const params = new URLSearchParams({
          action: 'batchCheck',
          sheet: 'DanhSach_SieuThi',
          items: JSON.stringify(payload),
          _t: String(Date.now())
        });
        await fetch(`${sheetUrl}${sep}${params.toString()}`);
      }
    } catch (err) {
      console.warn('Lỗi gửi đồng bộ lên DanhSach_SieuThi:', err);
    } finally {
      setTimeout(() => {
        batch.forEach(b => pendingSyncKeys.delete(b.boss));
      }, 1500);

      isFlushingQueue = false;

      if (pendingSyncQueue.length > 0) {
        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(flushSyncQueue, 200);
      }
    }
  }

  // ==========================================================================
  // 6. ĐỒNG BỘ NGẦM THÔNG MINH (SMART BACKGROUND AUTO-POLLING MỖI 3 GIÂY)
  // ==========================================================================
  function startSmartPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(async () => {
      const isVisible = typeof document.visibilityState === 'undefined' || document.visibilityState === 'visible';
      if (
        isVisible && 
        !state.isSyncing && 
        pendingSyncQueue.length === 0 && 
        !isFlushingQueue
      ) {
        await checkAndSyncGoogleSheet(false, true);
      }
    }, POLL_INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndSyncGoogleSheet(false, false);
    }
  });

  window.addEventListener('focus', () => {
    checkAndSyncGoogleSheet(false, false);
  });

  // Đồng bộ tức thời giữa các tab trên cùng thiết bị/trình duyệt (0ms)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.BOSS && e.newValue) {
      try {
        const updatedList = JSON.parse(e.newValue);
        if (Array.isArray(updatedList) && updatedList.length > 0) {
          state.bossList = updatedList;
          renderTable();
          updateStats();
        }
      } catch (err) {}
    }
  });

  // ==========================================================================
  // 7. TRÍCH XUẤT TAG CÚ PHÁP @MãNV (VÍ DỤ: "Hoa_7721" -> "@7721")
  // ==========================================================================
  function extractTag(nameStr) {
    if (!nameStr) return '@';
    const trimmed = String(nameStr).trim();
    const parts = trimmed.split('_');
    if (parts.length > 1) {
      return '@' + parts[parts.length - 1].trim();
    }
    const numMatch = trimmed.match(/\d+/);
    if (numMatch) return '@' + numMatch[0];
    return '@' + trimmed;
  }

  // ==========================================================================
  // 8. ĐỒNG HỒ & GIAO DIỆN
  // ==========================================================================
  function setupClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    function update() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      if (timeEl) timeEl.textContent = `${hh}:${mm}:${ss}`;

      const dayName = weekdays[now.getDay()];
      const dd = String(now.getDate()).padStart(2, '0');
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const yy = now.getFullYear();
      if (dateEl) dateEl.textContent = `${dayName}, ${dd}/${mo}/${yy}`;
    }

    update();
    setInterval(update, 1000);
  }

  function renderTabs() {
    const bBoss = document.getElementById('badge-count-boss');
    if (bBoss) bBoss.textContent = state.bossList.length;

    const thName = document.getElementById('th-name-column');
    if (thName) thName.textContent = 'BOSS';
  }

  // ==========================================================================
  // 9. RENDER BẢNG ĐIỂM DANH & CẬP NHẬT TỪNG DÒNG KHÔNG GIẬT LAG
  // ==========================================================================
  function renderTable() {
    const tbody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('attendance-table');
    const searchInput = document.getElementById('search-input');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const activeList = getActiveList();

    const filtered = activeList.filter(item => {
      const matchName = (item.name || '').toLowerCase().includes(searchTerm);
      const matchTag = extractTag(item.name).toLowerCase().includes(searchTerm);
      return matchName || matchTag;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      table.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    table.style.display = 'table';

    filtered.forEach((item, index) => {
      const isChecked = Boolean(item.isChecked);
      const tagText = extractTag(item.name);

      const tr = document.createElement('tr');
      tr.setAttribute('data-boss', item.name);
      tr.setAttribute('data-row', item.row);
      if (isChecked) {
        tr.classList.add('row-checked');
      }

      tr.innerHTML = `
        <td class="col-stt"><span class="stt-badge">${item.stt || (index + 1)}</span></td>
        <td class="col-boss member-cell">${escapeHtml(item.name)}</td>
        <td class="col-check">
          <button class="btn-check-toggle ${isChecked ? 'checked' : 'unchecked'}" data-row="${item.row}" data-boss="${escapeHtml(item.name)}">
            <span class="check-icon">${isChecked ? '✅' : '⚪'}</span>
            <span class="check-text">${isChecked ? 'Đã Check' : 'Chưa Check'}</span>
          </button>
        </td>
        <td class="col-tag">
          <button class="btn-tag" data-tag="${escapeHtml(tagText)}" title="Bấm để copy tag ${escapeHtml(tagText)}">
            <span class="tag-icon">🏷️</span>
            <span class="tag-label">${escapeHtml(tagText)}</span>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  function updateSingleRowInDOM(item) {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    let tr = null;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-boss') === item.name || rows[i].getAttribute('data-row') === String(item.row)) {
        tr = rows[i];
        break;
      }
    }
    if (!tr) {
      renderTable();
      return;
    }

    const isChecked = Boolean(item.isChecked);
    if (isChecked) {
      tr.classList.add('row-checked');
    } else {
      tr.classList.remove('row-checked');
    }

    const btn = tr.querySelector('.btn-check-toggle');
    if (btn) {
      btn.className = `btn-check-toggle ${isChecked ? 'checked' : 'unchecked'}`;
      const icon = btn.querySelector('.check-icon');
      if (icon) icon.textContent = isChecked ? '✅' : '⚪';
      const text = btn.querySelector('.check-text');
      if (text) text.textContent = isChecked ? 'Đã Check' : 'Chưa Check';
    }
  }

  // ==========================================================================
  // 10. CẬP NHẬT THỐNG KÊ (STATS)
  // ==========================================================================
  function updateStats() {
    const activeList = getActiveList();
    const total = activeList.length;
    let checkedCount = 0;

    activeList.forEach(item => {
      if (item.isChecked) checkedCount++;
    });

    const uncheckedCount = total - checkedCount;
    const rate = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    const elTotal = document.getElementById('stat-total');
    if (elTotal) elTotal.textContent = total;
    const elChecked = document.getElementById('stat-checked');
    if (elChecked) elChecked.textContent = checkedCount;
    const elUnchecked = document.getElementById('stat-unchecked');
    if (elUnchecked) elUnchecked.textContent = uncheckedCount;
    const elRate = document.getElementById('stat-rate');
    if (elRate) elRate.textContent = `${rate}%`;
  }

  // ==========================================================================
  // 11. ĐIỂM DANH: TOGGLE, CHECK ALL, UNCHECK ALL (PHẢN HỒI TỨC THÌ 0MS)
  // ==========================================================================
  function toggleCheck(rowNumber, bossName) {
    const activeList = getActiveList();
    const item = activeList.find(i => 
      (bossName && i.name === bossName) ||
      String(i.row) === String(rowNumber) || 
      (i.rows && i.rows.map(String).includes(String(rowNumber)))
    );
    if (!item) return;

    item.isChecked = !item.isChecked;
    updateSingleRowInDOM(item);
    updateStats();
    saveLocalFallback();

    queueSyncAction(item);
  }

  function checkAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    activeList.forEach(item => {
      item.isChecked = true;
      updateSingleRowInDOM(item);
    });

    saveLocalFallback();
    updateStats();
    showToast('Đã check tất cả vào CỘT E (DanhSach_SieuThi)!', 'success');

    pendingSyncQueue.length = 0;
    pendingSyncKeys.clear();

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=checkAll&sheet=DanhSach_SieuThi&isChecked=true&_t=${Date.now()}`).catch(() => {});
    }
  }

  function uncheckAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    activeList.forEach(item => {
      item.isChecked = false;
      updateSingleRowInDOM(item);
    });

    saveLocalFallback();
    updateStats();
    showToast('Đã bỏ check toàn bộ CỘT E!', 'info');

    pendingSyncQueue.length = 0;
    pendingSyncKeys.clear();

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=checkAll&sheet=DanhSach_SieuThi&isChecked=false&_t=${Date.now()}`).catch(() => {});
    }
  }

  // ==========================================================================
  // 12. COPY TAG TÊN VÀO CLIPBOARD
  // ==========================================================================
  function copyToClipboard(text, btnElement, silent = false) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        handleCopySuccess(text, btnElement, silent);
      }).catch(() => fallbackCopyText(text, btnElement, silent));
    } else {
      fallbackCopyText(text, btnElement, silent);
    }
  }

  function fallbackCopyText(text, btnElement, silent = false) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      handleCopySuccess(text, btnElement, silent);
    } catch (e) {
      showToast('Không thể copy: ' + e.message, 'error');
    }
    document.body.removeChild(ta);
  }

  function handleCopySuccess(text, btnElement, silent = false) {
    if (btnElement) {
      const origHtml = btnElement.innerHTML;
      btnElement.innerHTML = `✓ Đã copy!`;
      btnElement.classList.add('copied');
      setTimeout(() => {
        btnElement.innerHTML = origHtml;
        btnElement.classList.remove('copied');
      }, 1500);
    }
    if (!silent) {
      showToast(`Đã copy ${text} vào bộ nhớ tạm!`, 'success');
    }
  }

  function copyUncheckedTags() {
    const activeList = getActiveList();
    const unchecked = activeList.filter(item => !item.isChecked);

    if (unchecked.length === 0) {
      showToast(`Tuyệt vời! Tất cả Boss đều đã điểm danh.`, 'success');
      return;
    }

    const tags = unchecked.map(item => extractTag(item.name));
    const uniqueTags = Array.from(new Set(tags));
    const resultText = uniqueTags.join('\n');

    // Chuyển silent = true để không hiện thông báo màu xanh, chỉ hiện 1 dòng thông báo màu vàng
    copyToClipboard(resultText, null, true);
    showToast(`Đã copy ${uniqueTags.length} tag của những người CHƯA CHECK!`, 'warning');
  }

  // ==========================================================================
  // 13. THÊM / XOÁ NGƯỜI
  // ==========================================================================
  function openAddModal() {
    document.getElementById('member-form').reset();
    document.getElementById('modal-title').textContent = `Thêm Mới Vào Sheet "DanhSach_SieuThi"`;
    document.getElementById('member-modal').classList.add('open');
    document.getElementById('member-name').focus();
  }

  function closeModal() {
    document.getElementById('member-modal').classList.remove('open');
  }

  function handleSaveMember(e) {
    e.preventDefault();
    const name = document.getElementById('member-name').value.trim();

    if (!name) {
      showToast('Vui lòng nhập họ tên & mã NV!', 'error');
      return;
    }

    const activeList = getActiveList();
    const newRow = activeList.length >= 1 ? (Math.max(...activeList.map(i => i.row || 0)) + 1) : 2;
    const newStt = activeList.length + 1;

    activeList.push({
      row: newRow,
      stt: newStt,
      name: name,
      isChecked: false
    });

    setActiveList(activeList);
    closeModal();
    renderTabs();
    renderTable();
    updateStats();
    showToast(`Đã thêm "${name}" vào danh sách!`, 'success');

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=addMember&sheet=DanhSach_SieuThi&name=${encodeURIComponent(name)}&_t=${Date.now()}`).catch(() => {});
    }
  }

  function promptDeleteMember(rowNumber) {
    const activeList = getActiveList();
    const item = activeList.find(i => String(i.row) === String(rowNumber));
    if (!item) return;

    state.memberToDelete = item;
    document.getElementById('delete-member-name').textContent = item.name;
    document.getElementById('delete-modal').classList.add('open');
  }

  function closeDeleteModal() {
    state.memberToDelete = null;
    document.getElementById('delete-modal').classList.remove('open');
  }

  function confirmDeleteMember() {
    if (!state.memberToDelete) return;
    const row = state.memberToDelete.row;
    const name = state.memberToDelete.name;

    let activeList = getActiveList();
    activeList = activeList.filter(i => String(i.row) !== String(row));
    activeList.forEach((item, idx) => { item.stt = idx + 1; });

    setActiveList(activeList);
    closeDeleteModal();
    renderTabs();
    renderTable();
    updateStats();
    showToast(`Đã xoá "${name}"!`, 'success');

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=deleteMember&sheet=DanhSach_SieuThi&row=${row}&_t=${Date.now()}`).catch(() => {});
    }
  }

  // ==========================================================================
  // 14. CẤU HÌNH GOOGLE SHEETS MODAL
  // ==========================================================================
  function openSheetModal() {
    document.getElementById('sheet-url-input').value = getSheetUrl();
    document.getElementById('sheet-modal').classList.add('open');
  }

  function closeSheetModal() {
    document.getElementById('sheet-modal').classList.remove('open');
  }

  // ==========================================================================
  // 15. XUẤT CSV & SAO LƯU DỮ LIỆU
  // ==========================================================================
  function exportCSV() {
    const activeList = getActiveList();
    const categoryName = 'DanhSach_SieuThi';
    const today = new Date().toISOString().split('T')[0];

    const rows = [
      [`BÁO CÁO ĐIỂM DANH: ${categoryName}`],
      [`Ngày điểm danh: ${today}`],
      [],
      ['STT', 'BOSS', 'TRẠNG THÁI', 'TAG CÚ PHÁP']
    ];

    activeList.forEach((item, idx) => {
      rows.push([
        idx + 1,
        item.name,
        item.isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH',
        extractTag(item.name)
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Diem_Danh_Boss_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file CSV thành công!', 'success');
  }

  function backupData() {
    const data = {
      sheet: 'DanhSach_SieuThi',
      bossList: state.bossList,
      exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_diemdanh_BOSS_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file sao lưu!', 'success');
  }

  // ==========================================================================
  // 16. BẮT SỰ KIỆN GIAO DIỆN
  // ==========================================================================
  function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', renderTable);

    document.getElementById('btn-check-all').addEventListener('click', checkAll);
    document.getElementById('btn-uncheck-all').addEventListener('click', uncheckAll);
    document.getElementById('btn-copy-uncheck-tags').addEventListener('click', copyUncheckedTags);
    const btnSyncNow = document.getElementById('btn-sync-now');
    if (btnSyncNow) btnSyncNow.addEventListener('click', () => checkAndSyncGoogleSheet(true, false));

    const btnOpenAdd = document.getElementById('btn-open-add-modal');
    if (btnOpenAdd) btnOpenAdd.addEventListener('click', openAddModal);
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('member-form').addEventListener('submit', handleSaveMember);

    document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteMember);

    const btnOpenSheet = document.getElementById('btn-open-sheet-modal');
    if (btnOpenSheet) btnOpenSheet.addEventListener('click', openSheetModal);
    document.getElementById('btn-close-sheet-modal').addEventListener('click', closeSheetModal);
    document.getElementById('btn-close-sheet-modal-btn').addEventListener('click', closeSheetModal);

    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-backup-data').addEventListener('click', backupData);

    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        closeModal();
        closeDeleteModal();
        closeSheetModal();
      }
    });

    const tbody = document.getElementById('attendance-table-body');
    tbody.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('.btn-check-toggle');
      if (checkBtn) {
        toggleCheck(checkBtn.dataset.row, checkBtn.dataset.boss);
        return;
      }

      const tagBtn = e.target.closest('.btn-tag');
      if (tagBtn) {
        copyToClipboard(tagBtn.dataset.tag, tagBtn);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-row');
      if (deleteBtn) {
        promptDeleteMember(deleteBtn.dataset.row);
      }
    });
  }

  // ==========================================================================
  // 17. TIỆN ÍCH (TOAST & ESCAPE HTML)
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Xoá thông báo cũ để chỉ luôn hiển thị duy nhất 1 thông báo
    container.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '📢';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
