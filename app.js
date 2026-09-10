/**
 * Hệ Thống Điểm Danh BOSS (Đồng Bộ Google Sheets)
 * app.js - Xử lý điểm danh Boss, copy tag @MãNV và đồng bộ 2 chiều với Google Sheets
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
    STAFF: 'ATTENDANCE_STAFF_V3',
    BOSS: 'ATTENDANCE_BOSS_V3'
  };

  // ==========================================================================
  // 2. STATE CỦA ỨNG DỤNG (CHỈ LẤY DANH SÁCH BOSS)
  // ==========================================================================
  let state = {
    currentCategory: 'BOSS',
    bossList: [],
    memberToDelete: null,
    isSyncing: false
  };

  // ==========================================================================
  // 3. KHỞI TẠO ỨNG DỤNG
  // ==========================================================================
  function init() {
    setupClock();
    setupEventListeners();
    loadLocalFallbackData();
    checkAndSyncGoogleSheet();
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
  // 4. KẾT NỐI VÀ ĐỒNG BỘ GOOGLE SHEETS
  // ==========================================================================
  function getSheetUrl() {
    return (window.DEFAULT_SHEET_URL || '').trim();
  }

  async function checkAndSyncGoogleSheet(isManual = false) {
    const sheetUrl = getSheetUrl();
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (!sheetUrl) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Lưu Cục Bộ';
      return;
    }

    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Đang Đồng Bộ Sheet...';
    state.isSyncing = true;

    try {
      const fetchUrl = `${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}action=getAll&_t=${Date.now()}`;
      const res = await fetch(fetchUrl);
      const json = await res.json();

      if (json.status === 'success') {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Google Sheet: Đã Kết Nối';

        // Ưu tiên 1: Dữ liệu từ mảng bossList
        if (Array.isArray(json.bossList) && json.bossList.length > 0) {
          state.bossList = json.bossList;
        } 
        // Ưu tiên 2: Trích xuất từ mảng stores nếu Google Sheet chưa cập nhật code mới
        else if (Array.isArray(json.stores) && json.stores.length > 0) {
          const seen = new Set();
          const extracted = [];
          json.stores.forEach((st, idx) => {
            const bName = (st.boss || '').trim();
            if (bName && !seen.has(bName)) {
              seen.add(bName);
              extracted.push({
                row: idx + 2,
                stt: extracted.length + 1,
                name: bName,
                isChecked: Boolean(json.attendance && json.attendance[st.id]),
                tag: extractTag(bName)
              });
            }
          });
          if (extracted.length > 0) {
            state.bossList = extracted;
          }
        }

        saveLocalFallback();
        renderTabs();
        renderTable();
        updateStats();

        if (isManual) {
          showToast('Đồng bộ danh sách Boss từ Google Sheet thành công!', 'success');
        }
      } else {
        throw new Error(json.message || 'Lỗi từ Sheet');
      }
    } catch (err) {
      console.warn('Lỗi kết nối Google Sheets:', err);
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Lỗi Kết Nối Google Sheet';
      if (isManual) {
        showToast('Không thể kết nối Google Sheet: ' + err.message, 'error');
      }
    } finally {
      state.isSyncing = false;
    }
  }

  // Gửi lệnh lên Google Apps Script (Hỗ trợ cả POST và GET)
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
      console.warn('Lỗi gửi cập nhật sang Google Sheet:', err);
    }
  }

  // ==========================================================================
  // 5. TRÍCH XUẤT TAG CÚ PHÁP @MãNV (VÍ DỤ: "Hoa_7721" -> "@7721")
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
  // 6. ĐỒNG HỒ & GIAO DIỆN CHUYỂN TAB
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
  // 7. RENDER BẢNG ĐIỂM DANH
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
      if (isChecked) {
        tr.classList.add('row-checked');
      }

      tr.innerHTML = `
        <td class="col-stt"><span class="stt-badge">${item.stt || (index + 1)}</span></td>
        <td class="col-boss member-cell">${escapeHtml(item.name)}</td>
        <td class="col-check">
          <button class="btn-check-toggle ${isChecked ? 'checked' : 'unchecked'}" data-row="${item.row}">
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

  // ==========================================================================
  // 8. CẬP NHẬT THỐNG KÊ (STATS)
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
  // 9. ĐIỂM DANH: TOGGLE, CHECK ALL, UNCHECK ALL
  // ==========================================================================
  function toggleCheck(rowNumber) {
    const activeList = getActiveList();
    const item = activeList.find(i => String(i.row) === String(rowNumber));
    if (!item) return;

    item.isChecked = !item.isChecked;
    setActiveList(activeList);
    renderTable();
    updateStats();

    // Gửi cập nhật lên Google Sheet
    sendToGoogleSheet({
      action: 'updateCheck',
      sheet: getCurrentSheetName(),
      row: item.row,
      isChecked: item.isChecked
    });
  }

  function checkAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    activeList.forEach(item => {
      item.isChecked = true;
    });

    setActiveList(activeList);
    renderTable();
    updateStats();
    showToast(`Đã check tất cả trong mục ${getCurrentSheetName()}!`, 'success');

    sendToGoogleSheet({
      action: 'checkAll',
      sheet: getCurrentSheetName(),
      isChecked: true
    });
  }

  function uncheckAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    activeList.forEach(item => {
      item.isChecked = false;
    });

    setActiveList(activeList);
    renderTable();
    updateStats();
    showToast(`Đã bỏ check tất cả trong mục ${getCurrentSheetName()}!`, 'info');

    sendToGoogleSheet({
      action: 'checkAll',
      sheet: getCurrentSheetName(),
      isChecked: false
    });
  }

  // ==========================================================================
  // 10. COPY TAG TÊN VÀO CLIPBOARD
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
  // 11. THÊM / XOÁ NGƯỜI
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

    sendToGoogleSheet({
      action: 'addMember',
      sheet: getCurrentSheetName(),
      name: name
    });
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

    sendToGoogleSheet({
      action: 'deleteMember',
      sheet: getCurrentSheetName(),
      row: row
    });
  }

  // ==========================================================================
  // 12. CẤU HÌNH GOOGLE SHEETS MODAL
  // ==========================================================================
  function openSheetModal() {
    document.getElementById('sheet-url-input').value = getSheetUrl();
    document.getElementById('sheet-modal').classList.add('open');
  }

  function closeSheetModal() {
    document.getElementById('sheet-modal').classList.remove('open');
  }

  // ==========================================================================
  // 13. XUẤT CSV & SAO LƯU DỮ LIỆU
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
  // 14. BẮT SỰ KIỆN GIAO DIỆN
  // ==========================================================================
  function setupEventListeners() {
    // Chuyển category Tab (nếu có)
    const btnStaff = document.getElementById('tab-btn-staff');
    if (btnStaff) btnStaff.addEventListener('click', () => switchCategory('NHAN_VIEN'));
    const btnBoss = document.getElementById('tab-btn-boss');
    if (btnBoss) btnBoss.addEventListener('click', () => switchCategory('BOSS'));

    // Tìm kiếm
    document.getElementById('search-input').addEventListener('input', renderTable);

    // Thao tác nhanh
    document.getElementById('btn-check-all').addEventListener('click', checkAll);
    document.getElementById('btn-uncheck-all').addEventListener('click', uncheckAll);
    document.getElementById('btn-copy-uncheck-tags').addEventListener('click', copyUncheckedTags);
    document.getElementById('btn-sync-now').addEventListener('click', () => checkAndSyncGoogleSheet(true));

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
    document.getElementById('btn-open-sheet-modal').addEventListener('click', openSheetModal);
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
        toggleCheck(checkBtn.dataset.row);
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
