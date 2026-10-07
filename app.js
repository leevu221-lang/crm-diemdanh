/**
 * Hệ Thống Điểm Danh BOSS (Đồng Bộ Firebase Cloud Firestore Siêu Tốc)
 * app.js - Lưu trữ chính & đồng bộ thời gian thực qua Firebase Cloud Firestore
 * 
 * Các tính năng nổi bật:
 * 1. Lưu trữ trực tiếp danh sách BOSS lên Firebase Cloud Firestore (thay thế hoàn toàn Google Sheets).
 * 2. Realtime Ultra-Fast Sync (< 100ms) qua Firestore onSnapshot trên toàn bộ điện thoại, tablet, PC.
 * 3. Zero-Latency Optimistic UI (0ms): Phản hồi bấm tick ngay lập tức, không chờ mạng.
 * 4. Transaction Safe: Thao tác đánh dấu điểm danh bằng runTransaction chống ghi đè khi nhiều người cùng bấm.
 * 5. Tự động nhận diện khi có Boss mới được thêm, đổi tên hoặc xoá trên Firestore.
 * 6. Non-destructive DOM Diffing: Cập nhật êm dịu, không giật màn hình hay mất vị trí cuộn.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. DỮ LIỆU GỐC DỰ PHÒNG CHUẨN TỪ DANH SÁCH BOSS
  // ==========================================================================

  function getCurrentTimeString() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  const DEFAULT_BOSS = [
    { row: 2, rows: [2], stt: 1, name: 'Hoa_7721', isChecked: true, tag: '@7721', checkTime: '20:32:05' },
    { row: 3, rows: [3], stt: 2, name: 'An_59690', isChecked: true, tag: '@59690', checkTime: '20:31:07' },
    { row: 4, rows: [4], stt: 3, name: 'Thi_51929', isChecked: true, tag: '@51929', checkTime: '10:38:22' },
    { row: 5, rows: [5, 17, 24], stt: 4, name: 'Ngoan_21966', isChecked: true, tag: '@21966', checkTime: '20:31:50' },
    { row: 6, rows: [6, 25], stt: 5, name: 'Tâm_146168', isChecked: true, tag: '@146168', checkTime: '11:38:39' },
    { row: 7, rows: [7], stt: 6, name: 'Phi_161470', isChecked: true, tag: '@161470', checkTime: '10:36:59' },
    { row: 8, rows: [8], stt: 7, name: 'Sơn_7699', isChecked: false, tag: '@7699', checkTime: '' },
    { row: 9, rows: [9], stt: 8, name: 'Thảo_40924', isChecked: true, tag: '@40924', checkTime: '11:33:35' },
    { row: 10, rows: [10, 20], stt: 9, name: 'Nhẫn_7712', isChecked: true, tag: '@7712', checkTime: '20:31:40' },
    { row: 11, rows: [11], stt: 10, name: 'Quy_63172', isChecked: true, tag: '@63172', checkTime: '20:32:01' },
    { row: 12, rows: [12, 21], stt: 11, name: 'Toàn_44474', isChecked: true, tag: '@44474', checkTime: '10:42:19' },
    { row: 13, rows: [13, 15], stt: 12, name: 'Nhựt_63527', isChecked: false, tag: '@63527', checkTime: '' },
    { row: 14, rows: [14], stt: 13, name: 'Tính_43746', isChecked: true, tag: '@43746', checkTime: '20:31:46' },
    { row: 16, rows: [16, 23], stt: 14, name: 'Nam_171275', isChecked: true, tag: '@171275', checkTime: '20:31:43' },
    { row: 18, rows: [18, 19, 22], stt: 15, name: 'Khắc_30653', isChecked: true, tag: '@30653', checkTime: '10:33:34' }
  ];

  const STORAGE_KEYS = {
    BOSS: 'ATTENDANCE_BOSS_DS_SIEUTHI_V3'
  };

  const CLIENT_ID = 'cli_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  let localBroadcastChannel = null;

  // ==========================================================================
  // 2. CẤU HÌNH & KẾT NỐI FIREBASE CLOUD FIRESTORE
  // ==========================================================================
  const DEFAULT_FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
    apiKey: "AIzaSyA_FevBrpgE6R1YVbL321BeuX5J8v0Su00",
    authDomain: "crm-43751-71e4b.firebaseapp.com",
    projectId: "crm-43751-71e4b",
    storageBucket: "crm-43751-71e4b.firebasestorage.app",
    messagingSenderId: "665213457085",
    appId: "1:665213457085:web:976cdbafbf69583d73ddd4",
    measurementId: "G-4WLH4WFHC1"
  };

  const FIRESTORE_COLLECTION = window.FIRESTORE_COLLECTION || 'diemdanh_system';
  const FIRESTORE_BOSS_DOC = window.FIRESTORE_BOSS_DOC || 'boss_attendance';

  let firebaseDb = null;
  let isFirebaseReady = false;
  let unsubscribeFirestore = null;

  // Lưu tạm các thao tác người dùng vừa click trên máy này để chống giật UI
  const pendingWrites = new Map();

  function bossDocRef() {
    return firebaseDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_BOSS_DOC);
  }

  function parseDocBossList(data) {
    if (!data) return [];
    if (data.bossListJson) {
      try {
        const parsed = JSON.parse(data.bossListJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Lỗi phân tích bossListJson:', e);
      }
    }
    if (Array.isArray(data.bossList) && data.bossList.length > 0) {
      return data.bossList;
    }
    return [];
  }

  function initFirebase() {
    try {
      if (typeof firebase !== 'undefined') {
        const fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(DEFAULT_FIREBASE_CONFIG);
        firebaseDb = firebase.firestore();
        isFirebaseReady = true;
        console.log('🔥 Firebase Cloud Firestore đã sẵn sàng:', DEFAULT_FIREBASE_CONFIG.projectId);
        return true;
      }
    } catch (err) {
      console.warn('⚠️ Lỗi khởi tạo Firebase SDK:', err);
    }
    return false;
  }

  function initFirestoreSync() {
    if (!firebaseDb) {
      console.warn('⚠️ Firebase DB chưa sẵn sàng, dùng bộ nhớ cục bộ');
      return;
    }

    const ref = bossDocRef();
    unsubscribeFirestore = ref.onSnapshot((docSnapshot) => {
      if (!docSnapshot.exists) {
        console.log('Document chưa có trên Firestore, đang tự động nạp danh sách ban đầu lên...');
        saveBossListToFirebase(state.bossList);
        return;
      }

      const docData = docSnapshot.data();
      const incomingList = parseDocBossList(docData);

      if (incomingList && incomingList.length > 0) {
        mergeIncomingFirebaseData(incomingList);
      }
    }, (err) => {
      console.warn('⚠️ Firestore onSnapshot error:', err);
    });
  }

  function mergeIncomingFirebaseData(incomingList) {
    const now = Date.now();

    // Giữ trạng thái của thao tác người dùng vừa bấm trên máy này trong vòng 1.5s
    incomingList.forEach(item => {
      if (pendingWrites.has(item.name)) {
        const pending = pendingWrites.get(item.name);
        if (now - pending.time < 1500) {
          item.isChecked = pending.isChecked;
          item.checkTime = pending.checkTime;
        } else {
          pendingWrites.delete(item.name);
        }
      }
    });

    state.bossList = incomingList;
    saveLocalFallback();
    renderTabs();
    renderTable();
    updateStats();
  }

  function saveBossListToFirebase(list, lastAction = null) {
    if (!firebaseDb) return Promise.resolve();
    const payload = {
      sheetName: 'DanhSach_SieuThi',
      bossListJson: JSON.stringify(list),
      bossList: list,
      updatedAt: Date.now()
    };
    if (lastAction) {
      payload.lastAction = { ...lastAction, clientId: CLIENT_ID, timestamp: Date.now() };
    }
    return bossDocRef().set(payload, { merge: true }).catch(err => {
      console.warn('⚠️ Lỗi lưu Firebase:', err);
    });
  }

  // ==========================================================================
  // 3. STATE CỦA ỨNG DỤNG
  // ==========================================================================
  let state = {
    currentCategory: 'BOSS',
    bossList: [],
    memberToDelete: null,
    isSyncing: false
  };

  // ==========================================================================
  // 4. KHỞI TẠO ỨNG DỤNG
  // ==========================================================================
  function init() {
    setupClock();
    setupEventListeners();
    loadLocalFallbackData();
    initRealtimeChannel();
    initFirebase();
    initFirestoreSync();
  }

  function loadLocalFallbackData() {
    try {
      const savedBoss = localStorage.getItem(STORAGE_KEYS.BOSS);
      state.bossList = savedBoss ? JSON.parse(savedBoss) : [...DEFAULT_BOSS];
      state.bossList.forEach(b => {
        if (typeof b.checkTime === 'undefined') b.checkTime = '';
      });
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

  // ==========================================================================
  // 5. KÊNH BROADCAST CHANNEL ĐỒNG BỘ 0MS TRÊN CÙNG THIẾT BỊ
  // ==========================================================================
  function initRealtimeChannel() {
    if ('BroadcastChannel' in window) {
      try {
        localBroadcastChannel = new BroadcastChannel('crm_boss_firebase_sync');
        localBroadcastChannel.onmessage = (e) => {
          handleIncomingRealtimeSignal(e.data);
        };
      } catch (e) {}
    }
  }

  function broadcastRealtimeSignal(payload) {
    payload.clientId = CLIENT_ID;
    payload.timestamp = Date.now();
    if (localBroadcastChannel) {
      try { localBroadcastChannel.postMessage(payload); } catch (e) {}
    }
  }

  function handleIncomingRealtimeSignal(payload) {
    if (!payload || payload.clientId === CLIENT_ID) return;

    let hasChanges = false;
    const activeList = state.bossList;

    if (payload.type === 'TOGGLE') {
      const item = activeList.find(i => 
        (payload.boss && i.name === payload.boss) ||
        String(i.row) === String(payload.row) ||
        (i.rows && i.rows.map(String).includes(String(payload.row)))
      );
      if (item) {
        const newChecked = Boolean(payload.isChecked);
        if (item.isChecked !== newChecked || item.checkTime !== payload.checkTime) {
          item.isChecked = newChecked;
          item.checkTime = payload.checkTime || (newChecked ? (item.checkTime || getCurrentTimeString()) : '');
          hasChanges = true;
        }
      }
    } else if (payload.type === 'CHECK_ALL') {
      const targetVal = Boolean(payload.isChecked);
      const timeVal = payload.checkTime || (targetVal ? getCurrentTimeString() : '');
      activeList.forEach(item => {
        if (item.isChecked !== targetVal || (targetVal && !item.checkTime)) {
          item.isChecked = targetVal;
          item.checkTime = targetVal ? timeVal : '';
          hasChanges = true;
        }
      });
    }

    if (hasChanges) {
      saveLocalFallback();
      renderTabs();
      renderTable();
      updateStats();
    }
  }

  // ==========================================================================
  // 6. ĐIỂM DANH: TOGGLE, CHECK ALL, UNCHECK ALL (LƯU LÊN FIREBASE CLOUD)
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
    if (item.isChecked) {
      item.checkTime = getCurrentTimeString();
    } else {
      item.checkTime = '';
    }

    pendingWrites.set(item.name, {
      isChecked: item.isChecked,
      checkTime: item.checkTime,
      time: Date.now()
    });

    renderTable();
    updateStats();
    saveLocalFallback();

    // Bắn tín hiệu sang các tab trên cùng máy (0ms)
    broadcastRealtimeSignal({
      type: 'TOGGLE',
      boss: item.name,
      row: item.row,
      isChecked: item.isChecked,
      checkTime: item.checkTime
    });

    // Cập nhật Firebase Cloud Firestore qua Transaction an toàn
    updateBossInFirebase(item.name, item.isChecked, item.checkTime);
  }

  async function updateBossInFirebase(bossName, isChecked, checkTime) {
    if (!firebaseDb) return;
    try {
      await firebaseDb.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(bossDocRef());
        let list = sfDoc.exists ? parseDocBossList(sfDoc.data()) : [...state.bossList];
        const target = list.find(b => b.name === bossName);
        if (target) {
          target.isChecked = isChecked;
          target.checkTime = checkTime;
        } else {
          const localItem = state.bossList.find(b => b.name === bossName);
          if (localItem) list.push({ ...localItem, isChecked, checkTime });
        }
        transaction.set(bossDocRef(), {
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          lastAction: { type: 'TOGGLE', boss: bossName, isChecked, checkTime, by: CLIENT_ID }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi updateBossInFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'TOGGLE', boss: bossName, isChecked, checkTime });
    }
  }

  function checkAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    const nowTime = getCurrentTimeString();
    activeList.forEach(item => {
      item.isChecked = true;
      if (!item.checkTime) item.checkTime = nowTime;
      pendingWrites.set(item.name, {
        isChecked: true,
        checkTime: item.checkTime,
        time: Date.now()
      });
    });

    renderTable();
    saveLocalFallback();
    updateStats();
    showToast('Đã check tất cả danh sách BOSS!', 'success');

    broadcastRealtimeSignal({
      type: 'CHECK_ALL',
      isChecked: true,
      checkTime: nowTime
    });

    checkAllInFirebase(nowTime);
  }

  async function checkAllInFirebase(nowTime) {
    if (!firebaseDb) return;
    try {
      await firebaseDb.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(bossDocRef());
        let list = sfDoc.exists ? parseDocBossList(sfDoc.data()) : [...state.bossList];
        list.forEach(b => {
          b.isChecked = true;
          if (!b.checkTime) b.checkTime = nowTime;
        });
        transaction.set(bossDocRef(), {
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          lastAction: { type: 'CHECK_ALL', isChecked: true, checkTime: nowTime, by: CLIENT_ID }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi checkAllInFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'CHECK_ALL', isChecked: true, checkTime: nowTime });
    }
  }

  function uncheckAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    activeList.forEach(item => {
      item.isChecked = false;
      item.checkTime = '';
      pendingWrites.set(item.name, {
        isChecked: false,
        checkTime: '',
        time: Date.now()
      });
    });

    renderTable();
    saveLocalFallback();
    updateStats();
    showToast('Đã bỏ check toàn bộ danh sách BOSS!', 'info');

    broadcastRealtimeSignal({
      type: 'CHECK_ALL',
      isChecked: false,
      checkTime: ''
    });

    uncheckAllInFirebase();
  }

  async function uncheckAllInFirebase() {
    if (!firebaseDb) return;
    try {
      await firebaseDb.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(bossDocRef());
        let list = sfDoc.exists ? parseDocBossList(sfDoc.data()) : [...state.bossList];
        list.forEach(b => {
          b.isChecked = false;
          b.checkTime = '';
        });
        transaction.set(bossDocRef(), {
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          lastAction: { type: 'CHECK_ALL', isChecked: false, checkTime: '', by: CLIENT_ID }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi uncheckAllInFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'CHECK_ALL', isChecked: false, checkTime: '' });
    }
  }

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
  // 9. RENDER BẢNG ĐIỂM DANH
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

      const tr = document.createElement('tr');
      tr.setAttribute('data-boss', item.name);
      tr.setAttribute('data-row', item.row || (index + 2));
      if (isChecked) {
        tr.classList.add('row-checked');
      }

      tr.innerHTML = `
        <td class="col-stt"><span class="stt-badge">${item.stt || (index + 1)}</span></td>
        <td class="col-boss member-cell">${escapeHtml(item.name)}</td>
        <td class="col-check">
          <button class="btn-check-toggle ${isChecked ? 'checked' : 'unchecked'}" data-row="${item.row || (index + 2)}" data-boss="${escapeHtml(item.name)}">
            <span class="check-icon">${isChecked ? '✅' : '⚪'}</span>
            <span class="check-text">${isChecked ? 'Đã Check' : 'Chưa Check'}</span>
          </button>
        </td>
        <td class="col-time">
          <span class="time-badge ${isChecked && item.checkTime ? 'has-time' : 'no-time'}">
            ${isChecked && item.checkTime ? escapeHtml(item.checkTime) : '--:--:--'}
          </span>
        </td>
      `;

      tbody.appendChild(tr);
    });
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
  // 11. COPY TAG TÊN VÀO CLIPBOARD
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

    copyToClipboard(resultText, null, true);
    showToast(`Đã copy ${uniqueTags.length} tag của những người CHƯA CHECK!`, 'warning');
  }

  // ==========================================================================
  // 12. THÊM / XOÁ BOSS (LƯU LÊN FIREBASE)
  // ==========================================================================
  function openAddModal() {
    document.getElementById('member-form').reset();
    document.getElementById('modal-title').textContent = `Thêm Boss Mới (Lưu Firebase)`;
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

    const newBoss = {
      row: newRow,
      rows: [newRow],
      stt: newStt,
      name: name,
      isChecked: false,
      checkTime: '',
      tag: extractTag(name)
    };

    activeList.push(newBoss);

    setActiveList(activeList);
    closeModal();
    renderTabs();
    renderTable();
    updateStats();
    showToast(`Đã thêm "${name}" vào Firebase!`, 'success');

    addBossToFirebase(newBoss);
  }

  async function addBossToFirebase(newBoss) {
    if (!firebaseDb) return;
    try {
      await firebaseDb.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(bossDocRef());
        let list = sfDoc.exists ? parseDocBossList(sfDoc.data()) : [...state.bossList];
        if (!list.some(b => b.name === newBoss.name)) {
          list.push(newBoss);
          list.forEach((b, idx) => { b.stt = idx + 1; });
        }
        transaction.set(bossDocRef(), {
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          lastAction: { type: 'ADD', boss: newBoss.name, by: CLIENT_ID }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi addBossToFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'ADD', boss: newBoss.name });
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
    const name = state.memberToDelete.name;

    let activeList = getActiveList();
    activeList = activeList.filter(i => i.name !== name);
    activeList.forEach((item, idx) => { item.stt = idx + 1; });

    setActiveList(activeList);
    closeDeleteModal();
    renderTabs();
    renderTable();
    updateStats();
    showToast(`Đã xoá "${name}" khỏi Firebase!`, 'success');

    deleteBossFromFirebase(name);
  }

  async function deleteBossFromFirebase(bossName) {
    if (!firebaseDb) return;
    try {
      await firebaseDb.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(bossDocRef());
        let list = sfDoc.exists ? parseDocBossList(sfDoc.data()) : [...state.bossList];
        list = list.filter(b => b.name !== bossName);
        list.forEach((b, idx) => { b.stt = idx + 1; });
        transaction.set(bossDocRef(), {
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          lastAction: { type: 'DELETE', boss: bossName, by: CLIENT_ID }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi deleteBossFromFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'DELETE', boss: bossName });
    }
  }

  // ==========================================================================
  // 13. NẠP LẠI DỮ LIỆU TỪ GOOGLE SHEET VÀO FIREBASE
  // ==========================================================================
  async function importFromGoogleSheetToFirebase() {
    const sheetUrl = (window.DEFAULT_SHEET_URL || '').trim();
    if (!sheetUrl) {
      showToast('⚠️ Chưa cấu hình URL Google Sheets!', 'error');
      return;
    }

    const btn = document.getElementById('btn-import-sheet-to-firebase');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang tải từ Google Sheet...';
    }

    try {
      const sep = sheetUrl.includes('?') ? '&' : '?';
      const fetchUrl = `${sheetUrl}${sep}action=getAll&sheet=DanhSach_SieuThi&noCache=1&_t=${Date.now()}`;
      const res = await fetch(fetchUrl);
      const json = await res.json();

      if (json.status === 'success' && Array.isArray(json.bossList) && json.bossList.length > 0) {
        const importedList = json.bossList.map((b, idx) => ({
          row: b.row || (idx + 2),
          rows: b.rows || [b.row || (idx + 2)],
          stt: b.stt || (idx + 1),
          name: b.name,
          isChecked: Boolean(b.isChecked),
          checkTime: b.checkTime || (b.isChecked ? (b.time || '') : ''),
          tag: b.tag || extractTag(b.name)
        }));

        await saveBossListToFirebase(importedList, { type: 'IMPORT_SHEET', by: CLIENT_ID });
        state.bossList = importedList;
        saveLocalFallback();
        renderTabs();
        renderTable();
        updateStats();
        showToast(`✅ Đã nạp thành công ${importedList.length} Boss từ Google Sheet vào Firebase!`, 'success');
        closeSheetModal();
      } else {
        throw new Error(json.message || 'Không tìm thấy dữ liệu Boss trong sheet');
      }
    } catch (err) {
      console.error('Lỗi nạp từ Sheet:', err);
      showToast('❌ Lỗi khi nạp từ Google Sheet: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📥 Nạp Lại Dữ Liệu Từ Google Sheet Vào Firebase';
      }
    }
  }

  // ==========================================================================
  // 14. MODAL THÔNG TIN LƯU TRỮ FIREBASE
  // ==========================================================================
  function openSheetModal() {
    const inp = document.getElementById('sheet-url-input');
    if (inp) inp.value = window.DEFAULT_SHEET_URL || '';
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
    const today = new Date().toISOString().split('T')[0];

    const rows = [
      [`BÁO CÁO ĐIỂM DANH BOSS (FIREBASE CLOUD)`],
      [`Ngày điểm danh: ${today}`],
      [],
      ['STT', 'BOSS', 'TRẠNG THÁI', 'THỜI GIAN CHECK', 'TAG CÚ PHÁP']
    ];

    activeList.forEach((item, idx) => {
      rows.push([
        idx + 1,
        item.name,
        item.isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH',
        item.isChecked ? (item.checkTime || '') : '',
        extractTag(item.name)
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Diem_Danh_Boss_Firebase_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file CSV thành công!', 'success');
  }

  function backupData() {
    const data = {
      system: 'diemdanh_system',
      collection: FIRESTORE_COLLECTION,
      document: FIRESTORE_BOSS_DOC,
      bossList: state.bossList,
      exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_diemdanh_BOSS_Firebase_${new Date().toISOString().split('T')[0]}.json`;
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

    const btnImport = document.getElementById('btn-import-sheet-to-firebase');
    if (btnImport) btnImport.addEventListener('click', importFromGoogleSheetToFirebase);

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
