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
    ROLE: 'crm_user_role',
    CURRENT_ROOM: 'crm_current_room',
    ROOMS_REGISTRY: 'crm_rooms_registry'
  };

  const DEFAULT_ROOM_ID = 'default';
  const DEFAULT_ROOM_NAME = '📌 Bảng Chính (Mặc định)';

  let currentRoomId = DEFAULT_ROOM_ID;
  let currentRoomName = DEFAULT_ROOM_NAME;
  let roomsList = [
    { id: DEFAULT_ROOM_ID, name: DEFAULT_ROOM_NAME, createdAt: 0 }
  ];
  let unsubscribeRoomsRegistry = null;

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
    if (!firebaseDb) return null;
    const docId = (currentRoomId === DEFAULT_ROOM_ID) ? FIRESTORE_BOSS_DOC : `room_${currentRoomId}`;
    return firebaseDb.collection(FIRESTORE_COLLECTION).doc(docId);
  }

  function roomsRegistryRef() {
    if (!firebaseDb) return null;
    return firebaseDb.collection(FIRESTORE_COLLECTION).doc('rooms_registry');
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

    if (unsubscribeFirestore) {
      try { unsubscribeFirestore(); } catch (e) {}
      unsubscribeFirestore = null;
    }

    const ref = bossDocRef();
    if (!ref) return;

    unsubscribeFirestore = ref.onSnapshot((docSnapshot) => {
      if (!docSnapshot.exists) {
        console.log(`Document [${currentRoomId}] chưa có trên Firebase, tự động khởi tạo...`);
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
      } else if (Array.isArray(incomingList) && incomingList.length === 0) {
        state.bossList = [];
        saveLocalFallback();
        renderTabs();
        renderTable();
        updateStats();
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
        const docRef = bossDocRef();
        if (!docRef) return;
        const sfDoc = await transaction.get(docRef);
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

        transaction.set(docRef, {
          roomId: currentRoomId,
          roomName: currentRoomName,
          sheetName: 'DanhSach_SieuThi',
          bossListJson: JSON.stringify(list),
          bossList: list,
          updatedAt: Date.now(),
          updatedBy: CLIENT_ID,
          lastAction: {
            type: batchMap.size === 1 ? 'TOGGLE' : 'BATCH_TOGGLE',
            count: batchMap.size,
            by: CLIENT_ID,
            author: state.userRole,
            roomId: currentRoomId
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
    const docRef = bossDocRef();
    if (!docRef) return Promise.resolve();

    const payload = {
      roomId: currentRoomId,
      roomName: currentRoomName,
      sheetName: 'DanhSach_SieuThi',
      bossListJson: JSON.stringify(list),
      bossList: list,
      updatedAt: Date.now(),
      updatedBy: CLIENT_ID
    };
    if (lastAction) {
      payload.lastAction = { ...lastAction, clientId: CLIENT_ID, timestamp: Date.now(), author: state.userRole, roomId: currentRoomId };
    }
    return docRef.set(payload, { merge: true }).catch(err => {
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
    if (list.length === 0 && currentRoomId === DEFAULT_ROOM_ID) return;

    const checkedCount = list.filter(b => b.isChecked).length;
    const totalCount = list.length;
    const timeStr = formatDateTimeString(new Date());

    try {
      await firebaseDb.collection(BACKUP_COLLECTION).add({
        timestamp: Date.now(),
        createdAt: timeStr,
        action: actionTitle,
        roomId: currentRoomId,
        roomName: currentRoomName,
        total: totalCount,
        checkedCount: checkedCount,
        author: state.userRole,
        bossListJson: JSON.stringify(list),
        bossList: list
      });
      console.log(`✅ Đã lưu bản sao lưu vĩnh viễn trên Firebase [${currentRoomId}]:`, actionTitle);
      if (showFeedback) {
        showToast(`✅ Đã tạo bản sao lưu vĩnh viễn cho "${currentRoomName}"!`, 'success');
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
    const boardTitleEl = document.getElementById('backup-current-board-name');
    if (boardTitleEl) boardTitleEl.textContent = currentRoomName;

    if (!listContainer) return;

    listContainer.innerHTML = `
      <div style="text-align:center; padding: 2.5rem 1rem; color: #64748b;">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳</div>
        <div>Đang tải lịch sử sao lưu vĩnh viễn cho <strong>${escapeHtml(currentRoomName)}</strong>...</div>
      </div>
    `;

    try {
      const snap = await firebaseDb.collection(BACKUP_COLLECTION).get();
      const docs = [];
      snap.forEach(d => {
        const data = d.data();
        const docRoom = data.roomId || 'default';
        if (docRoom === currentRoomId) {
          docs.push({ id: d.id, ...data });
        }
      });

      docs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (docs.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding: 2.5rem 1rem; color: #64748b;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📁</div>
            <div>Chưa có bản sao lưu nào cho <strong>${escapeHtml(currentRoomName)}</strong>.<br>Hãy bấm <strong>"Tạo Bản Sao Lưu Ngay"</strong> để lưu bản đầu tiên!</div>
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
    if (!backupList) {
      showToast('⚠️ Bản sao lưu này không có dữ liệu Boss hợp lệ!', 'error');
      return;
    }

    if (!confirm(`Bạn có chắc muốn KHÔI PHỤC bảng [${backupItem.roomName || currentRoomName}] về phiên bản lúc:\n👉 ${backupItem.createdAt} (${backupItem.action || 'Sao lưu'})\n\nDữ liệu sẽ được áp dụng ngay lập tức cho tất cả thiết bị!`)) {
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = '⏳ Đang khôi phục...';
    }

    try {
      showToast('⏳ Đang khôi phục dữ liệu lên Firebase...', 'info');

      // 1. Ghi đè vào document của bảng hiện tại trên Firebase
      await saveBossListToFirebase(backupList, {
        type: 'RESTORE',
        backupId: backupItem.id,
        roomId: currentRoomId,
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

    // Cập nhật nút Xoá Bảng trong menu admin (chỉ cho phép xoá bảng phụ)
    const btnDeleteBoard = document.getElementById('btn-menu-delete-board');
    if (btnDeleteBoard) {
      btnDeleteBoard.style.display = (currentRoomId !== DEFAULT_ROOM_ID && isAdmin) ? 'block' : 'none';
    }
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
      showToast('👑 Đăng nhập Admin thành công! Bạn có toàn quyền thêm Boss, tạo bảng & Khôi phục dữ liệu.', 'success');
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
    const btnDeleteBoard = document.getElementById('btn-menu-delete-board');
    if (btnDeleteBoard) {
      btnDeleteBoard.style.display = (currentRoomId !== DEFAULT_ROOM_ID && state.userRole === 'admin') ? 'block' : 'none';
    }
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
  // 5. QUẢN LÝ ĐA BẢNG ĐIỂM DANH (MULTI-ROOM / BOARD SYSTEM)
  // ==========================================================================
  function sanitizeRoomSlug(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function getRoomIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('room') || params.get('board') || params.get('group');
    if (raw) {
      const slug = sanitizeRoomSlug(raw);
      if (slug) return slug;
    }
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ROOM);
    return saved ? sanitizeRoomSlug(saved) : DEFAULT_ROOM_ID;
  }

  function initRoomsRegistry() {
    // 1. Tải từ local storage trước
    try {
      const savedRegistry = localStorage.getItem(STORAGE_KEYS.ROOMS_REGISTRY);
      if (savedRegistry) {
        const parsed = JSON.parse(savedRegistry);
        if (Array.isArray(parsed) && parsed.length > 0) {
          roomsList = parsed;
        }
      }
    } catch (e) {}

    ensureCurrentRoomRegistered();
    updateBoardSelectDropdown();

    if (!firebaseDb) return;
    const ref = roomsRegistryRef();
    if (!ref) return;

    unsubscribeRoomsRegistry = ref.onSnapshot((docSnapshot) => {
      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        if (Array.isArray(data.rooms) && data.rooms.length > 0) {
          const merged = [...data.rooms];
          if (!merged.some(r => r.id === DEFAULT_ROOM_ID)) {
            merged.unshift({ id: DEFAULT_ROOM_ID, name: DEFAULT_ROOM_NAME, createdAt: 0 });
          }
          roomsList = merged;
          localStorage.setItem(STORAGE_KEYS.ROOMS_REGISTRY, JSON.stringify(roomsList));
        }
      } else {
        roomsList = [{ id: DEFAULT_ROOM_ID, name: DEFAULT_ROOM_NAME, createdAt: 0 }];
        ref.set({ rooms: roomsList, updatedAt: Date.now() }, { merge: true });
      }

      ensureCurrentRoomRegistered();
      updateBoardSelectDropdown();
    }, (err) => {
      console.warn('⚠️ Lỗi rooms registry onSnapshot:', err);
    });
  }

  function ensureCurrentRoomRegistered() {
    if (!currentRoomId || currentRoomId === DEFAULT_ROOM_ID) {
      currentRoomName = DEFAULT_ROOM_NAME;
      return;
    }
    const exists = roomsList.find(r => r.id === currentRoomId);
    if (!exists) {
      const prettyName = currentRoomId
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const newRoom = { id: currentRoomId, name: prettyName, createdAt: Date.now() };
      roomsList.push(newRoom);
      currentRoomName = prettyName;
      if (firebaseDb) {
        roomsRegistryRef().set({ rooms: roomsList, updatedAt: Date.now() }, { merge: true });
      }
      localStorage.setItem(STORAGE_KEYS.ROOMS_REGISTRY, JSON.stringify(roomsList));
    } else {
      currentRoomName = exists.name;
    }
  }

  function updateBoardSelectDropdown() {
    const select = document.getElementById('board-select');
    if (!select) return;

    const prevValue = currentRoomId;
    select.innerHTML = '';

    roomsList.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = (r.id === DEFAULT_ROOM_ID) ? r.name : `📋 ${r.name}`;
      select.appendChild(opt);
    });

    select.value = prevValue;

    const btnDeleteBoard = document.getElementById('btn-menu-delete-board');
    if (btnDeleteBoard) {
      btnDeleteBoard.style.display = (currentRoomId !== DEFAULT_ROOM_ID && state.userRole === 'admin') ? 'block' : 'none';
    }
  }

  function switchRoom(newRoomId, pushHistory = true) {
    if (!newRoomId) return;
    newRoomId = sanitizeRoomSlug(newRoomId);
    if (newRoomId === currentRoomId) return;

    console.log(`🔄 Chuyển sang bảng: [${newRoomId}]`);
    currentRoomId = newRoomId;
    localStorage.setItem(STORAGE_KEYS.CURRENT_ROOM, currentRoomId);

    ensureCurrentRoomRegistered();

    if (pushHistory) {
      const newUrl = (currentRoomId === DEFAULT_ROOM_ID)
        ? window.location.pathname
        : `?room=${encodeURIComponent(currentRoomId)}`;
      window.history.pushState({ room: currentRoomId }, '', newUrl);
    }

    updateBoardSelectDropdown();

    // 1. Tải dữ liệu cục bộ của bảng này
    loadLocalFallbackData();

    // 2. Chuyển Realtime Listener sang bảng này
    initFirestoreSync();

    showToast(`📋 Đã mở: ${currentRoomName}`, 'info');
  }

  function openCreateBoardModal() {
    if (state.userRole !== 'admin') {
      showToast('🔒 Chỉ tài khoản Admin mới có quyền tạo bảng mới. Vui lòng đăng nhập Admin!', 'warning');
      openAdminLoginModal();
      return;
    }
    const nameInp = document.getElementById('board-name-input');
    const idInp = document.getElementById('board-id-input');
    const previewEl = document.getElementById('board-url-preview');
    if (nameInp) nameInp.value = '';
    if (idInp) idInp.value = '';
    if (previewEl) previewEl.textContent = '...?room=';
    document.getElementById('create-board-modal').classList.add('open');
    if (nameInp) setTimeout(() => nameInp.focus(), 150);
  }

  function closeCreateBoardModal() {
    document.getElementById('create-board-modal').classList.remove('open');
  }

  async function handleCreateBoardSubmit(e) {
    e.preventDefault();
    const nameInp = document.getElementById('board-name-input');
    const idInp = document.getElementById('board-id-input');
    const initTypeEl = document.querySelector('input[name="board-init-type"]:checked');

    const boardName = (nameInp ? nameInp.value : '').trim();
    let boardId = sanitizeRoomSlug(idInp ? idInp.value : '');

    if (!boardName) {
      showToast('⚠️ Vui lòng nhập tên bảng!', 'warning');
      return;
    }
    if (!boardId) {
      boardId = sanitizeRoomSlug(boardName);
    }

    if (boardId === DEFAULT_ROOM_ID || roomsList.some(r => r.id === boardId)) {
      showToast(`⚠️ Mã bảng "${boardId}" đã tồn tại! Vui lòng chọn mã khác.`, 'error');
      return;
    }

    const initType = initTypeEl ? initTypeEl.value : 'empty';
    const initialBossList = (initType === 'clone') 
      ? JSON.parse(JSON.stringify(state.bossList)).map(b => ({ ...b, isChecked: false, checkTime: '' }))
      : [];

    const newRoomObj = {
      id: boardId,
      name: boardName,
      createdAt: Date.now(),
      createdBy: state.userRole
    };

    roomsList.push(newRoomObj);
    localStorage.setItem(STORAGE_KEYS.ROOMS_REGISTRY, JSON.stringify(roomsList));

    if (firebaseDb) {
      try {
        await roomsRegistryRef().set({ rooms: roomsList, updatedAt: Date.now() }, { merge: true });
        await firebaseDb.collection(FIRESTORE_COLLECTION).doc(`room_${boardId}`).set({
          roomId: boardId,
          roomName: boardName,
          bossListJson: JSON.stringify(initialBossList),
          bossList: initialBossList,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updatedBy: CLIENT_ID,
          author: state.userRole
        });
      } catch (err) {
        console.warn('Lỗi ghi bảng mới lên Firebase:', err);
      }
    }

    closeCreateBoardModal();
    showToast(`🎉 Đã tạo bảng "${boardName}" thành công!`, 'success');

    switchRoom(boardId);

    setTimeout(() => {
      openShareBoardModal();
    }, 400);
  }

  function openShareBoardModal() {
    const titleEl = document.getElementById('share-modal-board-name');
    const inputEl = document.getElementById('share-modal-url-input');

    if (titleEl) titleEl.textContent = currentRoomName;

    const base = window.location.origin + window.location.pathname;
    const fullUrl = (currentRoomId === DEFAULT_ROOM_ID)
      ? base
      : `${base}?room=${encodeURIComponent(currentRoomId)}`;

    if (inputEl) inputEl.value = fullUrl;

    document.getElementById('share-board-modal').classList.add('open');
    if (inputEl) {
      setTimeout(() => {
        inputEl.select();
      }, 150);
    }
  }

  function closeShareBoardModal() {
    document.getElementById('share-board-modal').classList.remove('open');
  }

  function copyShareUrlFromModal() {
    const inputEl = document.getElementById('share-modal-url-input');
    if (!inputEl) return;

    const textToCopy = inputEl.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`📋 Đã sao chép link bảng "${currentRoomName}"!`, 'success');
      }).catch(() => {
        inputEl.select();
        document.execCommand('copy');
        showToast(`📋 Đã sao chép link bảng "${currentRoomName}"!`, 'success');
      });
    } else {
      inputEl.select();
      document.execCommand('copy');
      showToast(`📋 Đã sao chép link bảng "${currentRoomName}"!`, 'success');
    }
  }

  async function handleDeleteCurrentBoard() {
    if (state.userRole !== 'admin') {
      showToast('🔒 Chỉ tài khoản Admin mới có quyền xoá bảng!', 'warning');
      return;
    }

    if (currentRoomId === DEFAULT_ROOM_ID) {
      showToast('⚠️ Không thể xoá Bảng Chính mặc định của hệ thống!', 'error');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn XOÁ bảng "${currentRoomName}"?\n\nToàn bộ danh sách BOSS của bảng này sẽ bị gỡ bỏ khỏi hệ thống.`)) {
      return;
    }

    const deleteTargetId = currentRoomId;
    const deleteTargetName = currentRoomName;

    roomsList = roomsList.filter(r => r.id !== deleteTargetId);
    localStorage.setItem(STORAGE_KEYS.ROOMS_REGISTRY, JSON.stringify(roomsList));

    if (firebaseDb) {
      try {
        await roomsRegistryRef().set({ rooms: roomsList, updatedAt: Date.now() }, { merge: true });
      } catch (e) {
        console.warn('Lỗi cập nhật rooms registry:', e);
      }
    }

    closeAdminMenuModal();
    showToast(`🗑️ Đã xoá bảng "${deleteTargetName}"!`, 'info');

    switchRoom(DEFAULT_ROOM_ID);
  }

  // ==========================================================================
  // 6. KHỞI TẠO ỨNG DỤNG & LƯU TRỮ CỤC BỘ
  // ==========================================================================
  function init() {
    setupClock();
    initRole();
    currentRoomId = getRoomIdFromUrl();
    initRealtimeChannel();
    initFirebase();
    initRoomsRegistry();
    loadLocalFallbackData();
    initFirestoreSync();
    setupEventListeners();
  }

  function loadLocalFallbackData() {
    try {
      const key = (currentRoomId === DEFAULT_ROOM_ID) 
        ? STORAGE_KEYS.BOSS 
        : `${STORAGE_KEYS.BOSS}_${currentRoomId}`;
      const savedBoss = localStorage.getItem(key);
      if (savedBoss) {
        state.bossList = JSON.parse(savedBoss);
      } else {
        state.bossList = (currentRoomId === DEFAULT_ROOM_ID) ? [...DEFAULT_BOSS] : [];
      }
      state.bossList.forEach(b => {
        if (typeof b.checkTime === 'undefined') b.checkTime = '';
      });
    } catch (e) {
      state.bossList = (currentRoomId === DEFAULT_ROOM_ID) ? [...DEFAULT_BOSS] : [];
    }

    renderTabs();
    renderTable();
    updateStats();
  }

  function saveLocalFallback() {
    try {
      const key = (currentRoomId === DEFAULT_ROOM_ID) 
        ? STORAGE_KEYS.BOSS 
        : `${STORAGE_KEYS.BOSS}_${currentRoomId}`;
      localStorage.setItem(key, JSON.stringify(state.bossList));
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
  // 7. KÊNH BROADCAST CHANNEL ĐỒNG BỘ 0MS TRÊN CÙNG THIẾT BỊ
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
    payload.roomId = currentRoomId;
    payload.timestamp = Date.now();
    if (localBroadcastChannel) {
      try { localBroadcastChannel.postMessage(payload); } catch (e) {}
    }
  }

  function handleIncomingRealtimeSignal(payload) {
    if (!payload || payload.clientId === CLIENT_ID) return;
    if (payload.roomId && payload.roomId !== currentRoomId) return;

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
      if (emptyState) {
        emptyState.style.display = 'block';
        if (activeList.length === 0) {
          emptyState.innerHTML = `
            <div class="empty-icon">👥</div>
            <h3>Bảng "${escapeHtml(currentRoomName)}" Chưa Có Boss Nào</h3>
            <p>${isAdmin 
              ? 'Hãy bấm nút <strong>"➕ Thêm Boss"</strong> ở trên để tạo danh sách Boss cho bảng này!' 
              : 'Admin chưa thêm danh sách Boss vào bảng này.'}</p>
          `;
        } else {
          emptyState.innerHTML = `
            <div class="empty-icon">🔍</div>
            <h3>Không tìm thấy Boss phù hợp</h3>
            <p>Thử tìm kiếm với từ khoá khác hoặc thêm mới Boss.</p>
          `;
        }
      }
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
  // 14. THÊM / DÁN DANH SÁCH BOSS (HỖ TRỢ DÁN HÀNG LOẠT TỪ SHEETS / EXCEL / ZALO)
  // ==========================================================================
  function parseBossLines(text) {
    if (!text) return [];
    return text
      .split(/[\r\n,;]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
  }

  function updatePastePreview() {
    const textarea = document.getElementById('member-name');
    const previewEl = document.getElementById('paste-preview-meta');
    const chkDedup = document.getElementById('chk-dedup-boss');
    if (!textarea || !previewEl) return;

    const lines = parseBossLines(textarea.value);
    if (lines.length === 0) {
      previewEl.textContent = '';
      return;
    }

    const uniqueSet = new Set(lines);
    const isDedup = chkDedup ? chkDedup.checked : true;

    if (lines.length === 1) {
      previewEl.textContent = `✅ Đã nhận diện 1 Boss: ${lines[0]}`;
      previewEl.style.color = '#16a34a';
    } else {
      if (isDedup && uniqueSet.size < lines.length) {
        previewEl.textContent = `📋 Đã nhận diện ${lines.length} dòng ➔ Tự động gộp thành ${uniqueSet.size} Boss duy nhất`;
        previewEl.style.color = '#4f46e5';
      } else {
        previewEl.textContent = `📋 Đã nhận diện ${lines.length} Boss`;
        previewEl.style.color = '#4f46e5';
      }
    }
  }

  function openAddModal() {
    if (state.userRole !== 'admin') {
      openAdminLoginModal();
      return;
    }
    document.getElementById('member-form').reset();
    const previewEl = document.getElementById('paste-preview-meta');
    if (previewEl) previewEl.textContent = '';
    document.getElementById('modal-title').textContent = `➕ Thêm / Dán Danh Sách Boss (${currentRoomName})`;
    document.getElementById('member-modal').classList.add('open');
    const inp = document.getElementById('member-name');
    if (inp) setTimeout(() => inp.focus(), 150);
  }

  function closeModal() {
    document.getElementById('member-modal').classList.remove('open');
  }

  async function handleSaveMember(e) {
    e.preventDefault();
    if (state.userRole !== 'admin') {
      showToast('⚠️ Chỉ tài khoản Admin mới có quyền thêm Boss!', 'error');
      openAdminLoginModal();
      return;
    }

    const textarea = document.getElementById('member-name');
    const rawText = (textarea ? textarea.value : '').trim();
    const lines = parseBossLines(rawText);

    if (lines.length === 0) {
      showToast('⚠️ Vui lòng nhập hoặc dán ít nhất 1 Boss!', 'warning');
      return;
    }

    const chkDedup = document.getElementById('chk-dedup-boss');
    const isDedup = chkDedup ? chkDedup.checked : true;
    const addMode = document.querySelector('input[name="add-mode"]:checked')?.value || 'append';
    const isReplace = (addMode === 'replace');

    if (isReplace) {
      if (!confirm(`⚠️ CẢNH BÁO THAY THẾ:\nBạn có chắc muốn THAY THẾ TOÀN BỘ danh sách Boss của bảng [${currentRoomName}] bằng danh sách mới (${lines.length} dòng)?\n\nDữ liệu cũ sẽ được lưu bản sao lưu vĩnh viễn trước khi thay thế.`)) {
        return;
      }
    }

    // 1. Nhóm và lọc dữ liệu
    const parsedEntries = [];
    const rowGroupMap = new Map();

    lines.forEach((bossName, index) => {
      if (isDedup) {
        if (!rowGroupMap.has(bossName)) {
          rowGroupMap.set(bossName, [index + 2]);
          parsedEntries.push(bossName);
        } else {
          rowGroupMap.get(bossName).push(index + 2);
        }
      } else {
        parsedEntries.push(bossName);
      }
    });

    const activeList = isReplace ? [] : [...state.bossList];
    let startRow = activeList.length >= 1 ? (Math.max(...activeList.map(i => i.row || 0)) + 1) : 2;

    const newBossList = [];
    parsedEntries.forEach((bossName) => {
      if (!isReplace && isDedup && activeList.some(b => b.name === bossName)) {
        return;
      }

      const rowIndices = rowGroupMap.get(bossName) || [startRow];
      const newBoss = {
        row: startRow,
        rows: rowIndices,
        stt: 0,
        name: bossName,
        isChecked: false,
        checkTime: '',
        tag: extractTag(bossName)
      };
      startRow++;
      newBossList.push(newBoss);
    });

    if (newBossList.length === 0 && !isReplace) {
      showToast('⚠️ Toàn bộ Boss trong danh sách dán vào đã có sẵn trong bảng!', 'info');
      closeModal();
      return;
    }

    const finalBossList = isReplace ? newBossList : [...activeList, ...newBossList];
    finalBossList.forEach((b, idx) => {
      b.stt = idx + 1;
    });

    // 2. Cập nhật state cục bộ
    state.bossList = finalBossList;
    saveLocalFallback();
    closeModal();
    renderTabs();
    renderTable();
    updateStats();

    // 3. Thông báo cho người dùng
    const countMsg = isReplace 
      ? `Đã thay thế toàn bộ bằng ${finalBossList.length} Boss mới!` 
      : `Đã thêm thành công ${newBossList.length} Boss mới vào bảng!`;
    showToast(`🎉 ${countMsg}`, 'success');

    // 4. Lưu trực tiếp lên Firebase Cloud Firestore
    saveBossListToFirebase(finalBossList, {
      type: isReplace ? 'REPLACE_ALL' : 'BATCH_ADD',
      count: finalBossList.length,
      author: state.userRole
    });

    // 5. Lưu bản backup vĩnh viễn
    createBackupInFirebase(`Admin ${isReplace ? 'thay thế' : 'dán thêm'} ${newBossList.length} Boss (${finalBossList.length} Boss hiện tại)`);
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

    // ==========================================
    // SỰ KIỆN QUẢN LÝ BẢNG & CHIA SẺ (MULTI-ROOM)
    // ==========================================
    const boardSelect = document.getElementById('board-select');
    if (boardSelect) {
      boardSelect.addEventListener('change', (e) => {
        switchRoom(e.target.value);
      });
    }

    const btnShareBoard = document.getElementById('btn-share-board');
    if (btnShareBoard) btnShareBoard.addEventListener('click', openShareBoardModal);

    const btnOpenCreateBoard = document.getElementById('btn-open-create-board');
    if (btnOpenCreateBoard) btnOpenCreateBoard.addEventListener('click', openCreateBoardModal);

    // Modal Tạo Bảng Mới
    const btnCloseCreateBoard = document.getElementById('btn-close-create-board');
    if (btnCloseCreateBoard) btnCloseCreateBoard.addEventListener('click', closeCreateBoardModal);
    const btnCancelCreateBoard = document.getElementById('btn-cancel-create-board');
    if (btnCancelCreateBoard) btnCancelCreateBoard.addEventListener('click', closeCreateBoardModal);
    const createBoardForm = document.getElementById('create-board-form');
    if (createBoardForm) createBoardForm.addEventListener('submit', handleCreateBoardSubmit);

    const boardNameInput = document.getElementById('board-name-input');
    const boardIdInput = document.getElementById('board-id-input');
    const boardUrlPreview = document.getElementById('board-url-preview');
    if (boardNameInput && boardIdInput) {
      boardNameInput.addEventListener('input', () => {
        if (!boardIdInput.dataset.manual) {
          const slug = sanitizeRoomSlug(boardNameInput.value);
          boardIdInput.value = slug;
          if (boardUrlPreview) boardUrlPreview.textContent = `...?room=${slug || '...'}`;
        }
      });
      boardIdInput.addEventListener('input', () => {
        boardIdInput.dataset.manual = 'true';
        const slug = sanitizeRoomSlug(boardIdInput.value);
        if (boardUrlPreview) boardUrlPreview.textContent = `...?room=${slug || '...'}`;
      });
    }

    // Modal Chia Sẻ Bảng
    const btnCloseShareBoard = document.getElementById('btn-close-share-board');
    if (btnCloseShareBoard) btnCloseShareBoard.addEventListener('click', closeShareBoardModal);
    const btnCloseShareBoardBtn = document.getElementById('btn-close-share-board-btn');
    if (btnCloseShareBoardBtn) btnCloseShareBoardBtn.addEventListener('click', closeShareBoardModal);
    const btnCopyModalUrl = document.getElementById('btn-copy-modal-url');
    if (btnCopyModalUrl) btnCopyModalUrl.addEventListener('click', copyShareUrlFromModal);

    // Các nút trong Menu Quản Trị
    const btnMenuCreateBoard = document.getElementById('btn-menu-create-board');
    if (btnMenuCreateBoard) {
      btnMenuCreateBoard.addEventListener('click', () => {
        closeAdminMenuModal();
        openCreateBoardModal();
      });
    }
    const btnMenuShareBoard = document.getElementById('btn-menu-share-board');
    if (btnMenuShareBoard) {
      btnMenuShareBoard.addEventListener('click', () => {
        closeAdminMenuModal();
        openShareBoardModal();
      });
    }
    const btnMenuDeleteBoard = document.getElementById('btn-menu-delete-board');
    if (btnMenuDeleteBoard) {
      btnMenuDeleteBoard.addEventListener('click', handleDeleteCurrentBoard);
    }

    // Bắt sự kiện back/forward trình duyệt để chuyển phòng mượt mà
    window.addEventListener('popstate', () => {
      const roomFromUrl = getRoomIdFromUrl();
      if (roomFromUrl !== currentRoomId) {
        switchRoom(roomFromUrl, false);
      }
    });

    // Modal Sao lưu & Khôi phục
    document.getElementById('btn-close-backup-modal').addEventListener('click', closeBackupModal);
    document.getElementById('btn-close-backup-modal-btn').addEventListener('click', closeBackupModal);
    document.getElementById('btn-create-backup-now').addEventListener('click', () => {
      createBackupInFirebase('Admin sao lưu thủ công', true).then(loadBackupsFromFirebase);
    });
    document.getElementById('btn-refresh-backups').addEventListener('click', loadBackupsFromFirebase);

    // Modal Thêm Boss (Hỗ trợ dán hàng loạt)
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('member-form').addEventListener('submit', handleSaveMember);

    const memberNameInp = document.getElementById('member-name');
    if (memberNameInp) {
      memberNameInp.addEventListener('input', updatePastePreview);
      memberNameInp.addEventListener('paste', () => setTimeout(updatePastePreview, 50));
    }
    const chkDedup = document.getElementById('chk-dedup-boss');
    if (chkDedup) {
      chkDedup.addEventListener('change', updatePastePreview);
    }

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
        closeCreateBoardModal();
        closeShareBoardModal();
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
