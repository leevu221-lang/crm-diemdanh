/**
 * Hệ Thống Điểm Danh & Quản Lý Nhân Viên Độc Lập
 * app.js - Logic điều khiển toàn bộ ứng dụng
 */

(function () {
  'use strict';

  // ==========================================
  // 1. DỮ LIỆU MẪU BAN ĐẦU & LOCAL STORAGE KEYS
  // ==========================================
  const STORAGE_KEYS = {
    EMPLOYEES: 'ATTENDANCE_APP_EMPLOYEES_V1',
    RECORDS: 'ATTENDANCE_APP_RECORDS_V1'
  };

  const DEFAULT_EMPLOYEES = [
    { id: 'emp-1', code: 'NV001', name: 'Nguyễn Văn An', department: 'Kinh Doanh', position: 'Trưởng Phòng', phone: '0912345678', joinDate: '2023-01-15', active: true },
    { id: 'emp-2', code: 'NV002', name: 'Trần Thị Bích', department: 'Kế Toán', position: 'Kế Toán Tổng Hợp', phone: '0987654321', joinDate: '2023-03-01', active: true },
    { id: 'emp-3', code: 'NV003', name: 'Lê Hoàng Nam', department: 'Kỹ Thuật', position: 'Lập Trình Viên', phone: '0901122334', joinDate: '2023-06-10', active: true },
    { id: 'emp-4', code: 'NV004', name: 'Phạm Minh Đức', department: 'Marketing', position: 'Chuyên Viên Nội Dung', phone: '0933445566', joinDate: '2023-09-20', active: true },
    { id: 'emp-5', code: 'NV005', name: 'Đặng Thu Trang', department: 'Hành Chính - Nhân Sự', position: 'Chuyên Viên Nhân Sự', phone: '0977889900', joinDate: '2024-02-01', active: true },
    { id: 'emp-6', code: 'NV006', name: 'Vũ Đức Thịnh', department: 'Kỹ Thuật', position: 'Kỹ Sư Hệ Thống', phone: '0944556677', joinDate: '2024-04-12', active: true }
  ];

  // ==========================================
  // 2. STATE CỦA ỨNG DỤNG
  // ==========================================
  let state = {
    employees: [],
    records: {}, // Format: { "YYYY-MM-DD": { [empId]: { status: 'PRESENT'|'LATE'|'EXCUSED'|'ABSENT', checkIn: '08:00', checkOut: '', note: '' } } }
    selectedDate: getTodayDateString(),
    currentTab: 'attendance',
    empToDelete: null,
    editingEmpId: null
  };

  // ==========================================
  // 3. KHỞI TẠO DỮ LIỆU & TRÌNH DUYỆT
  // ==========================================
  function initApp() {
    loadFromLocalStorage();
    setupClock();
    setupEventListeners();
    setupDateInputs();
    renderDepartmentFilters();
    renderStats();
    renderAttendanceTable();
    renderEmployeeTable();
    renderReportTable();
  }

  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getCurrentMonthString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function loadFromLocalStorage() {
    try {
      const savedEmps = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      const savedRecords = localStorage.getItem(STORAGE_KEYS.RECORDS);

      if (savedEmps) {
        state.employees = JSON.parse(savedEmps);
      } else {
        state.employees = [...DEFAULT_EMPLOYEES];
        saveEmployeesToStorage();
      }

      if (savedRecords) {
        state.records = JSON.parse(savedRecords);
      } else {
        state.records = {};
        // Tự động tạo dữ liệu điểm danh mẫu cho hôm nay
        generateSampleTodayAttendance();
        saveRecordsToStorage();
      }
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu LocalStorage:', err);
      state.employees = [...DEFAULT_EMPLOYEES];
      state.records = {};
    }
  }

  function generateSampleTodayAttendance() {
    const today = state.selectedDate;
    state.records[today] = {};
    state.employees.forEach((emp, index) => {
      if (index === 0 || index === 1 || index === 4) {
        state.records[today][emp.id] = { status: 'PRESENT', checkIn: '07:55', checkOut: '', note: '' };
      } else if (index === 2) {
        state.records[today][emp.id] = { status: 'LATE', checkIn: '08:25', checkOut: '', note: 'Kẹt xe ngã tư' };
      } else if (index === 3) {
        state.records[today][emp.id] = { status: 'EXCUSED', checkIn: '', checkOut: '', note: 'Nghỉ khám sức khoẻ' };
      }
    });
  }

  function saveEmployeesToStorage() {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(state.employees));
    document.getElementById('tab-emp-count').textContent = state.employees.length;
    renderDepartmentFilters();
  }

  function saveRecordsToStorage() {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(state.records));
    renderStats();
  }

  // ==========================================
  // 4. ĐỒNG HỒ & NGÀY THÁNG THỜI GIAN THỰC
  // ==========================================
  function setupClock() {
    const clockTimeEl = document.getElementById('clock-time');
    const clockDateEl = document.getElementById('clock-date');

    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    function update() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      clockTimeEl.textContent = `${hours}:${minutes}:${seconds}`;

      const dayName = weekdays[now.getDay()];
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      clockDateEl.textContent = `${dayName}, ${day}/${month}/${year}`;
    }

    update();
    setInterval(update, 1000);
  }

  function setupDateInputs() {
    const dateInput = document.getElementById('attendance-date');
    dateInput.value = state.selectedDate;

    const reportMonth = document.getElementById('report-month');
    reportMonth.value = getCurrentMonthString();
  }

  // ==========================================
  // 5. RENDER THỐNG KÊ (STATS GRID)
  // ==========================================
  function renderStats() {
    const todayRecords = state.records[state.selectedDate] || {};
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let absentCount = 0;

    state.employees.forEach(emp => {
      const rec = todayRecords[emp.id];
      if (rec) {
        if (rec.status === 'PRESENT') presentCount++;
        else if (rec.status === 'LATE') lateCount++;
        else if (rec.status === 'EXCUSED') excusedCount++;
        else if (rec.status === 'ABSENT') absentCount++;
      }
    });

    document.getElementById('stat-total-emp').textContent = state.employees.length;
    document.getElementById('stat-present').textContent = presentCount;
    document.getElementById('stat-late').textContent = lateCount;
    document.getElementById('stat-excused').textContent = excusedCount;
    document.getElementById('stat-absent').textContent = absentCount;
    document.getElementById('tab-emp-count').textContent = state.employees.length;
  }

  // ==========================================
  // 6. RENDER PHÒNG BAN VÀO DROPDOWN LỌC
  // ==========================================
  function renderDepartmentFilters() {
    const departments = Array.from(new Set(state.employees.map(e => e.department).filter(Boolean))).sort();

    const updateSelect = (selectId) => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const currentVal = select.value;
      select.innerHTML = '<option value="ALL">Tất cả phòng ban</option>';
      departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        select.appendChild(opt);
      });
      if (departments.includes(currentVal)) {
        select.value = currentVal;
      }
    };

    updateSelect('attendance-dept-filter');
    updateSelect('emp-dept-filter');
    updateSelect('report-dept');

    // Cập nhật datalist của modal
    const datalist = document.getElementById('dept-datalist');
    if (datalist) {
      datalist.innerHTML = '';
      departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        datalist.appendChild(opt);
      });
    }
  }

  // ==========================================
  // 7. TAB ĐIỂM DANH HÔM NAY (ATTENDANCE)
  // ==========================================
  function renderAttendanceTable() {
    const tbody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('attendance-empty');
    const searchTerm = (document.getElementById('attendance-search').value || '').toLowerCase().trim();
    const deptFilter = document.getElementById('attendance-dept-filter').value;

    const filteredEmployees = state.employees.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(searchTerm) || emp.code.toLowerCase().includes(searchTerm);
      const matchDept = deptFilter === 'ALL' || emp.department === deptFilter;
      return matchSearch && matchDept;
    });

    tbody.innerHTML = '';

    if (filteredEmployees.length === 0) {
      emptyState.style.display = 'block';
      document.getElementById('attendance-table').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.getElementById('attendance-table').style.display = 'table';

    const dayRecords = state.records[state.selectedDate] || {};

    filteredEmployees.forEach(emp => {
      const rec = dayRecords[emp.id] || { status: '', checkIn: '', checkOut: '', note: '' };
      const tr = document.createElement('tr');

      // Tạo initials avatar
      const initials = emp.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();

      tr.innerHTML = `
        <td><span class="badge badge-code">${escapeHtml(emp.code)}</span></td>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${initials}</div>
            <div>
              <div class="user-info-name">${escapeHtml(emp.name)}</div>
              <div class="user-info-sub">${escapeHtml(emp.position || 'Nhân viên')}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-dept">${escapeHtml(emp.department)}</span></td>
        <td>
          <div class="status-pill-group" data-emp-id="${emp.id}">
            <button class="status-pill ${rec.status === 'PRESENT' ? 'active-present' : ''}" data-status="PRESENT" title="Có mặt đúng giờ">Có Mặt</button>
            <button class="status-pill ${rec.status === 'LATE' ? 'active-late' : ''}" data-status="LATE" title="Đi muộn">Đi Muộn</button>
            <button class="status-pill ${rec.status === 'EXCUSED' ? 'active-excused' : ''}" data-status="EXCUSED" title="Nghỉ có phép">Nghỉ Phép</button>
            <button class="status-pill ${rec.status === 'ABSENT' ? 'active-absent' : ''}" data-status="ABSENT" title="Vắng không phép">Vắng</button>
          </div>
        </td>
        <td>
          <input type="time" class="form-control checkin-input" style="width: 105px; padding: 0.35rem 0.5rem;" 
            value="${rec.checkIn || ''}" data-emp-id="${emp.id}" placeholder="--:--">
        </td>
        <td>
          <input type="time" class="form-control checkout-input" style="width: 105px; padding: 0.35rem 0.5rem;" 
            value="${rec.checkOut || ''}" data-emp-id="${emp.id}" placeholder="--:--">
        </td>
        <td>
          <input type="text" class="form-control note-input" style="width: 100%; min-width: 130px; padding: 0.35rem 0.6rem;" 
            value="${escapeHtml(rec.note || '')}" data-emp-id="${emp.id}" placeholder="Ghi chú thêm...">
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  function setEmployeeAttendanceStatus(empId, status) {
    if (!state.records[state.selectedDate]) {
      state.records[state.selectedDate] = {};
    }

    const currentRec = state.records[state.selectedDate][empId] || { status: '', checkIn: '', checkOut: '', note: '' };

    // Nếu bấm lại chính trạng thái đang chọn -> huỷ trạng thái
    if (currentRec.status === status) {
      currentRec.status = '';
    } else {
      currentRec.status = status;
      // Tự động điền giờ check-in nếu là Có mặt hoặc Đi muộn mà chưa có giờ
      if ((status === 'PRESENT' || status === 'LATE') && !currentRec.checkIn) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        currentRec.checkIn = `${hh}:${mm}`;
      }
    }

    state.records[state.selectedDate][empId] = currentRec;
    saveRecordsToStorage();
    renderAttendanceTable();
    renderReportTable();
  }

  function updateAttendanceField(empId, field, value) {
    if (!state.records[state.selectedDate]) {
      state.records[state.selectedDate] = {};
    }
    const currentRec = state.records[state.selectedDate][empId] || { status: '', checkIn: '', checkOut: '', note: '' };
    currentRec[field] = value;
    state.records[state.selectedDate][empId] = currentRec;
    saveRecordsToStorage();
    renderStats();
  }

  function markAllPresent() {
    if (state.employees.length === 0) {
      showToast('Chưa có nhân viên nào trong danh sách!', 'error');
      return;
    }

    if (!state.records[state.selectedDate]) {
      state.records[state.selectedDate] = {};
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    state.employees.forEach(emp => {
      const rec = state.records[state.selectedDate][emp.id] || { status: '', checkIn: '', checkOut: '', note: '' };
      // Nếu chưa có trạng thái hoặc đang trống thì gán là PRESENT
      if (!rec.status) {
        rec.status = 'PRESENT';
        rec.checkIn = rec.checkIn || currentTime;
      }
      state.records[state.selectedDate][emp.id] = rec;
    });

    saveRecordsToStorage();
    renderAttendanceTable();
    renderReportTable();
    showToast('Đã đánh dấu Có Mặt cho tất cả nhân viên!', 'success');
  }

  // ==========================================
  // 8. TAB QUẢN LÝ NHÂN VIÊN (THÊM / XOÁ / SỬA)
  // ==========================================
  function renderEmployeeTable() {
    const tbody = document.getElementById('employee-table-body');
    const emptyState = document.getElementById('employee-empty');
    const searchTerm = (document.getElementById('emp-search').value || '').toLowerCase().trim();
    const deptFilter = document.getElementById('emp-dept-filter').value;

    const filtered = state.employees.filter(emp => {
      const matchSearch = emp.name.toLowerCase().includes(searchTerm) || 
                          emp.code.toLowerCase().includes(searchTerm) || 
                          (emp.phone && emp.phone.includes(searchTerm));
      const matchDept = deptFilter === 'ALL' || emp.department === deptFilter;
      return matchSearch && matchDept;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      document.getElementById('employee-table').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.getElementById('employee-table').style.display = 'table';

    filtered.forEach(emp => {
      const tr = document.createElement('tr');
      const initials = emp.name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();

      tr.innerHTML = `
        <td><span class="badge badge-code">${escapeHtml(emp.code)}</span></td>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${initials}</div>
            <div>
              <div class="user-info-name">${escapeHtml(emp.name)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-dept">${escapeHtml(emp.department)}</span></td>
        <td>${escapeHtml(emp.position || '—')}</td>
        <td>${escapeHtml(emp.phone || '—')}</td>
        <td>${formatDateDisplay(emp.joinDate)}</td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm btn-edit-emp" data-id="${emp.id}" title="Sửa thông tin">
            ✏️ Sửa
          </button>
          <button class="btn btn-danger-outline btn-sm btn-delete-emp" data-id="${emp.id}" title="Xoá nhân viên">
            🗑️ Xoá
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function openAddEmployeeModal() {
    state.editingEmpId = null;
    document.getElementById('emp-modal-title').textContent = 'Thêm Nhân Viên Mới';
    document.getElementById('emp-form').reset();
    document.getElementById('emp-id-hidden').value = '';

    // Gợi ý mã nhân viên tiếp theo: NV007, NV008...
    const nextCode = generateNextEmpCode();
    document.getElementById('emp-code').value = nextCode;
    document.getElementById('emp-join-date').value = getTodayDateString();

    document.getElementById('emp-modal').classList.add('open');
    document.getElementById('emp-name').focus();
  }

  function openEditEmployeeModal(empId) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    state.editingEmpId = emp.id;
    document.getElementById('emp-modal-title').textContent = 'Sửa Thông Tin Nhân Viên';
    document.getElementById('emp-id-hidden').value = emp.id;
    document.getElementById('emp-code').value = emp.code;
    document.getElementById('emp-name').value = emp.name;
    document.getElementById('emp-dept').value = emp.department;
    document.getElementById('emp-position').value = emp.position || '';
    document.getElementById('emp-phone').value = emp.phone || '';
    document.getElementById('emp-join-date').value = emp.joinDate || '';

    document.getElementById('emp-modal').classList.add('open');
    document.getElementById('emp-name').focus();
  }

  function closeEmployeeModal() {
    document.getElementById('emp-modal').classList.remove('open');
  }

  function generateNextEmpCode() {
    let maxNum = 0;
    state.employees.forEach(emp => {
      const match = emp.code.match(/NV(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return 'NV' + String(maxNum + 1).padStart(3, '0');
  }

  function handleSaveEmployee(e) {
    e.preventDefault();
    const code = document.getElementById('emp-code').value.trim();
    const name = document.getElementById('emp-name').value.trim();
    const department = document.getElementById('emp-dept').value.trim();
    const position = document.getElementById('emp-position').value.trim();
    const phone = document.getElementById('emp-phone').value.trim();
    const joinDate = document.getElementById('emp-join-date').value;

    if (!code || !name || !department) {
      showToast('Vui lòng nhập đầy đủ Mã NV, Họ tên và Phòng ban!', 'error');
      return;
    }

    // Kiểm tra trùng mã NV
    const duplicateCode = state.employees.some(emp => emp.code.toUpperCase() === code.toUpperCase() && emp.id !== state.editingEmpId);
    if (duplicateCode) {
      showToast(`Mã nhân viên "${code}" đã tồn tại! Vui lòng chọn mã khác.`, 'error');
      return;
    }

    if (state.editingEmpId) {
      // Cập nhật nhân viên cũ
      const index = state.employees.findIndex(e => e.id === state.editingEmpId);
      if (index !== -1) {
        state.employees[index] = {
          ...state.employees[index],
          code,
          name,
          department,
          position,
          phone,
          joinDate
        };
        showToast(`Đã cập nhật thông tin nhân viên ${name}!`, 'success');
      }
    } else {
      // Thêm nhân viên mới
      const newEmp = {
        id: 'emp-' + Date.now(),
        code,
        name,
        department,
        position,
        phone,
        joinDate: joinDate || getTodayDateString(),
        active: true
      };
      state.employees.push(newEmp);
      showToast(`Đã thêm mới nhân viên ${name} thành công!`, 'success');
    }

    saveEmployeesToStorage();
    closeEmployeeModal();
    renderEmployeeTable();
    renderAttendanceTable();
    renderReportTable();
  }

  function promptDeleteEmployee(empId) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    state.empToDelete = emp;
    document.getElementById('delete-emp-name').textContent = emp.name;
    document.getElementById('delete-emp-code').textContent = emp.code;
    document.getElementById('delete-modal').classList.add('open');
  }

  function closeDeleteModal() {
    state.empToDelete = null;
    document.getElementById('delete-modal').classList.remove('open');
  }

  function confirmDeleteEmployee() {
    if (!state.empToDelete) return;
    const empId = state.empToDelete.id;
    const empName = state.empToDelete.name;

    // Xoá nhân viên khỏi mảng
    state.employees = state.employees.filter(e => e.id !== empId);

    // Dọn dẹp dữ liệu điểm danh liên quan của nhân viên này
    Object.keys(state.records).forEach(date => {
      if (state.records[date] && state.records[date][empId]) {
        delete state.records[date][empId];
      }
    });

    saveEmployeesToStorage();
    saveRecordsToStorage();
    closeDeleteModal();
    renderEmployeeTable();
    renderAttendanceTable();
    renderReportTable();

    showToast(`Đã xoá nhân viên ${empName} khỏi hệ thống!`, 'success');
  }

  // ==========================================
  // 9. TAB BÁO CÁO & XUẤT CSV EXCEL
  // ==========================================
  function renderReportTable() {
    const tbody = document.getElementById('report-table-body');
    const selectedMonth = document.getElementById('report-month').value || getCurrentMonthString();
    const deptFilter = document.getElementById('report-dept').value;

    const filtered = state.employees.filter(emp => deptFilter === 'ALL' || emp.department === deptFilter);

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Không có dữ liệu nhân viên.</td></tr>`;
      return;
    }

    // Lấy tất cả các ngày thuộc tháng đã chọn có trong records
    const monthDates = Object.keys(state.records).filter(d => d.startsWith(selectedMonth));

    filtered.forEach(emp => {
      let present = 0;
      let late = 0;
      let excused = 0;
      let absent = 0;

      monthDates.forEach(date => {
        const rec = state.records[date][emp.id];
        if (rec) {
          if (rec.status === 'PRESENT') present++;
          else if (rec.status === 'LATE') late++;
          else if (rec.status === 'EXCUSED') excused++;
          else if (rec.status === 'ABSENT') absent++;
        }
      });

      const totalWorkingDays = present + late + excused + absent;
      const rate = totalWorkingDays > 0 ? Math.round(((present + late) / totalWorkingDays) * 100) : 100;

      let rateBadgeClass = 'badge-present';
      if (rate < 70) rateBadgeClass = 'badge-absent';
      else if (rate < 90) rateBadgeClass = 'badge-late';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge badge-code">${escapeHtml(emp.code)}</span></td>
        <td style="font-weight: 600;">${escapeHtml(emp.name)}</td>
        <td><span class="badge badge-dept">${escapeHtml(emp.department)}</span></td>
        <td style="text-align: center; font-weight: 600; color: var(--status-present-border);">${present}</td>
        <td style="text-align: center; font-weight: 600; color: var(--status-late-border);">${late}</td>
        <td style="text-align: center; font-weight: 600; color: var(--status-excused-border);">${excused}</td>
        <td style="text-align: center; font-weight: 600; color: var(--status-absent-border);">${absent}</td>
        <td style="text-align: center;"><span class="badge ${rateBadgeClass}">${rate}%</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function exportReportToCSV() {
    const selectedMonth = document.getElementById('report-month').value || getCurrentMonthString();
    const deptFilter = document.getElementById('report-dept').value;
    const filtered = state.employees.filter(emp => deptFilter === 'ALL' || emp.department === deptFilter);

    if (filtered.length === 0) {
      showToast('Không có dữ liệu để xuất!', 'error');
      return;
    }

    const monthDates = Object.keys(state.records).filter(d => d.startsWith(selectedMonth));

    // Headers
    const rows = [
      ['BÁO CÁO ĐIỂM DANH & CHUYÊN CẦN NHÂN VIÊN'],
      [`Tháng: ${selectedMonth}`, `Phòng ban: ${deptFilter === 'ALL' ? 'Tất cả' : deptFilter}`],
      [],
      ['Mã NV', 'Họ Và Tên', 'Phòng Ban', 'Chức Vụ', 'Số Ngày Có Mặt', 'Số Lần Đi Muộn', 'Nghỉ Có Phép', 'Vắng Không Phép', 'Tỷ Lệ Chuyên Cần (%)']
    ];

    filtered.forEach(emp => {
      let present = 0;
      let late = 0;
      let excused = 0;
      let absent = 0;

      monthDates.forEach(date => {
        const rec = state.records[date][emp.id];
        if (rec) {
          if (rec.status === 'PRESENT') present++;
          else if (rec.status === 'LATE') late++;
          else if (rec.status === 'EXCUSED') excused++;
          else if (rec.status === 'ABSENT') absent++;
        }
      });

      const totalDays = present + late + excused + absent;
      const rate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 100;

      rows.push([
        emp.code,
        emp.name,
        emp.department,
        emp.position || '',
        present,
        late,
        excused,
        absent,
        `${rate}%`
      ]);
    });

    // Tạo CSV content có kèm BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt có dấu
    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Diem_Danh_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Đã xuất file CSV thành công!', 'success');
  }

  // ==========================================
  // 10. SAO LƯU & KHÔI PHỤC DỮ LIỆU JSON
  // ==========================================
  function backupDataToJSON() {
    const backupObj = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      employees: state.employees,
      records: state.records
    };

    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_diem_danh_${getTodayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Đã tải xuống file sao lưu dữ liệu!', 'success');
  }

  function handleRestoreJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const data = JSON.parse(event.target.result);
        if (data && Array.isArray(data.employees) && data.records) {
          state.employees = data.employees;
          state.records = data.records;
          saveEmployeesToStorage();
          saveRecordsToStorage();
          renderStats();
          renderAttendanceTable();
          renderEmployeeTable();
          renderReportTable();
          showToast('Khôi phục dữ liệu thành công!', 'success');
        } else {
          showToast('Định dạng file sao lưu không hợp lệ!', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi đọc file JSON: ' + err.message, 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function resetDemoData() {
    if (confirm('Bạn có chắc chắn muốn khôi phục lại dữ liệu mẫu ban đầu? Tất cả dữ liệu hiện tại sẽ được làm mới.')) {
      state.employees = [...DEFAULT_EMPLOYEES];
      state.records = {};
      generateSampleTodayAttendance();
      saveEmployeesToStorage();
      saveRecordsToStorage();
      renderStats();
      renderAttendanceTable();
      renderEmployeeTable();
      renderReportTable();
      showToast('Đã khôi phục dữ liệu mẫu thành công!', 'success');
    }
  }

  // ==========================================
  // 11. BẮT SỰ KIỆN GIAO DIỆN (EVENT LISTENERS)
  // ==========================================
  function setupEventListeners() {
    // Chuyển Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName);
      });
    });

    // Ngày điểm danh
    const dateInput = document.getElementById('attendance-date');
    dateInput.addEventListener('change', (e) => {
      state.selectedDate = e.target.value || getTodayDateString();
      renderStats();
      renderAttendanceTable();
    });

    document.getElementById('btn-prev-day').addEventListener('click', () => {
      const d = new Date(state.selectedDate);
      d.setDate(d.getDate() - 1);
      state.selectedDate = d.toISOString().split('T')[0];
      dateInput.value = state.selectedDate;
      renderStats();
      renderAttendanceTable();
    });

    document.getElementById('btn-next-day').addEventListener('click', () => {
      const d = new Date(state.selectedDate);
      d.setDate(d.getDate() + 1);
      state.selectedDate = d.toISOString().split('T')[0];
      dateInput.value = state.selectedDate;
      renderStats();
      renderAttendanceTable();
    });

    document.getElementById('btn-today').addEventListener('click', () => {
      state.selectedDate = getTodayDateString();
      dateInput.value = state.selectedDate;
      renderStats();
      renderAttendanceTable();
    });

    // Tìm kiếm & Lọc điểm danh
    document.getElementById('attendance-search').addEventListener('input', renderAttendanceTable);
    document.getElementById('attendance-dept-filter').addEventListener('change', renderAttendanceTable);
    document.getElementById('btn-mark-all-present').addEventListener('click', markAllPresent);

    // Sự kiện trong bảng điểm danh (Ủy quyền sự kiện - Event Delegation)
    const attendanceTableBody = document.getElementById('attendance-table-body');
    attendanceTableBody.addEventListener('click', (e) => {
      const pillBtn = e.target.closest('.status-pill');
      if (pillBtn) {
        const group = pillBtn.closest('.status-pill-group');
        const empId = group.dataset.empId;
        const status = pillBtn.dataset.status;
        setEmployeeAttendanceStatus(empId, status);
      }
    });

    attendanceTableBody.addEventListener('change', (e) => {
      const target = e.target;
      const empId = target.dataset.empId;
      if (!empId) return;

      if (target.classList.contains('checkin-input')) {
        updateAttendanceField(empId, 'checkIn', target.value);
      } else if (target.classList.contains('checkout-input')) {
        updateAttendanceField(empId, 'checkOut', target.value);
      } else if (target.classList.contains('note-input')) {
        updateAttendanceField(empId, 'note', target.value);
      }
    });

    // Tìm kiếm & Lọc nhân viên
    document.getElementById('emp-search').addEventListener('input', renderEmployeeTable);
    document.getElementById('emp-dept-filter').addEventListener('change', renderEmployeeTable);

    // Thêm nhân viên
    document.getElementById('btn-open-add-emp-modal').addEventListener('click', openAddEmployeeModal);
    document.getElementById('btn-empty-add-emp').addEventListener('click', openAddEmployeeModal);
    document.getElementById('btn-close-emp-modal').addEventListener('click', closeEmployeeModal);
    document.getElementById('btn-cancel-emp-modal').addEventListener('click', closeEmployeeModal);
    document.getElementById('emp-form').addEventListener('submit', handleSaveEmployee);

    // Sửa & Xoá nhân viên trong bảng nhân viên
    const empTableBody = document.getElementById('employee-table-body');
    empTableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-emp');
      if (editBtn) {
        const empId = editBtn.dataset.id;
        openEditEmployeeModal(empId);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-emp');
      if (deleteBtn) {
        const empId = deleteBtn.dataset.id;
        promptDeleteEmployee(empId);
      }
    });

    // Modal xoá
    document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteEmployee);

    // Đóng modal khi bấm ra ngoài backdrop
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        closeEmployeeModal();
        closeDeleteModal();
      }
    });

    // Báo cáo & Lọc tháng
    document.getElementById('report-month').addEventListener('change', renderReportTable);
    document.getElementById('report-dept').addEventListener('change', renderReportTable);
    document.getElementById('btn-export-csv').addEventListener('click', exportReportToCSV);

    // Sao lưu & Phục hồi
    document.getElementById('btn-backup-json').addEventListener('click', backupDataToJSON);
    document.getElementById('input-restore-json').addEventListener('change', handleRestoreJSON);
    document.getElementById('btn-reset-demo-data').addEventListener('click', resetDemoData);
  }

  function switchTab(tabName) {
    state.currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `pane-${tabName}`);
    });

    if (tabName === 'attendance') {
      renderAttendanceTable();
    } else if (tabName === 'employees') {
      renderEmployeeTable();
    } else if (tabName === 'reports') {
      renderReportTable();
    }
  }

  // ==========================================
  // 12. TIỆN ÍCH HỖ TRỢ (UTILITIES & TOAST)
  // ==========================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
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

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  // Chạy ứng dụng khi DOM tải xong
  document.addEventListener('DOMContentLoaded', initApp);
})();
