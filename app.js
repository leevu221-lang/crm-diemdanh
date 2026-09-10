/**
 * Hệ Thống Điểm Danh BOSS (Đồng Bộ Google Sheets Siêu Tốc)
 * app.js - Xử lý điểm danh Boss, copy tag @MãNV và đồng bộ 2 chiều thời gian thực với Google Sheets
 * 
 * Các cải tiến hiệu năng cao:
 * 1. Zero-Latency Optimistic UI (< 1ms): Phản hồi ngay tức thì khi bấm, không chờ mạng.
 * 2. Single Fast Transport: Chấm dứt gửi kép (POST + GET), giảm 50% tải lên máy chủ Google.
 * 3. Debounce Batch Queue: Gộp nhiều thao tác bấm liên tiếp gửi trong 1 request.
 * 4. Smart Background Auto-Polling (mỗi 5s): Đồng bộ ngầm 2 chiều giữa tất cả các điện thoại.
 * 5. Non-destructive DOM Diffing: Cập nhật êm dịu, không vẽ lại bảng gây giật lag hay mất vị trí cuộn.
 * 6. Instant Tab Sync: Tự động cập nhật ngay khi mở lại màn hình điện thoại hoặc chuyển tab.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. DỮ LIỆU GỐC DỰ PHÒNG CHO TRANG "BOSS"
  // ==========================================================================

  const DEFAULT_BOSS = [
    { row: 2, stt: 1, name: 'Khắc_30653', isChecked: false },
    { row: 3, stt: 2, name: 'An_59690', isChecked: false },
    { row: 4, stt: 3, name: 'Thi_51929', isChecked: false },
    { row: 5, stt: 4, name: 'Ngoan_21966', isChecked: false },
    { row: 6, stt: 5, name: 'Tâm_146168', isChecked: false },
    { row: 7, stt: 6, name: 'Phi_161470', isChecked: false },
    { row: 8, stt: 7, name: 'Sơn_7699', isChecked: false },
    { row: 9, stt: 8, name: 'Thảo_40924', isChecked: false },
    { row: 10, stt: 9, name: 'Nhẫn_7712', isChecked: false },
    { row: 11, stt: 10, name: 'Quy_63172', isChecked: false },
    { row: 12, stt: 11, name: 'Toàn_44474', isChecked: false },
    { row: 13, stt: 12, name: 'Nhựt_63527', isChecked: false },
    { row: 14, stt: 13, name: 'Tính_43746', isChecked: false },
    { row: 15, stt: 14, name: 'Nam_171275', isChecked: false },
    { row: 16, stt: 15, name: 'Tiên_41189', isChecked: false }
  ];

  const STORAGE_KEYS = {
    BOSS: 'ATTENDANCE_BOSS_V4'
  };

  const POLL_INTERVAL_MS = 5000; // Chu kỳ đồng bộ ngầm: 5 giây

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
  const pendingSyncKeys = new Set(); // Các Boss đang chờ máy chủ xác nhận
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
    return 'BOSS';
  }

  // ==========================================================================
  // 4. KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS SIÊU TỐC
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
      if (statusText) statusText.textContent = 'Đang Đồng Bộ...';
    }

    state.isSyncing = true;

    try {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      // Gọi API đọc dữ liệu (tận dụng CacheService phía Apps Script)
      const fetchUrl = `${sheetUrl}${sep}action=getAll&_t=${Date.now()}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      const json = await res.json();

      if (json.status === 'success') {
        if (statusDot) statusDot.className = 'status-dot online';
        if (statusText) statusText.textContent = 'Google Sheet: Đã Kết Nối';

        let incomingBossList = [];

        // 1. Dữ liệu từ mảng bossList chuẩn
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
        // 2. Gom nhóm từ mảng stores nếu trả về danh sách siêu thị
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
          showToast('Đồng bộ dữ liệu từ Google Sheet thành công!', 'success');
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

  // Hợp nhất dữ liệu mới từ máy chủ một cách êm ái (Non-destructive update)
  function mergeIncomingBossData(incomingList, isBackground) {
    let hasChanges = false;
    let listLengthChanged = incomingList.length !== state.bossList.length;

    // Nếu số lượng người thay đổi hoặc lần đầu tiên tải: render lại toàn bộ
    if (listLengthChanged || state.bossList.length === 0) {
      state.bossList = incomingList;
      saveLocalFallback();
      renderTabs();
      renderTable();
      updateStats();
      return;
    }

    // Nếu danh sách cùng số lượng: cập nhật từng dòng không gây giật màn hình
    incomingList.forEach(incoming => {
      const localItem = state.bossList.find(i => i.name === incoming.name);
      if (!localItem) return;

      // Cập nhật thông tin hàng
      localItem.row = incoming.row;
      localItem.rows = incoming.rows;

      // Nếu mục này đang được người dùng bấm trên máy này và chưa xác nhận xong: giữ nguyên
      if (pendingSyncKeys.has(localItem.name)) return;

      // Nếu trạng thái check trên Sheet khác với máy hiện tại: cập nhật DOM êm dịu
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
  // 5. HÀNG ĐỢI GỬI LÊN GOOGLE SHEETS (DEBOUNCE BATCH QUEUE & SINGLE FAST GET)
  // ==========================================================================

  function queueSyncAction(item) {
    pendingSyncKeys.add(item.name);

    // Kiểm tra xem Boss này đã có trong hàng đợi chưa, nếu có thì cập nhật trạng thái mới nhất
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
    // Cửa sổ gom lệnh 250ms: nếu bấm liên tiếp nhiều Boss sẽ được gộp vào 1 request duy nhất!
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
        // Gửi lệnh đơn lẻ siêu nhanh
        const item = batch[0];
        const params = new URLSearchParams({
          action: 'updateCheck',
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
          items: JSON.stringify(payload),
          _t: String(Date.now())
        });
        await fetch(`${sheetUrl}${sep}${params.toString()}`);
      }
    } catch (err) {
      console.warn('Lỗi gửi đồng bộ lên Sheet:', err);
    } finally {
      // Giữ key trong 1.5s để bảo vệ trạng thái cục bộ khỏi bị đè bởi các lần polling đến sau
      setTimeout(() => {
        batch.forEach(b => pendingSyncKeys.delete(b.boss));
      }, 1500);

      isFlushingQueue = false;

      // Nếu có người bấm mới trong khi đang gửi, tiếp tục gửi nốt
      if (pendingSyncQueue.length > 0) {
        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(flushSyncQueue, 200);
      }
    }
  }

  // ==========================================================================
  // 6. ĐỒNG BỘ NGẦM THÔNG MINH (SMART BACKGROUND AUTO-POLLING)
  // ==========================================================================
  function startSmartPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(async () => {
      // Chỉ thăm dò khi tab đang hiển thị và không có thao tác của người dùng đang chờ gửi
      if (
        document.visibilityState === 'visible' && 
        !state.isSyncing && 
        pendingSyncQueue.length === 0 && 
        !isFlushingQueue
      ) {
        await checkAndSyncGoogleSheet(false, true);
      }
    }, POLL_INTERVAL_MS);
  }

  // Tự động đồng bộ ngay khi người dùng mở lại điện thoại hoặc quay lại tab trình duyệt
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndSyncGoogleSheet(false, true);
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
  // 8. ĐỒNG HỒ & GIAO DIỆN CHUYỂN TAB
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

  function switchCategory(category) {
    state.currentCategory = 'BOSS';
    renderTabs();
    renderTable();
    updateStats();
  }

  // ==========================================================================
  // 9. RENDER BẢNG ĐIỂM DANH & CẬP NHẬT TỪNG DÒNG KHÔNG GIẬT LAG
  // ==========================================================================
  function renderTable() {
    const tbody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('attendance-table');
    const searchTerm = (document.getElementById('search-input').value || '').toLowerCase().trim();

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
        <td class="col-delete">
          <button class="btn-delete-row" data-row="${item.row}" title="Xoá Boss này khỏi Sheet">
            🗑️
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // Cập nhật đúng 1 dòng trên DOM (mượt mà, không load lại cả bảng)
  function updateSingleRowInDOM(item) {
    const tr = document.querySelector(`tr[data-boss="${CSS.escape(item.name)}"]`) ||
               document.querySelector(`button.btn-check-toggle[data-row="${item.row}"]`)?.closest('tr');
    if (!tr) return;

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

    // 1. Phản hồi Optimistic UI tức thì trên màn hình (< 1ms)
    item.isChecked = !item.isChecked;
    updateSingleRowInDOM(item);
    updateStats();
    saveLocalFallback();

    // 2. Thêm vào hàng đợi gửi ngầm lên Cột E của Google Sheet
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
    showToast('Đã check tất cả vào CỘT E!', 'success');

    // Xóa hàng đợi cũ và gửi lệnh checkAll trực tiếp
    pendingSyncQueue.length = 0;
    pendingSyncKeys.clear();

    const sheetUrl = getSheetUrl();
    if (sheetUrl) {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}action=checkAll&isChecked=true&_t=${Date.now()}`).catch(() => {});
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
      fetch(`${sheetUrl}${sep}action=checkAll&isChecked=false&_t=${Date.now()}`).catch(() => {});
    }
  }

  // ==========================================================================
  // 12. COPY TAG TÊN VÀO CLIPBOARD
  // ==========================================================================
  function copyToClipboard(text, btnElement) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        handleCopySuccess(text, btnElement);
      }).catch(() => fallbackCopyText(text, btnElement));
    } else {
      fallbackCopyText(text, btnElement);
    }
  }

  function fallbackCopyText(text, btnElement) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      handleCopySuccess(text, btnElement);
    } catch (e) {
      showToast('Không thể copy: ' + e.message, 'error');
    }
    document.body.removeChild(ta);
  }

  function handleCopySuccess(text, btnElement) {
    if (btnElement) {
      const origHtml = btnElement.innerHTML;
      btnElement.innerHTML = `✓ Đã copy!`;
      btnElement.classList.add('copied');
      setTimeout(() => {
        btnElement.innerHTML = origHtml;
        btnElement.classList.remove('copied');
      }, 1500);
    }
    showToast(`Đã copy ${text} vào bộ nhớ tạm!`, 'success');
  }

  function copyUncheckedTags() {
    const activeList = getActiveList();
    const unchecked = activeList.filter(item => !item.isChecked);

    if (unchecked.length === 0) {
      showToast(`Tuyệt vời! Tất cả ${getCurrentSheetName()} đều đã điểm danh.`, 'success');
      return;
    }

    const tags = unchecked.map(item => extractTag(item.name));
    const uniqueTags = Array.from(new Set(tags));
    const resultText = uniqueTags.join(' ');

    copyToClipboard(resultText);
    showToast(`Đã copy ${uniqueTags.length} tag của những người CHƯA CHECK!`, 'warning');
  }

  // ==========================================================================
  // 13. THÊM / XOÁ NGƯỜI
  // ==========================================================================
  function openAddModal() {
    document.getElementById('member-form').reset();
    document.getElementById('modal-title').textContent = `Thêm Mới Vào Trang "${getCurrentSheetName()}"`;
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
      fetch(`${sheetUrl}${sep}action=addMember&name=${encodeURIComponent(name)}&_t=${Date.now()}`).catch(() => {});
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
    // Đánh lại STT
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
      fetch(`${sheetUrl}${sep}action=deleteMember&row=${row}&_t=${Date.now()}`).catch(() => {});
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
    const categoryName = getCurrentSheetName();
    const today = new Date().toISOString().split('T')[0];

    const rows = [
      [`BÁO CÁO ĐIỂM DANH: ${categoryName}`],
      [`Ngày điểm danh: ${today}`],
      [],
      ['STT', categoryName, 'TRẠNG THÁI', 'TAG CÚ PHÁP']
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
    link.download = `Diem_Danh_${categoryName}_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file CSV thành công!', 'success');
  }

  function backupData() {
    const data = {
      category: 'BOSS',
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
    // Tìm kiếm
    document.getElementById('search-input').addEventListener('input', renderTable);

    // Thao tác nhanh
    document.getElementById('btn-check-all').addEventListener('click', checkAll);
    document.getElementById('btn-uncheck-all').addEventListener('click', uncheckAll);
    document.getElementById('btn-copy-uncheck-tags').addEventListener('click', copyUncheckedTags);
    const btnSyncNow = document.getElementById('btn-sync-now');
    if (btnSyncNow) btnSyncNow.addEventListener('click', () => checkAndSyncGoogleSheet(true, false));

    // Thêm người
    document.getElementById('btn-open-add-modal').addEventListener('click', openAddModal);
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('member-form').addEventListener('submit', handleSaveMember);

    // Xoá người
    document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteMember);

    // Modal Sheet
    const btnOpenSheet = document.getElementById('btn-open-sheet-modal');
    if (btnOpenSheet) btnOpenSheet.addEventListener('click', openSheetModal);
    document.getElementById('btn-close-sheet-modal').addEventListener('click', closeSheetModal);
    document.getElementById('btn-close-sheet-modal-btn').addEventListener('click', closeSheetModal);

    // Xuất CSV & Sao lưu
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-backup-data').addEventListener('click', backupData);

    // Đóng modal khi bấm nền
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        closeModal();
        closeDeleteModal();
        closeSheetModal();
      }
    });

    // Event Delegation trong bảng
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
