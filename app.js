/**
 * Hệ Thống Điểm Danh BOSS (Firebase Cloud Firestore - Phân Quyền & Backup Vĩnh Viễn)
 * app.js - Tính năng sao lưu vĩnh viễn, khôi phục 1 click, phân quyền Admin (123456) / User
 * 
 * Các tính năng nổi bật:
 * 1. Phân quyền Admin & User:
 *    - Tài khoản User: Mặc định, không cần mật khẩu.
 *    - Tài khoản Admin: Mật khẩu là 123456. Có toàn quyền thêm, xoá danh sách BOSS và khôi phục dữ liệu.
 *    - Hiển thị nhãn góc trên bên phải: "user" hoặc "admin".
 * 2. Backup vĩnh viễn trên Firebase Cloud Firestore:
 *    - Mỗi thay đổi trạng thái (hoặc bấm lưu thủ công) đều được ghi vào collection 'diemdanh_backups' vĩnh viễn.
 *    - Admin có thể xem lịch sử các mốc thời gian và KHÔI PHỤC LẠI CHỈ VỚI 1 CLICK CHUỘT.
 * 3. Đồng bộ Realtime tức thì (< 100ms) trên toàn bộ thiết bị di động, tablet và máy tính.
 * 4. Targeted In-Place DOM Diffing & Debounced Batch Queue: Siêu mượt 60 FPS, không giật bảng.
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

  function formatDateTimeString(dateObj = new Date()) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yy = dateObj.getFullYear();
    return `${hh}:${mm}:${ss} - ${dd}/${mo}/${yy}`;
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
    BOSS: 'ATTENDANCE_BOSS_DS_SIEUTHI_V3',
    ROLE: 'crm_user_role'
  };

  const ADMIN_PASSWORD = '123456';
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
  const BACKUP_COLLECTION = 'diemdanh_backups';

  let firebaseDb = null;
  let isFirebaseReady = false;
  let unsubscribeFirestore = null;

  // Hàng đợi gộp thao tác (Debounced Queue)
  const pendingSyncQueue = new Map();
  let syncDebounceTimer = null;
  let isFlushingQueue = false;
  let autoBackupTimer = null;

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
        console.warn('Lỗi parse bossListJson:', e);
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
        console.log('Document chưa có trên Firebase, tự động khởi tạo...');
        saveBossListToFirebase(state.bossList);
        return;
      }

      if (docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) {
        return;
      }

      const docData = docSnapshot.data();
      const incomingList = parseDocBossList(docData);

      if (incomingList && incomingList.length > 0) {
        mergeIncomingFirebaseData(incomingList, docData.updatedBy);
      }
    }, (err) => {
      console.warn('⚠️ Firestore onSnapshot error:', err);
    });
  }

  function mergeIncomingFirebaseData(incomingList, updatedBy) {
    incomingList.forEach(item => {
      if (pendingSyncQueue.has(item.name)) {
        const pending = pendingSyncQueue.get(item.name);
        item.isChecked = pending.isChecked;
        item.checkTime = pending.checkTime;
      }
    });

    const isSameStructure = state.bossList.length === incomingList.length &&
      state.bossList.every((b, idx) => b.name === incomingList[idx].name);

    if (isSameStructure) {
      incomingList.forEach((newItem, idx) => {
        const curItem = state.bossList[idx];
        if (curItem.isChecked !== newItem.isChecked || curItem.checkTime !== newItem.checkTime) {
          curItem.isChecked = newItem.isChecked;
          curItem.checkTime = newItem.checkTime;
          updateRowInDom(curItem);
        }
      });

      state.bossList = incomingList;
      saveLocalFallback();
      updateStats();
    } else {
      state.bossList = incomingList;
      saveLocalFallback();
      renderTabs();
      renderTable();
      updateStats();
    }
  }

  function queueBossUpdate(bossName, isChecked, checkTime) {
    pendingSyncQueue.set(bossName, {
      isChecked: Boolean(isChecked),
      checkTime: checkTime || '',
      timestamp: Date.now()
    });

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(flushPendingQueueToFirebase, 120);

    // Lên lịch tự động sao lưu bản backup vĩnh viễn sau 2.5s
    scheduleAutoBackup(`Điểm danh Boss: ${bossName} (${isChecked ? 'Đã check' : 'Bỏ check'})`);
  }

  async function flushPendingQueueToFirebase() {
    if (isFlushingQueue || pendingSyncQueue.size === 0 || !firebaseDb) return;

    isFlushingQueue = true;
    const batchEntries = Array.from(pendingSyncQueue.entries());
    const batchMap = new Map(batchEntries);

    try {
      await firebaseDb.runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(bossDocRef());
        let list = sfDoc.exists ? parseDocBossList(sfDoc.data()) : [...state.bossList];

        batchMap.forEach((val, name) => {
          const target = list.find(b => b.name === name);
          if (target) {
            target.isChecked = val.isChecked;
            target.checkTime = val.checkTime;
          } else {
            const local = state.bossList.find(b => b.name === name);
            if (local) list.push({ ...local, isChecked: val.isChecked, checkTime: val.checkTime });
          }
        });

        transaction.set(bossDocRef(), {
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          updatedBy: CLIENT_ID,
          lastAction: {
            type: batchMap.size === 1 ? 'TOGGLE' : 'BATCH_TOGGLE',
            count: batchMap.size,
            by: CLIENT_ID,
            author: state.userRole
          }
        }, { merge: true });
      });

      batchMap.forEach((_, name) => {
        if (pendingSyncQueue.get(name)?.timestamp <= batchMap.get(name)?.timestamp) {
          pendingSyncQueue.delete(name);
        }
      });
    } catch (err) {
      console.warn('⚠️ Lỗi lưu hàng đợi lên Firebase:', err);
      saveBossListToFirebase(state.bossList);
    } finally {
      isFlushingQueue = false;
      if (pendingSyncQueue.size > 0) {
        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(flushPendingQueueToFirebase, 100);
      }
    }
  }

  function saveBossListToFirebase(list, lastAction = null) {
    if (!firebaseDb) return Promise.resolve();
    const payload = {
      sheetName: 'DanhSach_SieuThi',
      bossListJson: JSON.stringify(list),
      bossList: list,
      updatedAt: Date.now(),
      updatedBy: CLIENT_ID
    };
    if (lastAction) {
      payload.lastAction = { ...lastAction, clientId: CLIENT_ID, timestamp: Date.now(), author: state.userRole };
    }
    return bossDocRef().set(payload, { merge: true }).catch(err => {
      console.warn('⚠️ Lỗi lưu Firebase:', err);
    });
  }

  // ==========================================================================
  // 3. TÍNH NĂNG SAO LƯU VĨNH VIỄN & KHÔI PHỤC 1 CLICK TRÊN FIREBASE
  // ==========================================================================

  function scheduleAutoBackup(actionTitle) {
    if (autoBackupTimer) clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(() => {
      createBackupInFirebase(actionTitle);
    }, 2500);
  }

  async function createBackupInFirebase(actionTitle = 'Sao lưu tự động', showFeedback = false) {
    if (!firebaseDb) return;
    const list = state.bossList || [];
    if (list.length === 0) return;

    const checkedCount = list.filter(b => b.isChecked).length;
    const totalCount = list.length;
    const timeStr = formatDateTimeString(new Date());

    try {
      await firebaseDb.collection(BACKUP_COLLECTION).add({
        timestamp: Date.now(),
        createdAt: timeStr,
        action: actionTitle,
        total: totalCount,
        checkedCount: checkedCount,
        author: state.userRole,
        bossListJson: JSON.stringify(list),
        bossList: list
      });
      console.log('✅ Đã lưu bản sao lưu vĩnh viễn trên Firebase:', actionTitle);
      if (showFeedback) {
        showToast('✅ Đã tạo bản sao lưu vĩnh viễn trên Firebase!', 'success');
      }
    } catch (err) {
      console.warn('⚠️ Lỗi tạo bản sao lưu Firebase:', err);
      if (showFeedback) {
        showToast('⚠️ Không thể tạo bản sao lưu: ' + err.message, 'error');
      }
    }
  }

  async function loadBackupsFromFirebase() {
    const listContainer = document.getElementById('backup-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div style="text-align:center; padding: 2.5rem 1rem; color: #64748b;">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳</div>
        <div>Đang tải lịch sử sao lưu vĩnh viễn từ Firebase...</div>
      </div>
    `;

    try {
      const snap = await firebaseDb.collection(BACKUP_COLLECTION).get();
      const docs = [];
      snap.forEach(d => {
        docs.push({ id: d.id, ...d.data() });
      });

      docs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (docs.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding: 2.5rem 1rem; color: #64748b;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📁</div>
            <div>Chưa có bản sao lưu nào. Hãy bấm <strong>"Tạo Bản Sao Lưu Ngay"</strong> để lưu bản đầu tiên!</div>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';
      docs.forEach(b => {
        const card = document.createElement('div');
        card.className = 'backup-card';
        card.innerHTML = `
          <div class="backup-card-info">
            <div class="backup-card-time">🕒 ${escapeHtml(b.createdAt || '')}</div>
            <div class="backup-card-action">
              <span class="backup-card-badge">${escapeHtml(b.action || 'Sao lưu')}</span>
              <span>• ${b.total || 0} Boss (${b.checkedCount || 0} đã check)</span>
            </div>
          </div>
          <button class="btn-restore-item" data-id="${b.id}" title="Khôi phục lại danh sách Boss này với 1 click">
            🔄 Khôi Phục (1 Click)
          </button>
        `;

        const btnRestore = card.querySelector('.btn-restore-item');
        btnRestore.addEventListener('click', () => {
          restoreFromBackup(b, btnRestore);
        });

        listContainer.appendChild(card);
      });
    } catch (err) {
      console.error('Lỗi tải backup:', err);
      listContainer.innerHTML = `
        <div style="text-align:center; padding: 2rem; color: #ef4444;">
          ⚠️ Lỗi tải bản sao lưu: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  async function restoreFromBackup(backupItem, btnElement) {
    if (!backupItem) return;
    const backupList = parseDocBossList(backupItem);
    if (!backupList || backupList.length === 0) {
      showToast('⚠️ Bản sao lưu này không có dữ liệu Boss hợp lệ!', 'error');
      return;
    }

    if (!confirm(`Bạn có chắc muốn KHÔI PHỤC danh sách BOSS về phiên bản lúc:\n👉 ${backupItem.createdAt} (${backupItem.action || 'Sao lưu'})\n\nDữ liệu sẽ được áp dụng ngay lập tức cho tất cả thiết bị!`)) {
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = '⏳ Đang khôi phục...';
    }

    try {
      showToast('⏳ Đang khôi phục dữ liệu lên Firebase...', 'info');

      // 1. Ghi đè vào document boss_attendance trên Firebase
      await saveBossListToFirebase(backupList, {
        type: 'RESTORE',
        backupId: backupItem.id,
        createdAt: backupItem.createdAt
      });

      // 2. Cập nhật state cục bộ & giao diện
      state.bossList = backupList;
      saveLocalFallback();
      renderTabs();
      renderTable();
      updateStats();

      // 3. Tự động lưu 1 bản sao lưu ghi nhận hành động khôi phục
      createBackupInFirebase(`Khôi phục từ bản: ${backupItem.createdAt}`);

      showToast(`✅ Đã khôi phục thành công danh sách Boss về phiên bản lúc ${backupItem.createdAt}!`, 'success');
      closeBackupModal();
    } catch (err) {
      console.error('Lỗi khôi phục:', err);
      showToast('❌ Lỗi khi khôi phục: ' + err.message, 'error');
    } finally {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = '🔄 Khôi Phục (1 Click)';
      }
    }
  }

  // ==========================================================================
  // 4. PHÂN QUYỀN ADMIN (PASSWORD: 123456) & USER
  // ==========================================================================
  let state = {
    currentCategory: 'BOSS',
    bossList: [],
    memberToDelete: null,
    isSyncing: false,
    userRole: 'user' // 'user' hoặc 'admin'
  };

  function initRole() {
    const savedRole = localStorage.getItem(STORAGE_KEYS.ROLE);
    state.userRole = (savedRole === 'admin') ? 'admin' : 'user';
    updateRoleUI();
  }

  function setRole(newRole) {
    state.userRole = (newRole === 'admin') ? 'admin' : 'user';
    localStorage.setItem(STORAGE_KEYS.ROLE, state.userRole);
    updateRoleUI();
    renderTable(); // Vẽ lại để cập nhật nút xoá trên từng dòng
  }

  function updateRoleUI() {
    const badgeBtn = document.getElementById('btn-role-badge');
    const badgeIcon = document.getElementById('role-badge-icon');
    const badgeText = document.getElementById('role-badge-text');

    const isAdmin = (state.userRole === 'admin');

    if (badgeBtn) {
      badgeBtn.className = `role-badge-btn ${isAdmin ? 'admin' : 'user'}`;
      badgeBtn.title = isAdmin 
        ? '👑 Tài khoản Admin (Bấm để mở Menu Quản Trị & Khôi Phục)' 
        : '👤 Tài khoản User (Bấm để đăng nhập Admin)';
    }

    if (badgeIcon) {
      badgeIcon.textContent = isAdmin ? '👑' : '👤';
    }

    if (badgeText) {
      badgeText.textContent = isAdmin ? 'admin' : 'user';
    }

    // Ẩn/hiện các nút dành riêng cho Admin
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? 'inline-flex' : 'none';
    });
  }

  function handleRoleBadgeClick() {
    if (state.userRole === 'admin') {
      openAdminMenuModal();
    } else {
      openAdminLoginModal();
    }
  }

  function openAdminLoginModal() {
    const inp = document.getElementById('admin-password-input');
    if (inp) inp.value = '';
    document.getElementById('admin-login-modal').classList.add('open');
    if (inp) setTimeout(() => inp.focus(), 150);
  }

  function closeAdminLoginModal() {
    document.getElementById('admin-login-modal').classList.remove('open');
  }

  function handleAdminLoginSubmit(e) {
    e.preventDefault();
    const inp = document.getElementById('admin-password-input');
    const entered = (inp ? inp.value : '').trim();

    if (entered === ADMIN_PASSWORD) {
      setRole('admin');
      closeAdminLoginModal();
      showToast('👑 Đăng nhập Admin thành công! Bạn có toàn quyền thêm Boss & Khôi phục dữ liệu.', 'success');
    } else {
      showToast('❌ Mật khẩu Admin không chính xác! Vui lòng thử lại.', 'error');
      if (inp) {
        inp.select();
        inp.focus();
      }
    }
  }

  function openAdminMenuModal() {
    document.getElementById('admin-menu-modal').classList.add('open');
  }

  function closeAdminMenuModal() {
    document.getElementById('admin-menu-modal').classList.remove('open');
  }

  function handleAdminLogout() {
    closeAdminMenuModal();
    setRole('user');
    showToast('👤 Đã đăng xuất Admin. Đang ở chế độ xem User.', 'info');
  }

  function openBackupModal() {
    document.getElementById('backup-modal').classList.add('open');
    loadBackupsFromFirebase();
  }

  function closeBackupModal() {
    document.getElementById('backup-modal').classList.remove('open');
  }

  // ==========================================================================
  // 5. KHỞI TẠO ỨNG DỤNG
  // ==========================================================================
  function init() {
    setupClock();
    setupEventListeners();
    loadLocalFallbackData();
    initRole();
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
  // 6. KÊNH BROADCAST CHANNEL ĐỒNG BỘ 0MS TRÊN CÙNG THIẾT BỊ
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
          updateRowInDom(item);
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
          updateRowInDom(item);
          hasChanges = true;
        }
      });
    }

    if (hasChanges) {
      saveLocalFallback();
      updateStats();
    }
  }

  // ==========================================================================
  // 7. CẬP NHẬT TỪNG DÒNG DOM (TARGETED IN-PLACE DOM UPDATE)
  // ==========================================================================
  function updateRowInDom(item) {
    if (!item || !item.name) return false;
    const tr = document.querySelector(`tr[data-boss="${CSS.escape(item.name)}"]`);
    if (!tr) return false;

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

    const timeBadge = tr.querySelector('.time-badge');
    if (timeBadge) {
      timeBadge.className = `time-badge ${isChecked && item.checkTime ? 'has-time' : 'no-time'}`;
      timeBadge.textContent = isChecked && item.checkTime ? escapeHtml(item.checkTime) : '--:--:--';
    }

    return true;
  }

  // ==========================================================================
  // 8. ĐIỂM DANH: TOGGLE, CHECK ALL, UNCHECK ALL
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
    item.checkTime = item.isChecked ? getCurrentTimeString() : '';

    updateRowInDom(item);
    updateStats();
    saveLocalFallback();

    broadcastRealtimeSignal({
      type: 'TOGGLE',
      boss: item.name,
      row: item.row,
      isChecked: item.isChecked,
      checkTime: item.checkTime
    });

    queueBossUpdate(item.name, item.isChecked, item.checkTime);
  }

  function checkAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    const nowTime = getCurrentTimeString();
    activeList.forEach(item => {
      item.isChecked = true;
      if (!item.checkTime) item.checkTime = nowTime;
      updateRowInDom(item);
      pendingSyncQueue.set(item.name, {
        isChecked: true,
        checkTime: item.checkTime,
        timestamp: Date.now()
      });
    });

    updateStats();
    saveLocalFallback();
    showToast('Đã check tất cả danh sách BOSS!', 'success');

    broadcastRealtimeSignal({
      type: 'CHECK_ALL',
      isChecked: true,
      checkTime: nowTime
    });

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    flushPendingQueueToFirebase();
    scheduleAutoBackup(`Điểm danh tất cả (${activeList.length} Boss)`);
  }

  function uncheckAll() {
    const activeList = getActiveList();
    if (activeList.length === 0) return;

    activeList.forEach(item => {
      item.isChecked = false;
      item.checkTime = '';
      updateRowInDom(item);
      pendingSyncQueue.set(item.name, {
        isChecked: false,
        checkTime: '',
        timestamp: Date.now()
      });
    });

    updateStats();
    saveLocalFallback();
    showToast('Đã bỏ check toàn bộ danh sách BOSS!', 'info');

    broadcastRealtimeSignal({
      type: 'CHECK_ALL',
      isChecked: false,
      checkTime: ''
    });

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    flushPendingQueueToFirebase();
    scheduleAutoBackup('Bỏ check toàn bộ danh sách Boss');
  }

  // ==========================================================================
  // 9. TRÍCH XUẤT TAG CÚ PHÁP @MãNV (VÍ DỤ: "Hoa_7721" -> "@7721")
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
  // 10. ĐỒNG HỒ & GIAO DIỆN
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
  // 11. RENDER BẢNG ĐIỂM DANH (CÓ KIỂM TRA DIFFING CHỐNG GIẬT LAG)
  // ==========================================================================
  function renderTable() {
    const tbody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('attendance-table');
    const searchInput = document.getElementById('search-input');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const activeList = getActiveList();
    const isAdmin = (state.userRole === 'admin');

    const filtered = activeList.filter(item => {
      const matchName = (item.name || '').toLowerCase().includes(searchTerm);
      const matchTag = extractTag(item.name).toLowerCase().includes(searchTerm);
      return matchName || matchTag;
    });

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (table) table.style.display = 'none';
      tbody.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (table) table.style.display = 'table';

    // KIỂM TRA NẾU CẤU TRÚC DANH SÁCH KHÔNG ĐỔI -> CHỈ CẬP NHẬT TỪNG DÒNG (DIFFING)
    const existingRows = tbody.querySelectorAll('tr[data-boss]');
    if (existingRows.length === filtered.length) {
      let isSame = true;
      for (let i = 0; i < filtered.length; i++) {
        if (existingRows[i].getAttribute('data-boss') !== filtered[i].name) {
          isSame = false;
          break;
        }
      }
      if (isSame) {
        filtered.forEach(item => updateRowInDom(item));
        return;
      }
    }

    tbody.innerHTML = '';

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
        <td class="col-boss member-cell">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
            <span>${escapeHtml(item.name)}</span>
            ${isAdmin ? `<button class="btn-delete-row admin-only" data-row="${item.row || (index + 2)}" data-boss="${escapeHtml(item.name)}" title="Admin: Xoá Boss này khỏi Firebase">🗑️</button>` : ''}
          </div>
        </td>
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
  // 12. CẬP NHẬT THỐNG KÊ (STATS)
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
  // 13. COPY TAG TÊN VÀO CLIPBOARD
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
  // 14. ADMIN TOÀN QUYỀN THÊM / XOÁ BOSS (LƯU LÊN FIREBASE & BACKUP)
  // ==========================================================================
  function openAddModal() {
    if (state.userRole !== 'admin') {
      openAdminLoginModal();
      return;
    }
    document.getElementById('member-form').reset();
    document.getElementById('modal-title').textContent = `Thêm Boss Mới (Admin)`;
    document.getElementById('member-modal').classList.add('open');
    const inp = document.getElementById('member-name');
    if (inp) setTimeout(() => inp.focus(), 150);
  }

  function closeModal() {
    document.getElementById('member-modal').classList.remove('open');
  }

  function handleSaveMember(e) {
    e.preventDefault();
    if (state.userRole !== 'admin') {
      showToast('⚠️ Chỉ tài khoản Admin mới có quyền thêm Boss!', 'error');
      openAdminLoginModal();
      return;
    }

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
    showToast(`👑 Đã thêm "${name}" vào Firebase!`, 'success');

    addBossToFirebase(newBoss);
    createBackupInFirebase(`Admin thêm Boss: ${name}`);
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
          updatedBy: CLIENT_ID,
          lastAction: { type: 'ADD', boss: newBoss.name, by: CLIENT_ID, author: state.userRole }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi addBossToFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'ADD', boss: newBoss.name });
    }
  }

  function promptDeleteMember(rowNumber, bossName) {
    if (state.userRole !== 'admin') {
      openAdminLoginModal();
      return;
    }

    const activeList = getActiveList();
    const item = activeList.find(i => (bossName && i.name === bossName) || String(i.row) === String(rowNumber));
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
    if (state.userRole !== 'admin') {
      showToast('⚠️ Chỉ tài khoản Admin mới có quyền xoá Boss!', 'error');
      closeDeleteModal();
      openAdminLoginModal();
      return;
    }

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
    showToast(`👑 Đã xoá "${name}" khỏi Firebase!`, 'success');

    deleteBossFromFirebase(name);
    createBackupInFirebase(`Admin xoá Boss: ${name}`);
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
          updatedBy: CLIENT_ID,
          lastAction: { type: 'DELETE', boss: bossName, by: CLIENT_ID, author: state.userRole }
        }, { merge: true });
      });
    } catch (err) {
      console.warn('⚠️ Lỗi deleteBossFromFirebase:', err);
      saveBossListToFirebase(state.bossList, { type: 'DELETE', boss: bossName });
    }
  }

  // ==========================================================================
  // 15. NẠP LẠI DỮ LIỆU TỪ GOOGLE SHEET VÀO FIREBASE
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
        createBackupInFirebase('Nạp lại từ Google Sheet');
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

  function openSheetModal() {
    const inp = document.getElementById('sheet-url-input');
    if (inp) inp.value = window.DEFAULT_SHEET_URL || '';
    document.getElementById('sheet-modal').classList.add('open');
  }

  function closeSheetModal() {
    document.getElementById('sheet-modal').classList.remove('open');
  }

  // ==========================================================================
  // 16. XUẤT CSV & SAO LƯU DỮ LIỆU CỤC BỘ
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
    showToast('Đã tải xuống file sao lưu cục bộ!', 'success');
  }

  // ==========================================================================
  // 17. BẮT SỰ KIỆN GIAO DIỆN
  // ==========================================================================
  function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', renderTable);

    document.getElementById('btn-check-all').addEventListener('click', checkAll);
    document.getElementById('btn-uncheck-all').addEventListener('click', uncheckAll);
    document.getElementById('btn-copy-uncheck-tags').addEventListener('click', copyUncheckedTags);

    // Nút phân quyền góc trên bên phải
    const btnRoleBadge = document.getElementById('btn-role-badge');
    if (btnRoleBadge) btnRoleBadge.addEventListener('click', handleRoleBadgeClick);

    // Modal Đăng nhập Admin
    document.getElementById('btn-close-admin-login').addEventListener('click', closeAdminLoginModal);
    document.getElementById('btn-cancel-admin-login').addEventListener('click', closeAdminLoginModal);
    document.getElementById('admin-login-form').addEventListener('submit', handleAdminLoginSubmit);

    // Modal Menu Admin
    document.getElementById('btn-close-admin-menu').addEventListener('click', closeAdminMenuModal);
    document.getElementById('btn-menu-logout').addEventListener('click', handleAdminLogout);
    document.getElementById('btn-menu-add-boss').addEventListener('click', () => {
      closeAdminMenuModal();
      openAddModal();
    });
    document.getElementById('btn-menu-open-backups').addEventListener('click', () => {
      closeAdminMenuModal();
      openBackupModal();
    });
    document.getElementById('btn-menu-create-backup').addEventListener('click', () => {
      createBackupInFirebase('Admin sao lưu thủ công', true);
    });

    // Nút trên Toolbar Admin
    const btnOpenAdd = document.getElementById('btn-open-add-modal');
    if (btnOpenAdd) btnOpenAdd.addEventListener('click', openAddModal);

    const btnOpenBackup = document.getElementById('btn-open-backup-modal');
    if (btnOpenBackup) btnOpenBackup.addEventListener('click', openBackupModal);

    // Modal Sao lưu & Khôi phục
    document.getElementById('btn-close-backup-modal').addEventListener('click', closeBackupModal);
    document.getElementById('btn-close-backup-modal-btn').addEventListener('click', closeBackupModal);
    document.getElementById('btn-create-backup-now').addEventListener('click', () => {
      createBackupInFirebase('Admin sao lưu thủ công', true).then(loadBackupsFromFirebase);
    });
    document.getElementById('btn-refresh-backups').addEventListener('click', loadBackupsFromFirebase);

    // Modal Thêm Boss
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('member-form').addEventListener('submit', handleSaveMember);

    // Modal Xoá Boss
    document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteMember);

    // Modal Sheet Config
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
        closeAdminLoginModal();
        closeAdminMenuModal();
        closeBackupModal();
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
        promptDeleteMember(deleteBtn.dataset.row, deleteBtn.dataset.boss);
      }
    });
  }

  // ==========================================================================
  // 18. TIỆN ÍCH (TOAST & ESCAPE HTML)
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
