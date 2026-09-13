/**
 * ==============================================================================
 * MÃ NGUỒN GOOGLE APPS SCRIPT CHO HỆ THỐNG ĐIỂM DANH: "BOSS" & "NHÂN VIÊN"
 * ==============================================================================
 * 
 * PHIÊN BẢN: 2026-09-12 (HỖ TRỢ ĐA TRANG TÍNH: "DanhSach_SieuThi" & "NHÂN VIÊN")
 * - Hỗ trợ cả 2 bảng điểm danh: BOSS (sheet "DanhSach_SieuThi") & NHÂN VIÊN (sheet "NHÂN VIÊN" / "NHAN_VIEN").
 * - Phân vùng bộ nhớ đệm (Cache Partitioning) theo từng trang tính độc lập, không ghi đè nhau.
 * - Tự động nhận diện cột linh hoạt (STT/ID, Họ và Tên/Boss/Nhân Viên, Cột Checkbox ở Cột C, D hoặc E).
 * - Tự động xóa cache tức thời khi ai đó chỉnh sửa trực tiếp trên Google Sheet (onEdit & onChange).
 * - Tích hợp LockService & Batch Write (setValues) chống lag khi nhiều người bấm cùng lúc.
 * 
 * HƯỚNG DẪN CẬP NHẬT TRÊN GOOGLE SHEETS:
 * 1. Mở file Google Sheets chứa danh sách điểm danh của bạn.
 * 2. Đảm bảo file có 2 trang tính (Tabs):
 *    - Tab 1: "DanhSach_SieuThi" (dành cho Boss)
 *    - Tab 2: "NHÂN VIÊN" (dành cho Nhân viên)
 * 3. Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 4. Xoá TOÀN BỘ code cũ trong file Code.gs và DÁN TOÀN BỘ ĐOẠN CODE NÀY VÀO.
 * 5. Nhấn biểu tượng Đĩa mềm 💾 (Lưu).
 * 6. Nhấn "Triển khai" (Deploy) -> "Quản lý bản triển khai" (Manage deployments) ->
 *    Bấm biểu tượng Bút chì ✏️ -> Ở mục "Phiên bản" chọn "Phiên bản mới" (New version) -> Bấm "Triển khai".
 * 7. Tải lại trang tính, bạn sẽ thấy menu "📋 ĐIỂM DANH" trên thanh công cụ!
 * ==============================================================================
 */

var CACHE_PREFIX = 'ATTENDANCE_CACHE_V4_';
var CACHE_TTL_SECONDS = 3; // 3 giây cache tối đa, tự động xóa ngay khi có bất kỳ sửa đổi nào

// ==============================================================================
// 1. TIỆN ÍCH CHUẨN HOÁ TÊN & BỘ NHỚ ĐỆM
// ==============================================================================

function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function getCacheKeyForSheet(sheetName) {
  return CACHE_PREFIX + normalizeString(sheetName || 'default');
}

function invalidateCache(sheetName) {
  try {
    var cache = CacheService.getScriptCache();
    if (sheetName) {
      cache.remove(getCacheKeyForSheet(sheetName));
    }
    cache.removeAll([
      CACHE_PREFIX + 'danhsachsieuthi',
      CACHE_PREFIX + 'nhanvien',
      CACHE_PREFIX + 'boss',
      CACHE_PREFIX + 'default',
      'BOSS_ATTENDANCE_CACHE_V3',
      'BOSS_ATTENDANCE_CACHE_V2'
    ]);
  } catch (e) {}
}

// ==============================================================================
// 2. MENU CHẠY TRỰC TIẾP TRONG GOOGLE SHEETS & TRIGGERS TỰ ĐỘNG XÓA CACHE
// ==============================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 ĐIỂM DANH')
    .addItem('➕ Tạo Tự Động Tab "NHÂN VIÊN" Mẫu', 'menuCreateEmployeeSheet')
    .addSeparator()
    .addItem('☑️ Chèn ô Checkbox cho Trang Đang Chọn', 'menuInsertCheckboxes')
    .addSeparator()
    .addItem('📢 Lấy Tag CHƯA CHECK Trang Đang Chọn (Dán Zalo)', 'menuCopyUncheckedTags')
    .addSeparator()
    .addItem('✅ Check TẤT CẢ Trang Đang Chọn', 'menuCheckAll')
    .addItem('🔄 Bỏ check TẤT CẢ Trang Đang Chọn', 'menuUncheckAll')
    .addSeparator()
    .addItem('💾 Lưu vào Lịch Sử Điểm Danh', 'menuSaveDailyHistory')
    .addToUi();
}

function onEdit(e) {
  var sheet = e && e.range ? e.range.getSheet() : null;
  invalidateCache(sheet ? sheet.getName() : null);
}

function onChange(e) {
  invalidateCache();
}

// Tìm trang tính cần thao tác linh hoạt theo tên
function getTargetSheet(ss, requestedSheetName) {
  if (requestedSheetName) {
    var exactSheet = ss.getSheetByName(requestedSheetName);
    if (exactSheet) return exactSheet;

    var normReq = normalizeString(requestedSheetName);
    var allSheets = ss.getSheets();
    for (var i = 0; i < allSheets.length; i++) {
      if (normalizeString(allSheets[i].getName()) === normReq) {
        return allSheets[i];
      }
    }
  }

  // Mặc định fallback
  var defaultSheet = ss.getSheetByName('DanhSach_SieuThi') || 
                     ss.getSheetByName('NHÂN VIÊN') || 
                     ss.getSheetByName('BOSS') || 
                     ss.getActiveSheet();
  if (defaultSheet) return defaultSheet;
  return ss.getSheets()[0];
}

// Nhận diện cột thông minh từ header row
function getColumnMapFromHeader(headerRow) {
  var idCol = 1;     // A
  var storeCol = 2;  // B
  var bossCol = 3;   // C
  var dateCol = 4;   // D
  var checkCol = 5;  // E
  var timeCol = 6;   // F (Mặc định cột F lưu TIME)

  if (headerRow && headerRow.length) {
    var detectedCheck = -1;
    var detectedName = -1;
    var detectedId = -1;
    var detectedStore = -1;
    var detectedTime = -1;

    for (var i = 0; i < headerRow.length; i++) {
      var raw = String(headerRow[i] || '').trim();
      var norm = normalizeString(raw);

      if (norm === 'id' || norm === 'stt') {
        idCol = i + 1;
        detectedId = i + 1;
      } else if (norm.indexOf('sieuthi') !== -1 || norm.indexOf('store') !== -1 || norm.indexOf('phongban') !== -1 || norm.indexOf('bophan') !== -1) {
        storeCol = i + 1;
        detectedStore = i + 1;
      } else if (
        norm === 'boss' || 
        norm.indexOf('quanly') !== -1 || 
        norm.indexOf('hovaten') !== -1 || 
        norm.indexOf('nhanvien') !== -1 || 
        norm === 'ten' || 
        norm === 'nv' ||
        norm.indexOf('tennhanvien') !== -1
      ) {
        bossCol = i + 1;
        detectedName = i + 1;
      } else if (norm.indexOf('ngay') !== -1) {
        dateCol = i + 1;
      } else if (
        norm === 'check' || 
        norm.indexOf('diemdanh') !== -1 || 
        norm.indexOf('trangthai') !== -1 || 
        norm.indexOf('xacnhan') !== -1
      ) {
        checkCol = i + 1;
        detectedCheck = i + 1;
      } else if (norm === 'time' || norm.indexOf('thoigian') !== -1 || norm.indexOf('gio') !== -1) {
        timeCol = i + 1;
        detectedTime = i + 1;
      }
    }

    if (detectedCheck !== -1) {
      checkCol = detectedCheck;
    } else if (headerRow.length <= 4 && headerRow.length >= 2) {
      checkCol = headerRow.length;
    }

    if (detectedName !== -1) {
      bossCol = detectedName;
    } else if (headerRow.length === 3) {
      bossCol = 2;
    }

    if (detectedTime !== -1) {
      timeCol = detectedTime;
    }
  }

  return { idCol: idCol, storeCol: storeCol, bossCol: bossCol, dateCol: dateCol, checkCol: checkCol, timeCol: timeCol };
}

function getColumnMap(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 3);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = getColumnMapFromHeader(headers);
  if (!headers[map.checkCol - 1] || String(headers[map.checkCol - 1]).trim() === '') {
    sheet.getRange(1, map.checkCol).setValue('CHECK').setFontWeight('bold');
  }
  // Tự động tạo Header 'TIME' ở cột 6 nếu chưa có (áp dụng cho DanhSach_SieuThi)
  if (map.timeCol && (!headers[map.timeCol - 1] || String(headers[map.timeCol - 1]).trim() === '')) {
    var sName = sheet.getName().toLowerCase();
    if (sName.indexOf('nhan') === -1) {
      sheet.getRange(1, map.timeCol).setValue('TIME').setFontWeight('bold');
    }
  }
  return map;
}

// Khóa an toàn chống xung đột đa luồng
function withScriptLock(callback) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(5000);
  } catch (e) {}

  try {
    return callback();
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

// ==============================================================================
// 3. CÁC THAO TÁC MENU GOOGLE SHEETS TRÊN SHEET ĐANG MỞ
// ==============================================================================

function menuCreateEmployeeSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = 'NHÂN VIÊN';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange('A1:C1').setValues([['STT', 'HỌ VÀ TÊN', 'CHECK']]);
    sheet.getRange('A1:C1').setFontWeight('bold').setBackground('#e0e7ff').setHorizontalAlignment('center');

    var sampleRows = [];
    for (var i = 1; i <= 15; i++) {
      sampleRows.push([i, '', false]);
    }
    sheet.getRange(2, 1, sampleRows.length, 3).setValues(sampleRows);
    sheet.getRange(2, 3, sampleRows.length, 1).insertCheckboxes();
    sheet.setColumnWidth(1, 60);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 100);
    SpreadsheetApp.flush();
    invalidateCache();
    ss.toast('Đã tạo thành công tab "NHÂN VIÊN" với sẵn checkbox! Bạn chỉ cần dán tên vào cột B.', 'Thành công');
  } else {
    ss.toast('Tab "NHÂN VIÊN" đã có sẵn trong file Google Sheet này!', 'Thông báo');
  }
}

function menuInsertCheckboxes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var cols = getColumnMap(sheet);
    var range = sheet.getRange(2, cols.checkCol, lastRow - 1, 1);
    range.insertCheckboxes();
    SpreadsheetApp.flush();
    invalidateCache(sheet.getName());
    ss.toast('Đã chèn ô Checkbox cho Cột ' + cols.checkCol + ' (trang ' + sheet.getName() + ') thành công!', 'Thành công');
  }
}

function menuCheckAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  checkAllInColumn(sheet, true);
  ss.toast('Đã đánh dấu ĐÃ CHECK cho trang ' + sheet.getName() + '!', 'Thành công');
}

function menuUncheckAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  checkAllInColumn(sheet, false);
  ss.toast('Đã bỏ check toàn bộ trang ' + sheet.getName() + '!', 'Thành công');
}

function menuCopyUncheckedTags() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('Trang tính hiện chưa có dữ liệu!');
    return;
  }

  var cols = getColumnMap(sheet);
  var maxCol = Math.max(cols.bossCol, cols.checkCol);
  var data = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
  var seen = {};
  var tags = [];

  for (var i = 0; i < data.length; i++) {
    var personName = String(data[i][cols.bossCol - 1] || '').trim();
    var isChecked = isCellChecked(data[i][cols.checkCol - 1]);
    if (personName && !isChecked && !seen[personName]) {
      seen[personName] = true;
      tags.push(extractTag(personName));
    }
  }

  var ui = SpreadsheetApp.getUi();
  if (tags.length === 0) {
    ui.alert('🎉 Tuyệt vời! Tất cả mọi người trong trang "' + sheet.getName() + '" đều ĐÃ ĐIỂM DANH.');
  } else {
    var tagString = tags.join('\n');
    var htmlOutput = HtmlService.createHtmlOutput(
      '<div style="font-family: sans-serif; padding: 10px;">' +
      '<p>Tìm thấy <b>' + tags.length + '</b> người chưa check ở trang <b>' + sheet.getName() + '</b>:</p>' +
      '<textarea id="tagBox" style="width: 100%; height: 140px; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; white-space: pre;" readonly>' + tagString + '</textarea><br><br>' +
      '<button onclick="copyTags()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">📋 Copy Toàn Bộ Tag</button>' +
      '<span id="msg" style="margin-left: 10px; color: green; font-weight: bold;"></span>' +
      '<script>' +
      'function copyTags() {' +
      '  var tb = document.getElementById("tagBox");' +
      '  tb.select();' +
      '  document.execCommand("copy");' +
      '  document.getElementById("msg").innerText = "✓ Đã copy thành công!";' +
      '}' +
      '</script>' +
      '</div>'
    ).setWidth(450).setHeight(220);
    ui.showModalDialog(htmlOutput, '📢 Danh Sách Tag Chưa Check (' + sheet.getName() + ')');
  }
}

function menuSaveDailyHistory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var today = getTodayString();
  var historySheet = ss.getSheetByName('LichSu_DiemDanh');
  if (!historySheet) {
    historySheet = ss.insertSheet('LichSu_DiemDanh');
    historySheet.appendRow(['NGÀY', 'TRANG TÍNH', 'MÃ / ID', 'TÊN / ĐỐI TƯỢNG', 'TRẠNG THÁI', 'THỜI GIAN LƯU']);
    historySheet.getRange('A1:F1').setFontWeight('bold').setBackground('#ecfdf5');
  }

  var cols = getColumnMap(sheet);
  var maxCol = Math.max(cols.idCol, cols.storeCol, cols.bossCol, cols.checkCol);
  var data = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  for (var i = 0; i < data.length; i++) {
    var pId = String(data[i][cols.idCol - 1] || ('id-' + (i + 1)));
    var pName = String(data[i][cols.bossCol - 1] || '');
    var isChecked = isCellChecked(data[i][cols.checkCol - 1]);

    if (pName) {
      historySheet.appendRow([
        today,
        sheet.getName(),
        pId,
        pName,
        isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH',
        new Date()
      ]);
    }
  }

  SpreadsheetApp.getUi().alert('Đã lưu dữ liệu điểm danh của trang "' + sheet.getName() + '" ngày ' + today + ' vào sheet "LichSu_DiemDanh"!');
}

// ==============================================================================
// 4. API WEB APP (ĐỒNG BỘ 2 CHIỀU ĐA TRANG TÍNH)
// ==============================================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getAll';
    var sheetName = params.sheet || 'DanhSach_SieuThi';

    // 1. CẬP NHẬT CHECK ĐƠN LẺ
    if (action === 'updateCheck') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true || params.isChecked === '1';
      var personName = params.boss || params.name || '';
      var row = parseInt(params.row, 10);
      var rowsStr = params.rows || '';
      var checkTime = params.time || params.checkTime || '';

      updateCheckInSheet(ss, personName, isChecked, row, rowsStr, sheetName, checkTime);
      return createJsonResponse({ status: 'success', message: 'Checked updated immediately' });
    }

    // 2. GỘP NHIỀU LƯỢT CHECK (BATCH CHECK)
    if (action === 'batchCheck') {
      var items = [];
      try {
        items = JSON.parse(params.items || '[]');
      } catch(err) {}
      batchCheckInSheet(ss, items, sheetName);
      return createJsonResponse({ status: 'success', message: 'Batch check updated' });
    }

    // 3. CHECK / BỎ CHECK TẤT CẢ
    if (action === 'checkAll') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true || params.isChecked === '1';
      var checkTime = params.time || params.checkTime || '';
      checkAllInTargetSheet(ss, isChecked, sheetName, checkTime);
      return createJsonResponse({ status: 'success', message: 'All updated' });
    }

    // 4. THÊM NGƯỜI MỚI VÀO SHEET
    if (action === 'addMember') {
      var newName = params.name || '';
      if (newName) {
        addMemberToSheet(ss, newName, sheetName);
        return createJsonResponse({ status: 'success', message: 'Member added' });
      }
      return createJsonResponse({ status: 'error', message: 'Missing name parameter' });
    }

    // 5. XOÁ NGƯỜI KHỎI SHEET
    if (action === 'deleteMember') {
      var rowToDelete = parseInt(params.row, 10);
      if (rowToDelete && rowToDelete >= 2) {
        deleteMemberFromSheet(ss, rowToDelete, sheetName);
        return createJsonResponse({ status: 'success', message: 'Member deleted' });
      }
      return createJsonResponse({ status: 'error', message: 'Invalid row parameter' });
    }

    // 6. ĐỌC DỮ LIỆU ĐIỂM DANH (CÓ CACHESERVICE TỐI ƯU THEO SHEET)
    var bypassCache = params.noCache === '1' || params.noCache === 'true';
    var sheetData = readSheetDataCached(ss, bypassCache, sheetName);
    return createJsonResponse({
      status: 'success',
      date: getTodayString(),
      sheetName: sheetData.sheetName || sheetName,
      bossList: sheetData.bossList,
      staffList: sheetData.bossList, // Alias thuận tiện cho bảng Nhân Viên
      stores: sheetData.stores,
      attendance: sheetData.attendance,
      cached: sheetData.isCached || false
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (ex) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    var action = data.action;
    var sheetName = data.sheet || 'DanhSach_SieuThi';

    if (action === 'updateCheck') {
      var isChecked = Boolean(data.isChecked === true || data.isChecked === 'true' || data.isChecked === '1');
      var personName = data.boss || data.name || '';
      var row = parseInt(data.row, 10);
      var rowsStr = data.rows || '';
      var checkTime = data.time || data.checkTime || '';

      updateCheckInSheet(ss, personName, isChecked, row, rowsStr, sheetName, checkTime);
      return createJsonResponse({ status: 'success', message: 'Checked updated' });
    }

    if (action === 'batchCheck') {
      var items = data.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(ex){}
      }
      batchCheckInSheet(ss, items, sheetName);
      return createJsonResponse({ status: 'success', message: 'Batch check updated' });
    }

    if (action === 'checkAll') {
      var isChecked = Boolean(data.isChecked === true || data.isChecked === 'true' || data.isChecked === '1');
      var checkTime = data.time || data.checkTime || '';
      checkAllInTargetSheet(ss, isChecked, sheetName, checkTime);
      return createJsonResponse({ status: 'success', message: 'All updated' });
    }

    if (action === 'addMember') {
      var newName = data.name || '';
      if (newName) {
        addMemberToSheet(ss, newName, sheetName);
        return createJsonResponse({ status: 'success', message: 'Member added' });
      }
    }

    if (action === 'deleteMember') {
      var rowToDelete = parseInt(data.row, 10);
      if (rowToDelete && rowToDelete >= 2) {
        deleteMemberFromSheet(ss, rowToDelete, sheetName);
        return createJsonResponse({ status: 'success', message: 'Member deleted' });
      }
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ==============================================================================
// 5. XỬ LÝ DỮ LIỆU ĐỌC / GHI TRÊN SHEET ĐƯỢC CHỈ ĐỊNH
// ==============================================================================

function updateCheckInSheet(ss, personName, isChecked, rowNumber, rowsStr, sheetName, checkTime) {
  return withScriptLock(function () {
    var sheet = getTargetSheet(ss, sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var cols = getColumnMap(sheet);
    var maxCol = Math.max(sheet.getLastColumn(), cols.checkCol, cols.bossCol, cols.timeCol || 0);
    var allData = sheet.getRange(1, 1, lastRow, maxCol).getValues();
    var targetVal = Boolean(isChecked);
    var timeVal = targetVal ? (checkTime || getCurrentTimeString()) : '';

    var bossColIdx = cols.bossCol - 1;
    var checkColIdx = cols.checkCol - 1;
    var timeColIdx = cols.timeCol ? (cols.timeCol - 1) : -1;
    var hasChanges = false;

    function applyChange(rIdx) {
      allData[rIdx][checkColIdx] = targetVal;
      if (timeColIdx !== -1) {
        allData[rIdx][timeColIdx] = timeVal;
      }
      hasChanges = true;
    }

    if (personName) {
      var targetPerson = String(personName).trim().toLowerCase();
      for (var i = 1; i < allData.length; i++) {
        var cur = String(allData[i][bossColIdx] || '').trim().toLowerCase();
        if (cur === targetPerson) {
          applyChange(i);
        }
      }
    } else if (rowsStr) {
      var rowsArr = String(rowsStr).split(',');
      for (var r = 0; r < rowsArr.length; r++) {
        var rNum = parseInt(rowsArr[r], 10);
        if (rNum >= 2 && rNum <= lastRow) {
          applyChange(rNum - 1);
        }
      }
    } else if (rowNumber && rowNumber >= 2 && rowNumber <= lastRow) {
      applyChange(rowNumber - 1);
    }

    if (hasChanges) {
      var checkColValues = [];
      var timeColValues = [];
      for (var k = 1; k < allData.length; k++) {
        checkColValues.push([allData[k][checkColIdx]]);
        if (timeColIdx !== -1) {
          timeColValues.push([allData[k][timeColIdx] || '']);
        }
      }
      sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValues(checkColValues);
      if (timeColIdx !== -1) {
        sheet.getRange(2, cols.timeCol, lastRow - 1, 1).setValues(timeColValues);
      }
      SpreadsheetApp.flush();
      invalidateCache(sheet.getName());
    }
  });
}

function batchCheckInSheet(ss, items, sheetName) {
  if (!items || !items.length) return;

  return withScriptLock(function () {
    var sheet = getTargetSheet(ss, sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var cols = getColumnMap(sheet);
    var maxCol = Math.max(sheet.getLastColumn(), cols.checkCol, cols.bossCol, cols.timeCol || 0);
    var allData = sheet.getRange(1, 1, lastRow, maxCol).getValues();
    var bossColIdx = cols.bossCol - 1;
    var checkColIdx = cols.checkCol - 1;
    var timeColIdx = cols.timeCol ? (cols.timeCol - 1) : -1;
    var hasChanges = false;

    function applyChange(rIdx, targetVal, timeVal) {
      allData[rIdx][checkColIdx] = targetVal;
      if (timeColIdx !== -1) {
        allData[rIdx][timeColIdx] = timeVal;
      }
      hasChanges = true;
    }

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var targetVal = Boolean(it.isChecked === true || it.isChecked === 'true' || it.isChecked === '1');
      var timeVal = targetVal ? (it.time || it.checkTime || getCurrentTimeString()) : '';
      var nameToFind = it.boss || it.name;
      if (nameToFind) {
        var targetName = String(nameToFind).trim().toLowerCase();
        for (var i = 1; i < allData.length; i++) {
          var cur = String(allData[i][bossColIdx] || '').trim().toLowerCase();
          if (cur === targetName) {
            applyChange(i, targetVal, timeVal);
          }
        }
      } else if (it.row && it.row >= 2 && it.row <= lastRow) {
        applyChange(it.row - 1, targetVal, timeVal);
      }
    }

    if (hasChanges) {
      var checkColValues = [];
      var timeColValues = [];
      for (var k = 1; k < allData.length; k++) {
        checkColValues.push([allData[k][checkColIdx]]);
        if (timeColIdx !== -1) {
          timeColValues.push([allData[k][timeColIdx] || '']);
        }
      }
      sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValues(checkColValues);
      if (timeColIdx !== -1) {
        sheet.getRange(2, cols.timeCol, lastRow - 1, 1).setValues(timeColValues);
      }
      SpreadsheetApp.flush();
      invalidateCache(sheet.getName());
    }
  });
}

function checkAllInColumn(sheet, isChecked, checkTime) {
  return withScriptLock(function () {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var cols = getColumnMap(sheet);
    var targetVal = Boolean(isChecked);
    sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValue(targetVal);

    if (cols.timeCol) {
      var timeVal = targetVal ? (checkTime || getCurrentTimeString()) : '';
      sheet.getRange(2, cols.timeCol, lastRow - 1, 1).setValue(timeVal);
    }

    SpreadsheetApp.flush();
    invalidateCache(sheet.getName());
  });
}

function checkAllInTargetSheet(ss, isChecked, sheetName, checkTime) {
  var sheet = getTargetSheet(ss, sheetName);
  return checkAllInColumn(sheet, isChecked, checkTime);
}

function addMemberToSheet(ss, name, sheetName) {
  return withScriptLock(function () {
    var sheet = getTargetSheet(ss, sheetName);
    var cols = getColumnMap(sheet);
    var newRow = sheet.getLastRow() + 1;
    var maxCol = Math.max(cols.checkCol, cols.bossCol, cols.idCol, 3);
    var rowData = new Array(maxCol);
    for (var c = 0; c < maxCol; c++) rowData[c] = '';

    if (cols.idCol <= maxCol) rowData[cols.idCol - 1] = newRow - 1;
    if (cols.bossCol <= maxCol) rowData[cols.bossCol - 1] = name;
    if (cols.checkCol <= maxCol) rowData[cols.checkCol - 1] = false;

    sheet.appendRow(rowData);
    sheet.getRange(newRow, cols.checkCol).insertCheckboxes();
    SpreadsheetApp.flush();
    invalidateCache(sheet.getName());
  });
}

function deleteMemberFromSheet(ss, rowNumber, sheetName) {
  return withScriptLock(function () {
    var sheet = getTargetSheet(ss, sheetName);
    if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
      sheet.deleteRow(rowNumber);
      SpreadsheetApp.flush();
      invalidateCache(sheet.getName());
    }
  });
}

function readSheetDataCached(ss, bypassCache, sheetName) {
  var cacheKey = getCacheKeyForSheet(sheetName);
  if (!bypassCache) {
    try {
      var cache = CacheService.getScriptCache();
      var cachedStr = cache.get(cacheKey);
      if (cachedStr) {
        var parsed = JSON.parse(cachedStr);
        parsed.isCached = true;
        return parsed;
      }
    } catch (e) {}
  }

  var dataObj = readSheetDataDirect(ss, sheetName);

  try {
    var cache = CacheService.getScriptCache();
    cache.put(cacheKey, JSON.stringify(dataObj), CACHE_TTL_SECONDS);
  } catch (e) {}

  return dataObj;
}

function readSheetDataDirect(ss, sheetName) {
  var sheet = getTargetSheet(ss, sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { bossList: [], stores: [], attendance: {}, sheetName: sheet.getName() };
  }

  var cols = getColumnMap(sheet);
  var lastCol = Math.max(sheet.getLastColumn(), cols.checkCol, cols.bossCol, cols.timeCol || 0);
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  var bossMap = {};
  var bossList = [];
  var stores = [];
  var attendance = {};

  var idColIdx = cols.idCol - 1;
  var storeColIdx = cols.storeCol - 1;
  var bossColIdx = cols.bossCol - 1;
  var checkColIdx = cols.checkCol - 1;
  var timeColIdx = cols.timeCol ? (cols.timeCol - 1) : -1;

  for (var i = 1; i < data.length; i++) {
    var rowNum = i + 1;
    var stId = String(data[i][idColIdx] || ('id-' + i)).trim();
    var stName = String(data[i][storeColIdx] || '').trim();
    var personName = String(data[i][bossColIdx] || '').trim();
    var isChecked = isCellChecked(data[i][checkColIdx]);
    var checkTime = (timeColIdx !== -1 && isChecked) ? formatTimeValue(data[i][timeColIdx]) : '';

    if (personName) {
      stores.push({
        id: stId,
        name: stName,
        boss: personName,
        isChecked: isChecked,
        checkTime: checkTime
      });

      if (isChecked) {
        attendance[stId] = true;
        attendance[personName] = true;
      }

      if (!bossMap[personName]) {
        bossMap[personName] = {
          row: rowNum,
          rows: [rowNum],
          stt: bossList.length + 1,
          name: personName,
          isChecked: isChecked,
          checkTime: checkTime,
          tag: extractTag(personName)
        };
        bossList.push(bossMap[personName]);
      } else {
        bossMap[personName].rows.push(rowNum);
        if (isChecked) {
          bossMap[personName].isChecked = true;
          if (checkTime && !bossMap[personName].checkTime) {
            bossMap[personName].checkTime = checkTime;
          }
        }
      }
    }
  }

  return {
    sheetName: sheet.getName(),
    bossList: bossList,
    stores: stores,
    attendance: attendance
  };
}

function isCellChecked(val) {
  if (val === true || val === 'TRUE' || val === 'true') return true;
  if (typeof val === 'string') {
    var s = val.toLowerCase().trim();
    if (s === 'x' || s === 'v' || s === 'đã check' || s === 'có mặt' || s === 'ok') return true;
  }
  return false;
}

function extractTag(nameStr) {
  if (!nameStr) return '@';
  var trimmed = String(nameStr).trim();
  var parts = trimmed.split('_');
  if (parts.length > 1) {
    return '@' + parts[parts.length - 1].trim();
  }
  var numMatch = trimmed.match(/\d+/);
  if (numMatch) return '@' + numMatch[0];
  return '@' + trimmed;
}

function formatTimeValue(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    var hh = ('0' + val.getHours()).slice(-2);
    var mm = ('0' + val.getMinutes()).slice(-2);
    var ss = ('0' + val.getSeconds()).slice(-2);
    return hh + ':' + mm + ':' + ss;
  }
  var str = String(val).trim();
  if (str === 'undefined' || str === 'null') return '';
  return str;
}

function getCurrentTimeString() {
  var now = new Date();
  var hh = ('0' + now.getHours()).slice(-2);
  var mm = ('0' + now.getMinutes()).slice(-2);
  var ss = ('0' + now.getSeconds()).slice(-2);
  return hh + ':' + mm + ':' + ss;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTodayString() {
  var now = new Date();
  var y = now.getFullYear();
  var m = ('0' + (now.getMonth() + 1)).slice(-2);
  var d = ('0' + now.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}
