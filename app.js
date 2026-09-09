/**
 * Hệ Thống Điểm Danh Siêu Thị & Boss (Đồng Bộ Đa Thiết Bị Qua Google Sheets)
 * app.js - Xử lý điểm danh, gọi Google Apps Script Web App, đồng bộ và sao lưu
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. DANH SÁCH 24 SIÊU THỊ & BOSS GỐC
  // ==========================================================================
  const DEFAULT_STORES = [
    { id: 'st-1', name: 'ĐML_CMA_CMA - 155A Nguyễn Tất Thành', boss: 'Khắc_30653' },
    { id: 'st-2', name: 'ĐML_CMA_CMA - 18 Ngô Quyền', boss: 'An_59690' },
    { id: 'st-3', name: 'ĐML_CMA_CMA - 12 Trần Hưng Đạo', boss: 'Thi_51929' },
    { id: 'st-4', name: 'ĐMM_CMA_PTA - Cái Đôi Vàm', boss: 'Ngoan_21966' },
    { id: 'st-5', name: 'ĐMM_CMA_DDO - Đường 19/5 (Đầm Dơi)', boss: 'Tâm_146168' },
    { id: 'st-6', name: 'ĐMM_CMA_TBI - Thới Bình', boss: 'Phi_161470' },
    { id: 'st-7', name: 'ĐMM_CMA_CNU - 288 Quốc Lộ 1A', boss: 'Sơn_7699' },
    { id: 'st-8', name: 'ĐMM_CMA_CMA - Tắc Vân', boss: 'Thảo_40924' },
    { id: 'st-9', name: 'ĐMM_CMA_CNU - Thạnh Phú', boss: 'Nhẫn_7712' },
    { id: 'st-10', name: 'ĐMM_CMA_TVT - Sông Đốc', boss: 'Quy_63172' },
    { id: 'st-11', name: 'ĐMM_CMA_UMI - U Minh', boss: 'Toàn_44474' },
    { id: 'st-12', name: 'ĐMM_CMA_NCA - Năm Căn', boss: 'Nhựt_63527' },
    { id: 'st-13', name: 'ĐMM_CMA_TBI - Tân Lộc', boss: 'Tính_43746' },
    { id: 'st-14', name: 'ĐMS_CMA_NHI - Đất Mũi', boss: 'Nhựt_63527' },
    { id: 'st-15', name: 'ĐMS_CMA_TBI - Nhà Máy B', boss: 'Nam_171275' },
    { id: 'st-16', name: 'ĐMS_CMA_PTA - Phú Tân', boss: 'Ngoan_21966' },
    { id: 'st-17', name: 'ĐMS_CMA_UMI - Khánh Hội', boss: 'Tiên_41189' },
    { id: 'st-18', name: 'ĐMS_CMA_TVT - Trần Văn Thời', boss: 'Tiên_41189' },
    { id: 'st-19', name: 'ĐMS_CMA_CNU - Hưng Mỹ', boss: 'Nhẫn_7712' },
    { id: 'st-20', name: 'ĐMS_CMA_UMI - Khánh Lâm', boss: 'Toàn_44474' },
    { id: 'st-21', name: 'ĐMS_CMA_TVT - Khánh Bình Tây', boss: 'Tiên_41189' },
    { id: 'st-22', name: 'ĐMS_CMA_TBI - Trí Phải', boss: 'Nam_171275' },
    { id: 'st-23', name: 'ĐMS_CMA_PTA - Phú Thuận', boss: 'Ngoan_21966' },
    { id: 'st-24', name: 'ĐMS_CMA_DDO - Tân Tiến', boss: 'Tâm_146168' }
  ];

  const STORAGE_KEYS = {
    STORES: 'ATTENDANCE_STORES_V2',
    ATTENDANCE: 'ATTENDANCE_RECORDS_V2',
    CUSTOM_SHEET_URL: 'CUSTOM_GOOGLE_SHEET_URL_V1'
  };

  // ==========================================================================
  // 2. STATE CỦA ỨNG DỤNG
  // ==========================================================================
  let state = {
    stores: [],
    attendance: {}, // { "YYYY-MM-DD": { [storeId]: true/false } }
    selectedDate: getTodayDateString(),
    storeToDelete: null,
    isSheetConnected: false,
    isSyncing: false
  };

  // ==========================================================================
  // 3. KHỞI TẠO ỨNG DỤNG
  // ==========================================================================
  function init() {
    setupClock();
    setupDateSelector();
    setupEventListeners();
    loadLocalFallbackData();

    // Kiểm tra và kết nối Google Sheets
    checkAndSyncGoogleSheet();
  }

  function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function loadLocalFallbackData() {
    try {
      const savedStores = localStorage.getItem(STORAGE_KEYS.STORES);
      const savedAttendance = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);

      state.stores = savedStores ? JSON.parse(savedStores) : [...DEFAULT_STORES];
      state.attendance = savedAttendance ? JSON.parse(savedAttendance) : {};
    } catch (err) {
      console.warn('Lỗi đọc LocalStorage:', err);
      state.stores = [...DEFAULT_STORES];
      state.attendance = {};
    }
    renderTable();
    updateStats();
  }

  function saveLocalFallback() {
    try {
      localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(state.stores));
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(state.attendance));
    } catch (e) {}
  }

  // ==========================================================================
  // 4. KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS
  // ==========================================================================
  function getSheetUrl() {
    if (window.DEFAULT_SHEET_URL && window.DEFAULT_SHEET_URL.trim().startsWith('http')) {
      return window.DEFAULT_SHEET_URL.trim();
    }
    const custom = localStorage.getItem(STORAGE_KEYS.CUSTOM_SHEET_URL);
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim();
    }
    return null;
  }

  async function checkAndSyncGoogleSheet(isManual = false) {
    const sheetUrl = getSheetUrl();
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const alertBanner = document.getElementById('sheet-alert-banner');

    if (!sheetUrl) {
      state.isSheetConnected = false;
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Lưu Cục Bộ (Chưa Nối Sheet)';
      alertBanner.style.display = 'flex';
      return;
    }

    alertBanner.style.display = 'none';
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Đang Đồng Bộ Sheet...';
    state.isSyncing = true;

    try {
      // Gọi GET đến Google Apps Script Web App
      const fetchUrl = `${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}action=get&date=${state.selectedDate}&_t=${Date.now()}`;
      const res = await fetch(fetchUrl);
      const json = await res.json();

      if (json.status === 'success') {
        state.isSheetConnected = true;
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Google Sheet: Đã Kết Nối';

        // Cập nhật danh sách siêu thị từ Sheet
        if (json.stores && json.stores.length > 0) {
          state.stores = json.stores;
        }

        // Cập nhật trạng thái điểm danh ngày hôm đó từ Sheet
        if (json.attendance) {
          state.attendance[state.selectedDate] = json.attendance;
        }

        saveLocalFallback();
        renderTable();
        updateStats();

        if (isManual) {
          showToast('Đồng bộ dữ liệu từ Google Sheet thành công!', 'success');
        }
      } else {
        throw new Error(json.message || 'Lỗi trả về từ Sheet');
      }
    } catch (err) {
      console.error('Lỗi kết nối Google Sheets:', err);
      state.isSheetConnected = false;
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Lỗi Kết Nối Google Sheet';
      if (isManual) {
        showToast('Không thể kết nối Google Sheet: ' + err.message, 'error');
      }
    } finally {
      state.isSyncing = false;
    }
  }

  // Gửi thay đổi lên Google Apps Script (Hỗ trợ cả POST và GET để tương thích 100%)
  async function sendToGoogleSheet(params) {
    const sheetUrl = getSheetUrl();
    if (!sheetUrl) return;

    try {
      // 1. Gửi qua POST
      fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(params)
      }).catch(() => {});

      // 2. Đồng thời gửi kèm qua GET query params
      const query = Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
      const sep = sheetUrl.includes('?') ? '&' : '?';
      fetch(`${sheetUrl}${sep}${query}&_t=${Date.now()}`, { mode: 'no-cors' }).catch(() => {});
    } catch (err) {
      console.warn('Lỗi gửi dữ liệu lên Google Sheet:', err);
    }
  }

  // ==========================================
  // 5. TRÍCH XUẤT TAG CÚ PHÁP @MãNV
  // ==========================================
  function extractTag(bossStr) {
    if (!bossStr) return '@';
    const trimmed = bossStr.trim();
    const parts = trimmed.split('_');
    if (parts.length > 1) {
      return '@' + parts[parts.length - 1].trim();
    }
    const numMatch = trimmed.match(/\d+/);
    if (numMatch) return '@' + numMatch[0];
    return '@' + trimmed;
  }

  // ==========================================
  // 6. ĐỒNG HỒ & CHỌN NGÀY
  // ==========================================
  function setupClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    function update() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      timeEl.textContent = `${hh}:${mm}:${ss}`;

      const dayName = weekdays[now.getDay()];
      const dd = String(now.getDate()).padStart(2, '0');
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const yy = now.getFullYear();
      dateEl.textContent = `${dayName}, ${dd}/${mo}/${yy}`;
    }

    update();
    setInterval(update, 1000);
  }

  function setupDateSelector() {
    const dateInput = document.getElementById('attendance-date');
    dateInput.value = state.selectedDate;

    dateInput.addEventListener('change', (e) => {
      changeDate(e.target.value || getTodayDateString());
    });

    document.getElementById('btn-prev-day').addEventListener('click', () => {
      const d = new Date(state.selectedDate);
      d.setDate(d.getDate() - 1);
      changeDate(d.toISOString().split('T')[0]);
    });

    document.getElementById('btn-next-day').addEventListener('click', () => {
      const d = new Date(state.selectedDate);
      d.setDate(d.getDate() + 1);
      changeDate(d.toISOString().split('T')[0]);
    });

    document.getElementById('btn-today').addEventListener('click', () => {
      changeDate(getTodayDateString());
    });
  }

  function changeDate(newDate) {
    state.selectedDate = newDate;
    document.getElementById('attendance-date').value = newDate;

    renderTable();
    updateStats();

    // Tự động kéo dữ liệu ngày đó từ Google Sheet nếu có mạng
    if (getSheetUrl()) {
      checkAndSyncGoogleSheet();
    }
  }

  // ==========================================
  // 7. RENDER BẢNG ĐIỂM DANH
  // ==========================================
  function renderTable() {
    const tbody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('attendance-table');
    const searchTerm = (document.getElementById('search-input').value || '').toLowerCase().trim();

    const filtered = state.stores.filter(store => {
      const matchName = (store.name || '').toLowerCase().includes(searchTerm);
      const matchBoss = (store.boss || '').toLowerCase().includes(searchTerm);
      const matchTag = extractTag(store.boss).toLowerCase().includes(searchTerm);
      return matchName || matchBoss || matchTag;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      table.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    table.style.display = 'table';

    const dayRecords = state.attendance[state.selectedDate] || {};

    filtered.forEach((store, index) => {
      const isChecked = Boolean(dayRecords[store.id]);
      const tagText = extractTag(store.boss);

      const tr = document.createElement('tr');
      if (isChecked) {
        tr.classList.add('row-checked');
      }

      tr.innerHTML = `
        <td style="text-align: center;"><span class="stt-badge">${index + 1}</span></td>
        <td class="store-cell">${escapeHtml(store.name)}</td>
        <td><span class="boss-badge">👤 ${escapeHtml(store.boss)}</span></td>
        <td style="text-align: center;">
          <button class="btn-check-toggle ${isChecked ? 'checked' : 'unchecked'}" data-id="${store.id}">
            ${isChecked ? '✅ Đã Check' : '⚪ Chưa Check'}
          </button>
        </td>
        <td style="text-align: center;">
          <button class="btn-tag" data-tag="${escapeHtml(tagText)}" title="Bấm để copy tag ${escapeHtml(tagText)}">
            🏷️ ${escapeHtml(tagText)}
          </button>
        </td>
        <td style="text-align: center;">
          <button class="btn-delete-row" data-id="${store.id}" title="Xoá siêu thị">
            🗑️
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // ==========================================
  // 8. CẬP NHẬT THỐNG KÊ (STATS)
  // ==========================================
  function updateStats() {
    const total = state.stores.length;
    const dayRecords = state.attendance[state.selectedDate] || {};
    
    let checkedCount = 0;
    state.stores.forEach(st => {
      if (dayRecords[st.id]) {
        checkedCount++;
      }
    });

    const uncheckedCount = total - checkedCount;
    const rate = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-checked').textContent = checkedCount;
    document.getElementById('stat-unchecked').textContent = uncheckedCount;
    document.getElementById('stat-rate').textContent = `${rate}%`;
  }

  // ==========================================
  // 9. ĐIỂM DANH: TOGGLE, CHECK ALL, UNCHECK ALL
  // ==========================================
  function toggleCheck(storeId) {
    if (!state.attendance[state.selectedDate]) {
      state.attendance[state.selectedDate] = {};
    }

    const current = Boolean(state.attendance[state.selectedDate][storeId]);
    const nextVal = !current;

    // Cập nhật giao diện ngay lập tức
    state.attendance[state.selectedDate][storeId] = nextVal;
    saveLocalFallback();
    renderTable();
    updateStats();

    // Gửi cập nhật lên Google Sheet trong nền
    sendToGoogleSheet({
      action: 'updateCheck',
      date: state.selectedDate,
      storeId: storeId,
      isChecked: nextVal
    });
  }

  function checkAll() {
    if (state.stores.length === 0) return;

    if (!state.attendance[state.selectedDate]) {
      state.attendance[state.selectedDate] = {};
    }

    state.stores.forEach(st => {
      state.attendance[state.selectedDate][st.id] = true;
    });

    saveLocalFallback();
    renderTable();
    updateStats();
    showToast('Đã điểm danh (Check) toàn bộ siêu thị!', 'success');

    // Gửi lên Google Sheet
    sendToGoogleSheet({
      action: 'checkAll',
      date: state.selectedDate,
      isChecked: true
    });
  }

  function uncheckAll() {
    state.attendance[state.selectedDate] = {};
    saveLocalFallback();
    renderTable();
    updateStats();
    showToast('Đã đặt lại trạng thái Chưa Check!', 'info');

    // Gửi lên Google Sheet
    sendToGoogleSheet({
      action: 'checkAll',
      date: state.selectedDate,
      isChecked: false
    });
  }

  // ==========================================
  // 10. COPY TAG TÊN VÀO BỘ NHỚ TẠM (CLIPBOARD)
  // ==========================================
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
    const dayRecords = state.attendance[state.selectedDate] || {};
    const uncheckedStores = state.stores.filter(st => !dayRecords[st.id]);

    if (uncheckedStores.length === 0) {
      showToast('Tuyệt vời! Tất cả siêu thị đều đã được điểm danh.', 'success');
      return;
    }

    const tags = uncheckedStores.map(st => extractTag(st.boss));
    const uniqueTags = Array.from(new Set(tags));
    const resultText = uniqueTags.join(' ');

    copyToClipboard(resultText);
    showToast(`Đã copy ${uniqueTags.length} tag của các Boss chưa điểm danh!`, 'warning');
  }

  // ==========================================
  // 11. THÊM / XOÁ SIÊU THỊ
  // ==========================================
  function openAddModal() {
    document.getElementById('store-form').reset();
    document.getElementById('store-id-hidden').value = '';
    document.getElementById('modal-title').textContent = 'Thêm Siêu Thị & Boss Mới';
    document.getElementById('store-modal').classList.add('open');
    document.getElementById('store-name').focus();
  }

  function closeModal() {
    document.getElementById('store-modal').classList.remove('open');
  }

  function handleSaveStore(e) {
    e.preventDefault();
    const name = document.getElementById('store-name').value.trim();
    const boss = document.getElementById('store-boss').value.trim();

    if (!name || !boss) {
      showToast('Vui lòng điền đầy đủ Tên siêu thị và Boss!', 'error');
      return;
    }

    const newId = 'st-' + Date.now();
    const newStore = { id: newId, name, boss };

    state.stores.push(newStore);
    saveLocalFallback();
    closeModal();
    renderTable();
    updateStats();
    showToast(`Đã thêm siêu thị "${name}"!`, 'success');

    // Đồng bộ lên Google Sheet
    sendToGoogleSheet({
      action: 'addStore',
      name: name,
      boss: boss
    });
  }

  function promptDeleteStore(storeId) {
    const store = state.stores.find(s => s.id === storeId);
    if (!store) return;

    state.storeToDelete = store;
    document.getElementById('delete-store-name').textContent = `${store.name} (${store.boss})`;
    document.getElementById('delete-modal').classList.add('open');
  }

  function closeDeleteModal() {
    state.storeToDelete = null;
    document.getElementById('delete-modal').classList.remove('open');
  }

  function confirmDeleteStore() {
    if (!state.storeToDelete) return;
    const storeId = state.storeToDelete.id;
    const storeName = state.storeToDelete.name;

    state.stores = state.stores.filter(s => s.id !== storeId);
    saveLocalFallback();
    closeDeleteModal();
    renderTable();
    updateStats();
    showToast(`Đã xoá siêu thị "${storeName}"!`, 'success');

    // Đồng bộ xoá trên Google Sheet
    sendToGoogleSheet({
      action: 'deleteStore',
      storeId: storeId
    });
  }

  function resetToDefault() {
    if (confirm('Bạn có chắc muốn khôi phục lại danh sách gốc 24 siêu thị?')) {
      state.stores = [...DEFAULT_STORES];
      saveLocalFallback();
      renderTable();
      updateStats();
      showToast('Đã khôi phục 24 siêu thị mặc định!', 'success');

      sendToGoogleSheet({
        action: 'resetStores'
      });
    }
  }

  // ==========================================
  // 12. CẤU HÌNH GOOGLE SHEETS MODAL
  // ==========================================
  function openSheetModal() {
    const current = localStorage.getItem(STORAGE_KEYS.CUSTOM_SHEET_URL) || window.DEFAULT_SHEET_URL || '';
    document.getElementById('sheet-url-input').value = current;
    document.getElementById('sheet-modal').classList.add('open');
  }

  function closeSheetModal() {
    document.getElementById('sheet-modal').classList.remove('open');
  }

  function handleSaveSheet() {
    const url = document.getElementById('sheet-url-input').value.trim();

    if (!url || !url.startsWith('http')) {
      showToast('Đường link Google Apps Script không hợp lệ!', 'error');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.CUSTOM_SHEET_URL, url);
    closeSheetModal();
    showToast('Đã lưu URL Google Sheet! Đang đồng bộ...', 'success');

    // Đồng bộ ngay lập tức
    checkAndSyncGoogleSheet(true);
  }

  function handleClearSheet() {
    if (confirm('Bạn có chắc muốn xoá liên kết Google Sheet?')) {
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_SHEET_URL);
      closeSheetModal();
      showToast('Đã xoá liên kết Google Sheet.', 'info');
      checkAndSyncGoogleSheet();
    }
  }

  // ==========================================
  // 13. XUẤT CSV & SAO LƯU DỮ LIỆU
  // ==========================================
  function exportCSV() {
    const dayRecords = state.attendance[state.selectedDate] || {};
    const rows = [
      ['BÁO CÁO ĐIỂM DANH SIÊU THỊ & BOSS'],
      [`Ngày điểm danh: ${state.selectedDate}`],
      [],
      ['STT', 'SIÊU THỊ', 'BOSS', 'TRẠNG THÁI', 'TAG CÚ PHÁP']
    ];

    state.stores.forEach((st, idx) => {
      const isChecked = Boolean(dayRecords[st.id]);
      rows.push([
        idx + 1,
        st.name,
        st.boss,
        isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH',
        extractTag(st.boss)
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Diem_Danh_Sieu_Thi_${state.selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file CSV thành công!', 'success');
  }

  function backupData() {
    const data = {
      stores: state.stores,
      attendance: state.attendance,
      exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_sieu_thi_${state.selectedDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file sao lưu!', 'success');
  }

  function restoreData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const data = JSON.parse(event.target.result);
        if (data && Array.isArray(data.stores)) {
          state.stores = data.stores;
          state.attendance = data.attendance || {};
          saveLocalFallback();
          renderTable();
          updateStats();
          showToast('Khôi phục dữ liệu thành công!', 'success');
        } else {
          showToast('File sao lưu không hợp lệ!', 'error');
        }
      } catch (err) {
        showToast('Lỗi đọc file: ' + err.message, 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // ==========================================
  // 14. BẮT SỰ KIỆN GIAO DIỆN
  // ==========================================
  function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('btn-check-all').addEventListener('click', checkAll);
    document.getElementById('btn-uncheck-all').addEventListener('click', uncheckAll);
    document.getElementById('btn-copy-uncheck-tags').addEventListener('click', copyUncheckedTags);
    document.getElementById('btn-sync-now').addEventListener('click', () => checkAndSyncGoogleSheet(true));

    // Thêm siêu thị
    document.getElementById('btn-open-add-modal').addEventListener('click', openAddModal);
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('store-form').addEventListener('submit', handleSaveStore);

    // Xoá siêu thị
    document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteStore);

    // Cài đặt Google Sheet
    document.getElementById('btn-open-sheet-modal').addEventListener('click', openSheetModal);
    document.getElementById('btn-alert-setup-sheet').addEventListener('click', openSheetModal);
    document.getElementById('btn-close-sheet-modal').addEventListener('click', closeSheetModal);
    document.getElementById('btn-cancel-sheet-modal').addEventListener('click', closeSheetModal);
    document.getElementById('btn-save-sheet').addEventListener('click', handleSaveSheet);
    document.getElementById('btn-clear-sheet').addEventListener('click', handleClearSheet);

    // Khôi phục mặc định & Xuất CSV & Sao lưu
    document.getElementById('btn-reset-default').addEventListener('click', resetToDefault);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-backup-data').addEventListener('click', backupData);
    document.getElementById('input-restore-file').addEventListener('change', restoreData);

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
        toggleCheck(checkBtn.dataset.id);
        return;
      }

      const tagBtn = e.target.closest('.btn-tag');
      if (tagBtn) {
        copyToClipboard(tagBtn.dataset.tag, tagBtn);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-row');
      if (deleteBtn) {
        promptDeleteStore(deleteBtn.dataset.id);
      }
    });
  }

  // ==========================================
  // 15. TIỆN ÍCH (TOAST & ESCAPE HTML)
  // ==========================================
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
