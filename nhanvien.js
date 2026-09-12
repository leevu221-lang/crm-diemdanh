/**
 * Hệ Thống Điểm Danh NHÂN VIÊN (Đồng Bộ Google Sheets Siêu Tốc)
 * nhanvien.js - Đồng bộ liên tục từ tab/trang tính "NHÂN VIÊN"
 * 
 * Các tính năng nổi bật:
 * 1. Danh sách Nhân Viên được cập nhật liên tục thời gian thực từ trang tính "NHÂN VIÊN".
 * 2. Tự động nhận diện khi có Nhân Viên mới được thêm, đổi tên hoặc xoá trên Google Sheet.
 * 3. Zero-Latency Optimistic UI (< 1ms): Phản hồi ngay lập tức khi bấm, không chờ mạng.
 * 4. Kênh Realtime SSE & BroadcastChannel độc lập hoàn toàn với trang Boss.
 * 5. Smart Auto-Polling (mỗi 15s): Tự động đồng bộ ngầm 2 chiều giữa tất cả các thiết bị.
 * 6. Non-destructive DOM Diffing: Cập nhật êm dịu, không giật màn hình hay mất vị trí cuộn.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. DỮ LIỆU GỐC DỰ PHÒNG CHUẨN DÀNH CHO NHÂN VIÊN
  // ==========================================================================

  const DEFAULT_STAFF = [
    { row: 2, rows: [2], stt: 1, name: 'Hoa_7721', isChecked: false, tag: '@7721' },
    { row: 3, rows: [3], stt: 2, name: 'An_59690', isChecked: true, tag: '@59690' },
    { row: 4, rows: [4], stt: 3, name: 'Thi_51929', isChecked: false, tag: '@51929' },
    { row: 5, rows: [5], stt: 4, name: 'Ngoan_21966', isChecked: true, tag: '@21966' },
    { row: 6, rows: [6], stt: 5, name: 'Tâm_146168', isChecked: false, tag: '@146168' },
    { row: 7, rows: [7], stt: 6, name: 'Phi_161470', isChecked: true, tag: '@161470' },
    { row: 8, rows: [8], stt: 7, name: 'Sơn_7699', isChecked: false, tag: '@7699' },
    { row: 9, rows: [9], stt: 8, name: 'Thảo_40924', isChecked: false, tag: '@40924' },
    { row: 10, rows: [10], stt: 9, name: 'Nhẫn_7712', isChecked: true, tag: '@7712' },
    { row: 11, rows: [11], stt: 10, name: 'Quy_63172', isChecked: false, tag: '@63172' },
    { row: 12, rows: [12], stt: 11, name: 'Toàn_44474', isChecked: true, tag: '@44474' },
    { row: 13, rows: [13], stt: 12, name: 'Nhựt_63527', isChecked: false, tag: '@63527' },
    { row: 14, rows: [14], stt: 13, name: 'Tính_43746', isChecked: false, tag: '@43746' },
    { row: 15, rows: [15], stt: 14, name: 'Nam_171275', isChecked: false, tag: '@171275' },
    { row: 16, rows: [16], stt: 15, name: 'Khắc_30653', isChecked: false, tag: '@30653' }
  ];

  const STORAGE_KEYS = {
    STAFF: 'ATTENDANCE_NHANVIEN_DS_V1'
  };

  const TARGET_SHEET_NAME = 'NHÂN VIÊN';
  const POLL_INTERVAL_MS = 15000;

  // ==========================================================================
  // REALTIME MULTI-BROWSER ULTRA-SYNC (BROADCASTCHANNEL + CLOUD SSE RELAY)
  // Đồng bộ tức thời giữa các trình duyệt & thiết bị khác nhau (< 300ms)
  // ==========================================================================
  const CLIENT_ID = 'cli_nv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const REALTIME_TOPIC = 'crm_diemdanh_AKfycbxgLE4JMXVt_nhanvien';
  let localBroadcastChannel = null;
  let sseClient = null;

  function initRealtimeSync() {
    if ('BroadcastChannel' in window) {
      try {
        localBroadcastChannel = new BroadcastChannel('crm_nhanvien_sync_bus');
        localBroadcastChannel.onmessage = (e) => {
          handleIncomingRealtimeSignal(e.data);
        };
      } catch (e) {}
    }

    connectRealtimeSSE();
  }

  function connectRealtimeSSE() {
    if (typeof EventSource === 'undefined') return;
    if (sseClient) {
      try { sseClient.close(); } catch (e) {}
    }

    try {
      sseClient = new EventSource(`https://ntfy.sh/${REALTIME_TOPIC}/sse?since=10m`);

      sseClient.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'message' && parsed.message) {
            const payload = JSON.parse(parsed.message);
            handleIncomingRealtimeSignal(payload);
          }
        } catch (err) {}
      };

      sseClient.onerror = () => {};
    } catch (e) {}
  }

  function broadcastRealtimeSignal(payload) {
    payload.clientId = CLIENT_ID;
    payload.timestamp = Date.now();

    if (localBroadcastChannel) {
      try { localBroadcastChannel.postMessage(payload); } catch (e) {}
    }

    fetch(`https://ntfy.sh/${REALTIME_TOPIC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  function handleIncomingRealtimeSignal(payload) {
    if (!payload || payload.clientId === CLIENT_ID) return;

    let hasChanges = false;
    const activeList = state.staffList;

    if (payload.type === 'TOGGLE') {
      const item = activeList.find(i => 
        (payload.name && i.name === payload.name) ||
        String(i.row) === String(payload.row) ||
        (i.rows && i.rows.map(String).includes(String(payload.row)))
      );
      if (item && item.isChecked !== payload.isChecked) {
        item.isChecked = Boolean(payload.isChecked);
        hasChanges = true;
      }
    } else if (payload.type === 'CHECK_ALL') {
      const targetVal = Boolean(payload.isChecked);
      activeList.forEach(item => {
        if (item.isChecked !== targetVal) {
          item.isChecked = targetVal;
          hasChanges = true;
        }
      });
    }

    if (hasChanges) {
      saveLocalFallback();
      renderTable();
      updateStats();
    }
  }

  // ==========================================================================
  // 2. STATE CỦA ỨNG DỤNG
  // ==========================================================================
  let state = {
    staffList: [],
    memberToDelete: null,
    isSyncing: false,
    lastSyncTime: 0
  };

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
    initRealtimeSync();
    checkAndSyncGoogleSheet(false, false);
    startSmartPolling();
  }

  function loadLocalFallbackData() {
    try {
      const savedStaff = localStorage.getItem(STORAGE_KEYS.STAFF);
      state.staffList = savedStaff ? JSON.parse(savedStaff) : [...DEFAULT_STAFF];
    } catch (e) {
      state.staffList = [...DEFAULT_STAFF];
    }

    renderTable();
    updateStats();
  }

  function saveLocalFallback() {
    try {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(state.staffList));
    } catch (e) {}
  }

  function getActiveList() {
    return state.staffList;
  }

  function setActiveList(newList) {
    state.staffList = newList;
    saveLocalFallback();
  }

  function getCurrentSheetName() {
    return TARGET_SHEET_NAME;
  }

  function getSheetUrl() {
    return (window.DEFAULT_SHEET_URL || '').trim();
  }

  // ==========================================================================
  // 4. KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS TỪ TAB "NHÂN VIÊN"
  // ==========================================================================
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
      if (statusText) statusText.textContent = 'Đang Đồng Bộ NHÂN VIÊN...';
    }

    state.isSyncing = true;

    try {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      const noCacheParam = isBackground ? '' : '&noCache=1';
      const fetchUrl = `${sheetUrl}${sep}action=getAll&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}${noCacheParam}&_t=${Date.now()}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(fetchUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      const json = await res.json();

      if (json.status === 'success') {
        if (statusDot) statusDot.className = 'status-dot online';
        if (statusText) statusText.textContent = 'Google Sheet: Đồng Bộ Thời Gian Thực';

        let incomingStaffList = [];

        const rawList = json.staffList || json.bossList;
        if (Array.isArray(rawList) && rawList.length > 0) {
          incomingStaffList = rawList.map((b, idx) => ({
            row: b.row || (idx + 2),
            rows: b.rows || [b.row || (idx + 2)],
            stt: b.stt || (idx + 1),
            name: b.name || '',
            isChecked: Boolean(b.isChecked),
            tag: b.tag || extractTag(b.name || '')
          }));
        }

        if (incomingStaffList.length > 0) {
          syncIncomingStaffList(incomingStaffList);
        }

        state.lastSyncTime = Date.now();
        if (isManual) {
          showToast('Đã đồng bộ mới nhất từ trang NHÂN VIÊN!', 'success');
        }
      }
    } catch (err) {
      if (!isBackground) {
        if (statusDot) statusDot.className = 'status-dot offline';
        if (statusText) statusText.textContent = 'Mất Kết Nối';
      }
    } finally {
      state.isSyncing = false;
    }
  }

  function syncIncomingStaffList(incomingList) {
    const activeList = state.staffList;
    let hasStructuralChanges = false;
    let hasCheckChanges = false;

    if (activeList.length !== incomingList.length) {
      hasStructuralChanges = true;
    } else {
      for (let i = 0; i < incomingList.length; i++) {
        if (activeList[i].name !== incomingList[i].name) {
          hasStructuralChanges = true;
          break;
        }
      }
    }

    if (hasStructuralChanges) {
      state.staffList = incomingList;
      saveLocalFallback();
      renderTable();
      updateStats();
      return;
    }

    incomingList.forEach(incomingItem => {
      const currentItem = activeList.find(i => i.name === incomingItem.name);
      if (currentItem) {
        if (pendingSyncKeys.has(currentItem.name)) {
          return;
        }

        if (currentItem.isChecked !== incomingItem.isChecked) {
          currentItem.isChecked = incomingItem.isChecked;
          hasCheckChanges = true;
          updateSingleRowInDOM(currentItem);
        }
      }
    });

    if (hasCheckChanges) {
      saveLocalFallback();
      updateStats();
    }
  }

  function startSmartPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(() => {
      if (!document.hidden && !isFlushingQueue && pendingSyncQueue.length === 0) {
        checkAndSyncGoogleSheet(false, true);
      }
    }, POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndSyncGoogleSheet(false, true);
      }
    });
  }

  // ==========================================================================
  // 5. HÀNG ĐỢI GỬI DỮ LIỆU ĐỒNG BỘ LÊN SHEET
  // ==========================================================================
  function queueSyncAction(item) {
    pendingSyncKeys.add(item.name);

    const existingIdx = pendingSyncQueue.findIndex(q => q.name === item.name);
    if (existingIdx !== -1) {
      pendingSyncQueue[existingIdx].isChecked = item.isChecked;
    } else {
      pendingSyncQueue.push({
        row: item.row,
        rows: item.rows ? item.rows.join(',') : String(item.row),
        name: item.name,
        isChecked: item.isChecked
      });
    }

    broadcastRealtimeSignal({
      type: 'TOGGLE',
      name: item.name,
      row: item.row,
      isChecked: item.isChecked
    });

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(flushSyncQueue, 350);
  }

  async function flushSyncQueue() {
    if (pendingSyncQueue.length === 0 || isFlushingQueue) return;

    const sheetUrl = getSheetUrl();
    if (!sheetUrl) {
      pendingSyncQueue.length = 0;
      pendingSyncKeys.clear();
      return;
    }

    isFlushingQueue = true;
    const batch = [...pendingSyncQueue];
    pendingSyncQueue.length = 0;

    try {
      const sep = sheetUrl.includes('?') ? '&' : '?';

      if (batch.length === 1) {
        const item = batch[0];
        await fetch(`${sheetUrl}${sep}action=updateCheck&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}&name=${encodeURIComponent(item.name)}&row=${item.row}&rows=${encodeURIComponent(item.rows || '')}&isChecked=${item.isChecked}&_t=${Date.now()}`);
      } else {
        const itemsJson = JSON.stringify(batch);
        await fetch(`${sheetUrl}${sep}action=batchCheck&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}&items=${encodeURIComponent(itemsJson)}&_t=${Date.now()}`);
      }
    } catch (e) {
    } finally {
      batch.forEach(it => pendingSyncKeys.delete(it.name));
      isFlushingQueue = false;
    }
  }

  // ==========================================================================
  // 6. TIỆN ÍCH ĐỒNG BỘ DOM VÀ TRÍCH XUẤT TAG
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

  function updateSingleRowInDOM(item) {
    const tableBody = document.getElementById('attendance-table-body');
    if (!tableBody) return;

    const rowEl = tableBody.querySelector(`tr[data-staff="${CSS.escape(item.name)}"]`) ||
                  tableBody.querySelector(`tr[data-row="${item.row}"]`);
    if (!rowEl) return;

    if (item.isChecked) {
      rowEl.classList.add('row-checked');
    } else {
      rowEl.classList.remove('row-checked');
    }

    const checkBtn = rowEl.querySelector('.btn-check-toggle');
    if (checkBtn) {
      if (item.isChecked) {
        checkBtn.className = 'btn-check-toggle checked';
        checkBtn.innerHTML = `
          <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Đã Check</span>
        `;
      } else {
        checkBtn.className = 'btn-check-toggle unchecked';
        checkBtn.innerHTML = `
          <div class="uncheck-dot"></div>
          <span>Chưa Check</span>
        `;
      }
    }
  }

  // ==========================================================================
  // 7. RENDER BẢNG ĐIỂM DANH
  // ==========================================================================
  function renderTable() {
    const list = getActiveList();
    const tableBody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('empty-state');
    const tableElement = document.getElementById('attendance-table');

    const searchInput = document.getElementById('search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filtered = list.filter(item => {
      if (!query) return true;
      const name = (item.name || '').toLowerCase();
      const tag = (item.tag || '').toLowerCase();
      return name.includes(query) || tag.includes(query);
    });

    if (filtered.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (tableElement) tableElement.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (tableElement) tableElement.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    filtered.forEach((item, index) => {
      const isChecked = Boolean(item.isChecked);
      const rowClass = isChecked ? 'row-checked' : '';
      const tagDisplay = item.tag || extractTag(item.name);
      const stt = item.stt || (index + 1);

      html += `
        <tr class="${rowClass}" data-row="${item.row}" data-staff="${escapeHtml(item.name)}">
          <td class="col-stt">${stt}</td>
          <td class="col-boss name-cell">
            <span class="person-name">${escapeHtml(item.name)}</span>
          </td>
          <td class="col-check">
            <button class="btn-check-toggle ${isChecked ? 'checked' : 'unchecked'}" 
                    data-row="${item.row}"
                    data-staff="${escapeHtml(item.name)}"
                    type="button">
              ${isChecked ? `
                <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Đã Check</span>
              ` : `
                <div class="uncheck-dot"></div>
                <span>Chưa Check</span>
              `}
            </button>
          </td>
          <td class="col-tag">
            <button class="btn-tag" data-tag="${escapeHtml(tagDisplay)}" type="button" title="Bấm để copy tag Zalo">
              <span class="tag-icon">🏷️</span>
              <span class="tag-text">${escapeHtml(tagDisplay)}</span>
            </button>
          </td>
        </tr>
      `;
    });

    if (tableBody) tableBody.innerHTML = html;
  }

  // ==========================================================================
  // 8. CẬP NHẬT THỐNG KÊ
  // ==========================================================================
  function updateStats() {
    const list = getActiveList();
    const total = list.length;
    const checked = list.filter(i => i.isChecked).length;
    const unchecked = total - checked;
    const rate = total > 0 ? Math.round((checked / total) * 100) : 0;

    const elTotal = document.getElementById('stat-total');
    const elChecked = document.getElementById('stat-checked');
    const elUnchecked = document.getElementById('stat-unchecked');
    const elRate = document.getElementById('stat-rate');

    if (elTotal) elTotal.textContent = total;
    if (elChecked) elChecked.textContent = checked;
    if (elUnchecked) elUnchecked.textContent = unchecked;
    if (elRate) elRate.textContent = rate + '%';
  }

  // ==========================================================================
  // 9. THAO TÁC ĐIỂM DANH: TOGGLE, CHECK ALL, UNCHECK ALL
  // ==========================================================================
  function toggleCheck(rowNumber, staffName) {
    const activeList = getActiveList();
    const item = activeList.find(i => 
      (staffName && i.name === staffName) ||
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
    showToast('Đã check tất cả Nhân Viên!', 'success');

    pendingSyncQueue.length = 0;
    pendingSyncKeys.clear();

    broadcastRealtimeSignal({
      type: 'CHECK_ALL',
      isChecked: true
    });

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=checkAll&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}&isChecked=true&_t=${Date.now()}`).catch(() => {});
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
    showToast('Đã bỏ check toàn bộ Nhân Viên!', 'info');

    pendingSyncQueue.length = 0;
    pendingSyncKeys.clear();

    broadcastRealtimeSignal({
      type: 'CHECK_ALL',
      isChecked: false
    });

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=checkAll&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}&isChecked=false&_t=${Date.now()}`).catch(() => {});
    }
  }

  // ==========================================================================
  // 10. COPY TAG TÊN VÀO CLIPBOARD (DÁN ZALO MỖI NGƯỜI 1 DÒNG \N)
  // ==========================================================================
  function copyToClipboard(text, btnElement) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        animateCopySuccess(btnElement);
        showToast(`Đã copy "${text}" vào bộ nhớ tạm!`, 'success');
      }).catch(() => fallbackCopy(text, btnElement));
    } else {
      fallbackCopy(text, btnElement);
    }
  }

  function fallbackCopy(text, btnElement) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      animateCopySuccess(btnElement);
      showToast(`Đã copy "${text}"!`, 'success');
    } catch (e) {
      showToast('Không thể tự động copy, vui lòng copy thủ công.', 'warning');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  function animateCopySuccess(btn) {
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = `<span>✓ Đã Copy!</span>`;
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.classList.remove('copied');
    }, 1500);
  }

  function copyUncheckedTags() {
    const activeList = getActiveList();
    const uncheckedList = activeList.filter(item => !item.isChecked);

    if (uncheckedList.length === 0) {
      showToast('🎉 Tuyệt vời! Tất cả Nhân Viên đều đã điểm danh.', 'success');
      return;
    }

    const seen = new Set();
    const uniqueTags = [];
    uncheckedList.forEach(item => {
      const tag = item.tag || extractTag(item.name);
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        uniqueTags.push(tag);
      }
    });

    const textToCopy = uniqueTags.join('\n');
    copyToClipboard(textToCopy, document.getElementById('btn-copy-uncheck-tags'));
    showToast(`Đã copy tag của ${uniqueTags.length} nhân viên chưa check!`, 'warning');
  }

  // ==========================================================================
  // 11. THÊM / XOÁ NGƯỜI
  // ==========================================================================
  function openAddModal() {
    const form = document.getElementById('member-form');
    if (form) form.reset();
    const modal = document.getElementById('member-modal');
    if (modal) modal.classList.add('show');
    const input = document.getElementById('member-name');
    if (input) setTimeout(() => input.focus(), 150);
  }

  function closeAddModal() {
    const modal = document.getElementById('member-modal');
    if (modal) modal.classList.remove('show');
  }

  function handleAddMemberSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('member-name');
    const name = input ? input.value.trim() : '';

    if (!name) {
      showToast('Vui lòng nhập tên nhân viên!', 'warning');
      return;
    }

    const activeList = getActiveList();
    const maxRow = activeList.reduce((max, item) => Math.max(max, item.row || 0), 1);
    const newRow = maxRow + 1;

    const newItem = {
      row: newRow,
      rows: [newRow],
      stt: activeList.length + 1,
      name: name,
      isChecked: false,
      tag: extractTag(name)
    };

    activeList.push(newItem);
    setActiveList(activeList);
    closeAddModal();
    renderTable();
    updateStats();
    showToast(`Đã thêm "${name}" vào danh sách!`, 'success');

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=addMember&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}&name=${encodeURIComponent(name)}&_t=${Date.now()}`).catch(() => {});
    }
  }

  function promptDeleteMember(rowNumber) {
    const activeList = getActiveList();
    const item = activeList.find(i => String(i.row) === String(rowNumber));
    if (!item) return;

    state.memberToDelete = item;
    const nameEl = document.getElementById('delete-member-name');
    if (nameEl) nameEl.textContent = `${item.name} (${item.tag || extractTag(item.name)})`;
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal) deleteModal.classList.add('show');
  }

  function closeDeleteModal() {
    state.memberToDelete = null;
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal) deleteModal.classList.remove('show');
  }

  function confirmDeleteMember() {
    if (!state.memberToDelete) return;

    const { row, name } = state.memberToDelete;
    let activeList = getActiveList();
    activeList = activeList.filter(i => String(i.row) !== String(row));

    activeList.forEach((item, idx) => {
      item.stt = idx + 1;
    });

    setActiveList(activeList);
    closeDeleteModal();
    renderTable();
    updateStats();
    showToast(`Đã xoá "${name}"!`, 'success');

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=deleteMember&sheet=${encodeURIComponent(TARGET_SHEET_NAME)}&row=${row}&_t=${Date.now()}`).catch(() => {});
    }
  }

  // ==========================================================================
  // 12. CẤU HÌNH GOOGLE SHEETS MODAL
  // ==========================================================================
  function openSheetModal() {
    const input = document.getElementById('sheet-url-input');
    if (input) input.value = getSheetUrl();
    const modal = document.getElementById('sheet-modal');
    if (modal) modal.classList.add('show');
  }

  function closeSheetModal() {
    const modal = document.getElementById('sheet-modal');
    if (modal) modal.classList.remove('show');
  }

  // ==========================================================================
  // 13. BẮT SỰ KIỆN GIAO DIỆN
  // ==========================================================================
  function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', renderTable);

    const btnCheckAll = document.getElementById('btn-check-all');
    if (btnCheckAll) btnCheckAll.addEventListener('click', checkAll);

    const btnUncheckAll = document.getElementById('btn-uncheck-all');
    if (btnUncheckAll) btnUncheckAll.addEventListener('click', uncheckAll);

    const btnCopyUncheck = document.getElementById('btn-copy-uncheck-tags');
    if (btnCopyUncheck) btnCopyUncheck.addEventListener('click', copyUncheckedTags);

    const btnSyncNow = document.getElementById('btn-sync-now');
    if (btnSyncNow) btnSyncNow.addEventListener('click', () => checkAndSyncGoogleSheet(true, false));

    const btnOpenAddModal = document.getElementById('btn-open-add-modal');
    if (btnOpenAddModal) btnOpenAddModal.addEventListener('click', openAddModal);

    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeAddModal);

    const btnCancelModal = document.getElementById('btn-cancel-modal');
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeAddModal);

    const memberForm = document.getElementById('member-form');
    if (memberForm) memberForm.addEventListener('submit', handleAddMemberSubmit);

    const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
    if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener('click', closeDeleteModal);

    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);

    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmDeleteMember);

    const btnOpenSheet = document.getElementById('btn-open-sheet-modal');
    if (btnOpenSheet) btnOpenSheet.addEventListener('click', openSheetModal);

    const btnCloseSheet = document.getElementById('btn-close-sheet-modal');
    if (btnCloseSheet) btnCloseSheet.addEventListener('click', closeSheetModal);

    const btnCloseSheetBtn = document.getElementById('btn-close-sheet-modal-btn');
    if (btnCloseSheetBtn) btnCloseSheetBtn.addEventListener('click', closeSheetModal);

    // Ủy quyền sự kiện trên Table Body
    const tbody = document.getElementById('attendance-table-body');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const checkBtn = e.target.closest('.btn-check-toggle');
        if (checkBtn) {
          toggleCheck(checkBtn.dataset.row, checkBtn.dataset.staff);
          return;
        }

        const tagBtn = e.target.closest('.btn-tag');
        if (tagBtn) {
          const tag = tagBtn.dataset.tag;
          copyToClipboard(tag, tagBtn);
          return;
        }

        const deleteBtn = e.target.closest('.btn-delete-member');
        if (deleteBtn) {
          promptDeleteMember(deleteBtn.dataset.row);
          return;
        }
      });
    }
  }

  // ==========================================================================
  // 14. TIỆN ÍCH (TOAST, CLOCK & ESCAPE HTML)
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '✕';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
      }, 300);
    }, 3200);
  }

  function setupClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');

    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      if (timeEl) timeEl.textContent = `${hours}:${minutes}:${seconds}`;

      const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = daysOfWeek[now.getDay()];
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();

      if (dateEl) dateEl.textContent = `${dayName}, ${day}/${month}/${year}`;
    };

    updateClock();
    setInterval(updateClock, 1000);
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Khởi động khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
