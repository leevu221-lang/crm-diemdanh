/**
 * Hệ Thống Điểm Danh Siêu Thị & Boss (Đồng Bộ Đa Thiết Bị Qua Firebase Realtime)
 * app.js - Xử lý điểm danh, realtime listener, sao lưu và đồng bộ
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
    CUSTOM_FIREBASE: 'CUSTOM_FIREBASE_CONFIG_V1'
  };

  // ==========================================================================
  // 2. STATE CỦA ỨNG DỤNG
  // ==========================================================================
  let state = {
    stores: [],
    attendance: {}, // { "YYYY-MM-DD": { [storeId]: true/false } }
    selectedDate: getTodayDateString(),
    storeToDelete: null,
    isFirebaseConnected: false
  };

  let db = null; // Firebase Realtime Database Instance
  let currentAttendanceRef = null;

  // ==========================================================================
  // 3. KHỞI TẠO ỨNG DỤNG
  // ==========================================================================
  function init() {
    setupClock();
    setupDateSelector();
    setupEventListeners();
    loadLocalFallbackData();

    // Thử kết nối Firebase
    initFirebase();
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
  // 4. KẾT NỐI FIREBASE REALTIME DATABASE
  // ==========================================================================
  function getActiveFirebaseConfig() {
    // 1. Kiểm tra cấu hình do người dùng dán qua UI
    const custom = localStorage.getItem(STORAGE_KEYS.CUSTOM_FIREBASE);
    if (custom) {
      try {
        const parsed = JSON.parse(custom);
        if (parsed.apiKey && (parsed.projectId || parsed.databaseURL)) {
          return parsed;
        }
      } catch (e) {}
    }

    // 2. Kiểm tra cấu hình trong file firebase-config.js
    if (window.DEFAULT_FIREBASE_CONFIG && window.DEFAULT_FIREBASE_CONFIG.apiKey && window.DEFAULT_FIREBASE_CONFIG.apiKey.trim() !== '') {
      return window.DEFAULT_FIREBASE_CONFIG;
    }

    return null;
  }

  function initFirebase() {
    const config = getActiveFirebaseConfig();
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const alertBanner = document.getElementById('firebase-alert-banner');

    if (!config || !window.firebase) {
      state.isFirebaseConnected = false;
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Lưu Cục Bộ (Chưa Nối Đám Mây)';
      alertBanner.style.display = 'flex';
      return;
    }

    alertBanner.style.display = 'none';
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Đang Kết Nối Đám Mây...';

    try {
      // Nếu đã có app chạy trước đó thì dùng lại, chưa có thì tạo mới
      let app;
      if (firebase.apps && firebase.apps.length > 0) {
        app = firebase.apps[0];
      } else {
        app = firebase.initializeApp(config);
      }

      db = firebase.database(app);

      // Kiểm tra trạng thái kết nối mạng thực tế với Firebase
      const connectedRef = db.ref('.info/connected');
      connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
          state.isFirebaseConnected = true;
          statusDot.className = 'status-dot online';
          statusText.textContent = 'Đám Mây: Đang Đồng Bộ Realtime';
        } else {
          statusDot.className = 'status-dot offline';
          statusText.textContent = 'Mất Kết Nối Đám Mây';
        }
      });

      // Lắng nghe dữ liệu danh sách Siêu Thị thời gian thực
      const storesRef = db.ref('stores');
      storesRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          // Chuyển object Firebase thành mảng
          if (Array.isArray(val)) {
            state.stores = val.filter(Boolean);
          } else {
            state.stores = Object.keys(val).map(key => ({ id: key, ...val[key] }));
          }
          saveLocalFallback();
          renderTable();
          updateStats();
        } else {
          // Nếu Database Firebase mới tinh chưa có dữ liệu -> Tự động đẩy 24 siêu thị gốc lên!
          seedDefaultStoresToFirebase();
        }
      });

      // Lắng nghe dữ liệu Điểm Danh theo ngày được chọn
      listenToAttendanceDate(state.selectedDate);

    } catch (err) {
      console.error('Lỗi khởi tạo Firebase:', err);
      state.isFirebaseConnected = false;
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Lỗi Cấu Hình Firebase';
      alertBanner.style.display = 'flex';
      showToast('Không thể kết nối Firebase: ' + err.message, 'error');
    }
  }

  function seedDefaultStoresToFirebase() {
    if (!db) return;
    const updates = {};
    DEFAULT_STORES.forEach(st => {
      updates['stores/' + st.id] = { name: st.name, boss: st.boss };
    });
    db.ref().update(updates).then(() => {
      console.log('Đã nạp 24 siêu thị ban đầu lên Firebase thành công!');
    }).catch(console.error);
  }

  function listenToAttendanceDate(dateStr) {
    if (!db) return;

    if (currentAttendanceRef) {
      currentAttendanceRef.off();
    }

    currentAttendanceRef = db.ref('attendance/' + dateStr);
    currentAttendanceRef.on('value', (snapshot) => {
      const val = snapshot.val() || {};
      state.attendance[dateStr] = val;
      saveLocalFallback();
      renderTable();
      updateStats();
    });
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

    if (db) {
      listenToAttendanceDate(newDate);
    } else {
      renderTable();
      updateStats();
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
    const current = Boolean((state.attendance[state.selectedDate] || {})[storeId]);
    const nextVal = !current;

    if (db) {
      // Cập nhật thẳng lên Firebase Realtime Database
      db.ref(`attendance/${state.selectedDate}/${storeId}`).set(nextVal).catch(err => {
        showToast('Lỗi lưu đám mây: ' + err.message, 'error');
      });
    } else {
      // Fallback lưu máy cục bộ
      if (!state.attendance[state.selectedDate]) {
        state.attendance[state.selectedDate] = {};
      }
      state.attendance[state.selectedDate][storeId] = nextVal;
      saveLocalFallback();
      renderTable();
      updateStats();
    }
  }

  function checkAll() {
    if (state.stores.length === 0) return;

    if (db) {
      const updates = {};
      state.stores.forEach(st => {
        updates[st.id] = true;
      });
      db.ref(`attendance/${state.selectedDate}`).update(updates).then(() => {
        showToast('Đã điểm danh (Check) toàn bộ siêu thị!', 'success');
      }).catch(err => showToast('Lỗi: ' + err.message, 'error'));
    } else {
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
    }
  }

  function uncheckAll() {
    if (db) {
      db.ref(`attendance/${state.selectedDate}`).remove().then(() => {
        showToast('Đã đặt lại trạng thái Chưa Check!', 'info');
      }).catch(err => showToast('Lỗi: ' + err.message, 'error'));
    } else {
      state.attendance[state.selectedDate] = {};
      saveLocalFallback();
      renderTable();
      updateStats();
      showToast('Đã đặt lại trạng thái Chưa Check!', 'info');
    }
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

    if (db) {
      db.ref('stores/' + newId).set({ name, boss }).then(() => {
        closeModal();
        showToast(`Đã thêm siêu thị "${name}" lên đám mây!`, 'success');
      }).catch(err => showToast('Lỗi: ' + err.message, 'error'));
    } else {
      state.stores.push(newStore);
      saveLocalFallback();
      closeModal();
      renderTable();
      updateStats();
      showToast(`Đã thêm siêu thị "${name}"!`, 'success');
    }
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

    if (db) {
      db.ref('stores/' + storeId).remove().then(() => {
        closeDeleteModal();
        showToast(`Đã xoá siêu thị "${storeName}" khỏi đám mây!`, 'success');
      }).catch(err => showToast('Lỗi: ' + err.message, 'error'));
    } else {
      state.stores = state.stores.filter(s => s.id !== storeId);
      saveLocalFallback();
      closeDeleteModal();
      renderTable();
      updateStats();
      showToast(`Đã xoá siêu thị "${storeName}"!`, 'success');
    }
  }

  function resetToDefault() {
    if (confirm('Bạn có chắc muốn khôi phục lại danh sách gốc 24 siêu thị?')) {
      if (db) {
        seedDefaultStoresToFirebase();
        showToast('Đang khôi phục 24 siêu thị lên đám mây...', 'info');
      } else {
        state.stores = [...DEFAULT_STORES];
        saveLocalFallback();
        renderTable();
        updateStats();
        showToast('Đã khôi phục 24 siêu thị mặc định!', 'success');
      }
    }
  }

  // ==========================================
  // 12. CẤU HÌNH FIREBASE MODAL
  // ==========================================
  function openFirebaseModal() {
    const current = localStorage.getItem(STORAGE_KEYS.CUSTOM_FIREBASE) || '';
    document.getElementById('firebase-config-input').value = current ? JSON.stringify(JSON.parse(current), null, 2) : '';
    document.getElementById('firebase-modal').classList.add('open');
  }

  function closeFirebaseModal() {
    document.getElementById('firebase-modal').classList.remove('open');
  }

  function parseFirebaseConfigInput(text) {
    const cleaned = text.trim();
    if (!cleaned) return null;

    // 1. Thử parse JSON trực tiếp
    try {
      return JSON.parse(cleaned);
    } catch (e) {}

    // 2. Thử parse nếu người dùng copy cả đoạn "const firebaseConfig = { ... };"
    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        // Biến các key JS thành JSON chuẩn
        const jsonLike = match[0]
          .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
          .replace(/'/g, '"')
          .replace(/,\s*}/g, '}');
        return JSON.parse(jsonLike);
      }
    } catch (e) {}

    return null;
  }

  function handleSaveFirebase() {
    const input = document.getElementById('firebase-config-input').value;
    const parsed = parseFirebaseConfigInput(input);

    if (!parsed || !parsed.apiKey) {
      showToast('Đoạn cấu hình Firebase không hợp lệ! Vui lòng kiểm tra lại apiKey.', 'error');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.CUSTOM_FIREBASE, JSON.stringify(parsed));
    closeFirebaseModal();
    showToast('Đã lưu cấu hình Firebase! Đang kết nối lại...', 'success');

    // Khởi tạo lại kết nối
    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  function handleClearFirebase() {
    if (confirm('Bạn có chắc muốn xoá cấu hình Firebase đã lưu trên trình duyệt này?')) {
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_FIREBASE);
      closeFirebaseModal();
      showToast('Đã xoá cấu hình. Đang tải lại...', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 800);
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
          if (db) {
            const updates = {};
            data.stores.forEach(st => {
              updates['stores/' + st.id] = { name: st.name, boss: st.boss };
            });
            if (data.attendance) {
              Object.keys(data.attendance).forEach(d => {
                updates['attendance/' + d] = data.attendance[d];
              });
            }
            db.ref().update(updates).then(() => {
              showToast('Khôi phục dữ liệu lên Firebase thành công!', 'success');
            });
          } else {
            state.stores = data.stores;
            state.attendance = data.attendance || {};
            saveLocalFallback();
            renderTable();
            updateStats();
            showToast('Khôi phục dữ liệu thành công!', 'success');
          }
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

    // Thêm siêu thị
    document.getElementById('btn-open-add-modal').addEventListener('click', openAddModal);
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('store-form').addEventListener('submit', handleSaveStore);

    // Xoá siêu thị
    document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteStore);

    // Cài đặt Firebase
    document.getElementById('btn-open-firebase-modal').addEventListener('click', openFirebaseModal);
    document.getElementById('btn-alert-setup-firebase').addEventListener('click', openFirebaseModal);
    document.getElementById('btn-close-firebase-modal').addEventListener('click', closeFirebaseModal);
    document.getElementById('btn-cancel-firebase-modal').addEventListener('click', closeFirebaseModal);
    document.getElementById('btn-save-firebase').addEventListener('click', handleSaveFirebase);
    document.getElementById('btn-clear-firebase').addEventListener('click', handleClearFirebase);

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
        closeFirebaseModal();
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
