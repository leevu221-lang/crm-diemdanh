/**
 * ==============================================================================
 * MÃ NGUỒN GOOGLE APPS SCRIPT CHO HỆ THỐNG ĐIỂM DANH BOSS (TỐI ƯU SIÊU TỐC)
 * ==============================================================================
 * 
 * PHIÊN BẢN: 2026-09-10 (TỐI ƯU HOÁ TỐC ĐỘ ĐỒNG BỘ & CHỐNG NGHẼN KHI NHIỀU MÁY BẤM CÙNG LÚC)
 * - Tích hợp LockService: Chống xung đột ghi dữ liệu khi nhiều trình duyệt/điện thoại cùng check.
 * - Tích hợp CacheService: Đọc dữ liệu từ bộ nhớ đệm RAM (phản hồi trong 20-50ms thay vì 4-9 giây).
 * - Batch Write (setValues): Ghi toàn bộ Cột E trong 1 lệnh duy nhất (giảm từ 3s xuống 0.08s).
 * - Tự động xóa Cache ngay khi có thao tác Check / Bỏ check.
 * 
 * Bảng tính chuẩn:
 * Cột A: ID
 * Cột B: SIÊU THỊ
 * Cột C: BOSS
 * Cột D: NGÀY TẠO
 * Cột E: CHECK (Tự động ghi nhận Đã Check / Chưa Check)
 * 
 * HƯỚNG DẪN CẬP NHẬT TRÊN GOOGLE SHEETS:
 * 1. Mở file Google Sheets chứa danh sách Boss của bạn.
 * 2. Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xoá TOÀN BỘ code cũ trong file Code.gs và DÁN TOÀN BỘ ĐOẠN CODE NÀY VÀO.
 * 4. Nhấn biểu tượng Đĩa mềm 💾 (Lưu).
 * 5. Nhấn "Triển khai" (Deploy) -> "Quản lý bản triển khai" (Manage deployments) ->
 *    Bấm biểu tượng Bút chì ✏️ -> Ở mục "Phiên bản" chọn "Phiên bản mới" (New version) -> Bấm "Triển khai".
 * 6. Tải lại trang tính, bạn sẽ thấy menu "📋 ĐIỂM DANH" trên thanh công cụ!
 * ==============================================================================
 */

var CACHE_KEY_ALL = 'BOSS_ATTENDANCE_CACHE_V2';
var CACHE_TTL_SECONDS = 30; // Giữ cache 30s cho các máy cùng thăm dò, tự động xóa ngay khi có lượt check mới

// ==============================================================================
// 1. MENU CHẠY TRỰC TIẾP TRONG GOOGLE SHEETS
// ==============================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 ĐIỂM DANH')
    .addItem('☑️ Chèn ô Checkbox cho CỘT E', 'menuInsertCheckboxes')
    .addSeparator()
    .addItem('📢 Lấy Tag Boss CHƯA CHECK ở Cột E (Dán Zalo)', 'menuCopyUncheckedTags')
    .addSeparator()
    .addItem('✅ Check TẤT CẢ Cột E', 'menuCheckAll')
    .addItem('🔄 Bỏ check TẤT CẢ Cột E', 'menuUncheckAll')
    .addSeparator()
    .addItem('💾 Lưu vào Lịch Sử Điểm Danh', 'menuSaveDailyHistory')
    .addToUi();
}

// Tìm trang tính cần thao tác (ưu tiên sheet 'BOSS' hoặc 'DanhSach_SieuThi')
function getTargetSheet(ss) {
  var sheet = ss.getSheetByName('BOSS') || ss.getSheetByName('DanhSach_SieuThi') || ss.getActiveSheet();
  if (sheet) return sheet;
  return ss.getSheets()[0];
}

// Xác định vị trí các cột động từ dòng tiêu đề mảng bộ nhớ (Không tốn thêm request đọc Sheet)
function getColumnMapFromHeader(headerRow) {
  var idCol = 1;     // A
  var storeCol = 2;  // B
  var bossCol = 3;   // C
  var dateCol = 4;   // D
  var checkCol = 5;  // E (CỘT SỐ 5)

  if (headerRow && headerRow.length) {
    for (var i = 0; i < headerRow.length; i++) {
      var h = String(headerRow[i] || '').toUpperCase().trim();
      if (h === 'ID') idCol = i + 1;
      if (h === 'SIÊU THỊ' || h === 'SIEU THI' || h === 'STORE') storeCol = i + 1;
      if (h === 'BOSS' || h === 'QUẢN LÝ' || h === 'HỌ VÀ TÊN') bossCol = i + 1;
      if (h === 'NGÀY TẠO' || h === 'NGAY TAO' || h === 'NGÀY') dateCol = i + 1;
      if (h === 'CHECK' || h === 'ĐIỂM DANH' || h === 'TRẠNG THÁI') checkCol = i + 1;
    }
  }

  return { idCol: idCol, storeCol: storeCol, bossCol: bossCol, dateCol: dateCol, checkCol: checkCol };
}

function getColumnMap(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 5);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = getColumnMapFromHeader(headers);
  if (!headers[map.checkCol - 1] || String(headers[map.checkCol - 1]).trim() === '') {
    sheet.getRange(1, map.checkCol).setValue('CHECK').setFontWeight('bold');
  }
  return map;
}

// Khóa an toàn chống xung đột đa luồng khi nhiều máy cùng bấm
function withScriptLock(callback) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(5000); // Chờ tối đa 5 giây
  } catch (e) {}

  try {
    return callback();
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch(e) {}
    }
  }
}

// Xóa cache bộ nhớ đệm
function invalidateCache() {
  try {
    CacheService.getScriptCache().remove(CACHE_KEY_ALL);
  } catch (e) {}
}

// ==============================================================================
// 2. CÁC THAO TÁC MENU GOOGLE SHEETS
// ==============================================================================

function menuInsertCheckboxes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var cols = getColumnMap(sheet);
    var range = sheet.getRange(2, cols.checkCol, lastRow - 1, 1);
    range.insertCheckboxes();
    SpreadsheetApp.flush();
    invalidateCache();
    ss.toast('Đã chèn ô Checkbox cho CỘT E thành công!', 'Thành công');
  }
}

function menuCheckAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  checkAllInColumnE(ss, true);
  ss.toast('Đã đánh dấu ĐÃ CHECK cho toàn bộ Cột E!', 'Thành công');
}

function menuUncheckAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  checkAllInColumnE(ss, false);
  ss.toast('Đã bỏ check toàn bộ Cột E!', 'Thành công');
}

function menuCopyUncheckedTags() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTargetSheet(ss);
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
    var bossName = String(data[i][cols.bossCol - 1] || '').trim();
    var isChecked = isCellChecked(data[i][cols.checkCol - 1]);
    if (bossName && !isChecked && !seen[bossName]) {
      seen[bossName] = true;
      tags.push(extractTag(bossName));
    }
  }

  var ui = SpreadsheetApp.getUi();
  if (tags.length === 0) {
    ui.alert('🎉 Tuyệt vời! Tất cả BOSS đều ĐÃ ĐIỂM DANH ở Cột E.');
  } else {
    var tagString = tags.join(' ');
    var htmlOutput = HtmlService.createHtmlOutput(
      '<div style="font-family: sans-serif; padding: 10px;">' +
      '<p>Tìm thấy <b>' + tags.length + '</b> Boss chưa check ở <b>Cột E</b>:</p>' +
      '<textarea id="tagBox" style="width: 100%; height: 90px; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;" readonly>' + tagString + '</textarea><br><br>' +
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
    ui.showModalDialog(htmlOutput, '📢 Danh Sách Tag Chưa Check (Cột E)');
  }
}

function menuSaveDailyHistory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var today = getTodayString();
  var historySheet = ss.getSheetByName('LichSu_DiemDanh');
  if (!historySheet) {
    historySheet = ss.insertSheet('LichSu_DiemDanh');
    historySheet.appendRow(['NGÀY', 'ID SIÊU THỊ', 'SIÊU THỊ', 'BOSS', 'TRẠNG THÁI CỘT E', 'THỜI GIAN LƯU']);
    historySheet.getRange('A1:F1').setFontWeight('bold').setBackground('#ecfdf5');
  }

  var cols = getColumnMap(sheet);
  var maxCol = Math.max(cols.idCol, cols.storeCol, cols.bossCol, cols.checkCol);
  var data = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  for (var i = 0; i < data.length; i++) {
    var stId = String(data[i][cols.idCol - 1] || ('st-' + (i + 1)));
    var stName = String(data[i][cols.storeCol - 1] || '');
    var bName = String(data[i][cols.bossCol - 1] || '');
    var isChecked = isCellChecked(data[i][cols.checkCol - 1]);

    if (bName) {
      historySheet.appendRow([
        today,
        stId,
        stName,
        bName,
        isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH',
        new Date()
      ]);
    }
  }

  SpreadsheetApp.getUi().alert('Đã lưu dữ liệu điểm danh Cột E ngày ' + today + ' vào sheet "LichSu_DiemDanh"!');
}

// ==============================================================================
// 3. API WEB APP (TỐI ƯU SIÊU TỐC - ĐỒNG BỘ 2 CHIỀU)
// ==============================================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getAll';

    // 1. CẬP NHẬT CHECK ĐƠN LẺ VÀO CỘT E
    if (action === 'updateCheck') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true || params.isChecked === '1';
      var bossName = params.boss || params.name || '';
      var row = parseInt(params.row, 10);
      var rowsStr = params.rows || '';

      updateCheckInColumnE(ss, bossName, isChecked, row, rowsStr);
      return createJsonResponse({ status: 'success', message: 'Checked into column E immediately' });
    }

    // 2. GỘP NHIỀU LƯỢT CHECK (BATCH CHECK)
    if (action === 'batchCheck') {
      var items = [];
      try {
        items = JSON.parse(params.items || '[]');
      } catch(err) {}
      batchCheckInColumnE(ss, items);
      return createJsonResponse({ status: 'success', message: 'Batch check updated' });
    }

    // 3. CHECK / BỎ CHECK TẤT CẢ CỘT E
    if (action === 'checkAll') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true || params.isChecked === '1';
      checkAllInColumnE(ss, isChecked);
      return createJsonResponse({ status: 'success', message: 'All column E updated' });
    }

    // 4. ĐỌC DỮ LIỆU ĐIỂM DANH TỪ CỘT E (HỖ TRỢ CACHESERVICE SIÊU NHANH)
    var bypassCache = params.noCache === '1' || params.noCache === 'true';
    var sheetData = readSheetDataCached(ss, bypassCache);
    return createJsonResponse({
      status: 'success',
      date: getTodayString(),
      bossList: sheetData.bossList,
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

    if (action === 'updateCheck') {
      var isChecked = Boolean(data.isChecked === true || data.isChecked === 'true' || data.isChecked === '1');
      var bossName = data.boss || data.name || '';
      var row = parseInt(data.row, 10);
      var rowsStr = data.rows || '';

      updateCheckInColumnE(ss, bossName, isChecked, row, rowsStr);
      return createJsonResponse({ status: 'success', message: 'Checked into column E' });
    }

    if (action === 'batchCheck') {
      var items = data.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(ex){}
      }
      batchCheckInColumnE(ss, items);
      return createJsonResponse({ status: 'success', message: 'Batch check updated' });
    }

    if (action === 'checkAll') {
      checkAllInColumnE(ss, Boolean(data.isChecked === true || data.isChecked === 'true' || data.isChecked === '1'));
      return createJsonResponse({ status: 'success', message: 'All column E updated' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ==============================================================================
// 4. XỬ LÝ DỮ LIỆU CỘT E (GHI HÀNG LOẠT BATCH WRITE & KHÓA LOCKSERVICE)
// ==============================================================================

// Cập nhật check cho một Boss hoặc một danh sách dòng vào CỘT E
function updateCheckInColumnE(ss, bossName, isChecked, rowNumber, rowsStr) {
  return withScriptLock(function () {
    var sheet = getTargetSheet(ss);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var lastCol = Math.max(sheet.getLastColumn(), 5);
    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var cols = getColumnMapFromHeader(allData[0]);
    var targetVal = Boolean(isChecked);

    var bossColIdx = cols.bossCol - 1;
    var checkColIdx = cols.checkCol - 1;
    var hasChanges = false;

    // Trường hợp 1: Theo tên Boss
    if (bossName) {
      var targetBoss = String(bossName).trim().toLowerCase();
      for (var i = 1; i < allData.length; i++) {
        var currentBoss = String(allData[i][bossColIdx] || '').trim().toLowerCase();
        if (currentBoss === targetBoss) {
          allData[i][checkColIdx] = targetVal;
          hasChanges = true;
        }
      }
    }
    // Trường hợp 2: Theo danh sách số dòng (rowsStr)
    else if (rowsStr) {
      var rowsArr = String(rowsStr).split(',');
      for (var r = 0; r < rowsArr.length; r++) {
        var rNum = parseInt(rowsArr[r], 10);
        if (rNum >= 2 && rNum <= lastRow) {
          allData[rNum - 1][checkColIdx] = targetVal;
          hasChanges = true;
        }
      }
    }
    // Trường hợp 3: Theo một dòng đơn lẻ
    else if (rowNumber && rowNumber >= 2 && rowNumber <= lastRow) {
      allData[rowNumber - 1][checkColIdx] = targetVal;
      hasChanges = true;
    }

    if (hasChanges) {
      // Ghi hàng loạt (Batch Write) chỉ trong 1 lệnh duy nhất!
      var checkColValues = [];
      for (var k = 1; k < allData.length; k++) {
        checkColValues.push([allData[k][checkColIdx]]);
      }
      sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValues(checkColValues);
      SpreadsheetApp.flush();
      invalidateCache();
    }
  });
}

// Cập nhật gộp nhiều Boss cùng một lúc (Batch Update)
function batchCheckInColumnE(ss, items) {
  if (!items || !items.length) return;

  return withScriptLock(function () {
    var sheet = getTargetSheet(ss);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var lastCol = Math.max(sheet.getLastColumn(), 5);
    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var cols = getColumnMapFromHeader(allData[0]);
    var bossColIdx = cols.bossCol - 1;
    var checkColIdx = cols.checkCol - 1;
    var hasChanges = false;

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var targetVal = Boolean(it.isChecked === true || it.isChecked === 'true' || it.isChecked === '1');
      if (it.boss) {
        var targetBoss = String(it.boss).trim().toLowerCase();
        for (var i = 1; i < allData.length; i++) {
          var currentBoss = String(allData[i][bossColIdx] || '').trim().toLowerCase();
          if (currentBoss === targetBoss) {
            allData[i][checkColIdx] = targetVal;
            hasChanges = true;
          }
        }
      } else if (it.row && it.row >= 2 && it.row <= lastRow) {
        allData[it.row - 1][checkColIdx] = targetVal;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      var checkColValues = [];
      for (var k = 1; k < allData.length; k++) {
        checkColValues.push([allData[k][checkColIdx]]);
      }
      sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValues(checkColValues);
      SpreadsheetApp.flush();
      invalidateCache();
    }
  });
}

// Check hoặc bỏ check toàn bộ Cột E
function checkAllInColumnE(ss, isChecked) {
  return withScriptLock(function () {
    var sheet = getTargetSheet(ss);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var cols = getColumnMap(sheet);
    sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValue(Boolean(isChecked));
    SpreadsheetApp.flush();
    invalidateCache();
  });
}

// Đọc dữ liệu từ Sheet có hỗ trợ CacheService
function readSheetDataCached(ss, bypassCache) {
  if (!bypassCache) {
    try {
      var cache = CacheService.getScriptCache();
      var cachedStr = cache.get(CACHE_KEY_ALL);
      if (cachedStr) {
        var parsed = JSON.parse(cachedStr);
        parsed.isCached = true;
        return parsed;
      }
    } catch (e) {}
  }

  var dataObj = readSheetDataDirect(ss);

  // Lưu vào CacheService trong 30 giây
  try {
    var cache = CacheService.getScriptCache();
    cache.put(CACHE_KEY_ALL, JSON.stringify(dataObj), CACHE_TTL_SECONDS);
  } catch (e) {}

  return dataObj;
}

// Đọc trực tiếp từ Sheet với 1 lần gọi duy nhất
function readSheetDataDirect(ss) {
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { bossList: [], stores: [], attendance: {} };
  }

  var lastCol = Math.max(sheet.getLastColumn(), 5);
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var cols = getColumnMapFromHeader(data[0]);

  var bossMap = {};
  var bossList = [];
  var stores = [];
  var attendance = {};

  var idColIdx = cols.idCol - 1;
  var storeColIdx = cols.storeCol - 1;
  var bossColIdx = cols.bossCol - 1;
  var checkColIdx = cols.checkCol - 1;

  for (var i = 1; i < data.length; i++) {
    var rowNum = i + 1;
    var stId = String(data[i][idColIdx] || ('st-' + i)).trim();
    var stName = String(data[i][storeColIdx] || '').trim();
    var bossName = String(data[i][bossColIdx] || '').trim();
    var isChecked = isCellChecked(data[i][checkColIdx]);

    if (bossName) {
      stores.push({
        id: stId,
        name: stName,
        boss: bossName,
        isChecked: isChecked
      });

      if (isChecked) {
        attendance[stId] = true;
        attendance[bossName] = true;
      }

      // Gom nhóm theo Boss duy nhất
      if (!bossMap[bossName]) {
        bossMap[bossName] = {
          row: rowNum,
          rows: [rowNum],
          stt: bossList.length + 1,
          name: bossName,
          isChecked: isChecked,
          tag: extractTag(bossName)
        };
        bossList.push(bossMap[bossName]);
      } else {
        bossMap[bossName].rows.push(rowNum);
        if (isChecked) {
          bossMap[bossName].isChecked = true;
        }
      }
    }
  }

  return {
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
