/**
 * ==============================================================================
 * MÃ NGUỒN GOOGLE APPS SCRIPT CHO HỆ THỐNG ĐIỂM DANH BOSS (CHECK VÀO CỘT E)
 * ==============================================================================
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

// Tìm trang tính cần thao tác (ưu tiên sheet có cột BOSS hoặc sheet đang mở)
function getTargetSheet(ss) {
  var active = ss.getActiveSheet();
  if (active && hasBossColumn(active)) return active;

  var names = ['BOSS', 'DanhSach_SieuThi', 'SIÊU THỊ', 'Trang tính1', 'Sheet1'];
  for (var i = 0; i < names.length; i++) {
    var s = ss.getSheetByName(names[i]);
    if (s && hasBossColumn(s)) return s;
  }
  return ss.getSheets()[0];
}

function hasBossColumn(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 5);
  if (sheet.getLastRow() < 1) return false;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toUpperCase().trim();
    if (h === 'BOSS' || h === 'SIÊU THỊ' || h === 'ID') return true;
  }
  return false;
}

// Xác định vị trí các cột động (mặc định A:1, B:2, C:3, D:4, E:5)
function getColumnMap(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 5);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  var idCol = 1;     // A
  var storeCol = 2;  // B
  var bossCol = 3;   // C
  var dateCol = 4;   // D
  var checkCol = 5;  // E (CỘT SỐ 5)

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toUpperCase().trim();
    if (h === 'ID') idCol = i + 1;
    if (h === 'SIÊU THỊ' || h === 'SIEU THI' || h === 'STORE') storeCol = i + 1;
    if (h === 'BOSS' || h === 'QUẢN LÝ' || h === 'HỌ VÀ TÊN') bossCol = i + 1;
    if (h === 'NGÀY TẠO' || h === 'NGAY TAO' || h === 'NGÀY') dateCol = i + 1;
    if (h === 'CHECK' || h === 'ĐIỂM DANH' || h === 'TRẠNG THÁI') checkCol = i + 1;
  }

  // Nếu ô tiêu đề cột E chưa có chữ, tự đặt là CHECK
  if (!headers[checkCol - 1] || String(headers[checkCol - 1]).trim() === '') {
    sheet.getRange(1, checkCol).setValue('CHECK').setFontWeight('bold');
  }

  return { idCol: idCol, storeCol: storeCol, bossCol: bossCol, dateCol: dateCol, checkCol: checkCol };
}

// Menu: Chèn Checkbox vào Cột E
function menuInsertCheckboxes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var cols = getColumnMap(sheet);
    var range = sheet.getRange(2, cols.checkCol, lastRow - 1, 1);
    range.insertCheckboxes();
    SpreadsheetApp.flush();
    ss.toast('Đã chèn ô Checkbox cho CỘT E thành công!', 'Thành công');
  }
}

// Menu: Check tất cả Cột E
function menuCheckAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var cols = getColumnMap(sheet);
    sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValue(true);
    SpreadsheetApp.flush();
    ss.toast('Đã đánh dấu ĐÃ CHECK cho toàn bộ Cột E!', 'Thành công');
  }
}

// Menu: Bỏ check tất cả Cột E
function menuUncheckAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var cols = getColumnMap(sheet);
    sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValue(false);
    SpreadsheetApp.flush();
    ss.toast('Đã bỏ check toàn bộ Cột E!', 'Thành công');
  }
}

// Menu: Lấy danh sách tag @MãNV của các Boss chưa check ở Cột E
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

// Menu: Lưu lịch sử hôm nay vào sheet LichSu_DiemDanh
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
// 2. API WEB APP (ĐỒNG BỘ 2 CHIỀU VỚI WEBSITE GITHUB PAGES)
// ==============================================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getAll';

    // 1. CẬP NHẬT CHECK / BỎ CHECK VÀO CỘT E NGAY LẬP TỨC
    if (action === 'updateCheck') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true || params.isChecked === '1';
      var bossName = params.boss || params.name || '';
      var row = parseInt(params.row, 10);
      var rowsStr = params.rows || '';

      updateCheckInColumnE(ss, bossName, isChecked, row, rowsStr);
      return createJsonResponse({ status: 'success', message: 'Checked into column E immediately' });
    }

    // 2. CHECK TẤT CẢ CỘT E
    if (action === 'checkAll') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true || params.isChecked === '1';
      checkAllInColumnE(ss, isChecked);
      return createJsonResponse({ status: 'success', message: 'All column E updated' });
    }

    // 3. ĐỌC DỮ LIỆU ĐIỂM DANH TỪ CỘT E
    var sheetData = readSheetData(ss);
    return createJsonResponse({
      status: 'success',
      date: getTodayString(),
      bossList: sheetData.bossList,
      stores: sheetData.stores,
      attendance: sheetData.attendance
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
      data = JSON.parse(e.postData.contents);
    }
    var action = data.action;

    if (action === 'updateCheck') {
      var isChecked = Boolean(data.isChecked);
      var bossName = data.boss || data.name || '';
      var row = parseInt(data.row, 10);
      var rowsStr = data.rows || '';

      updateCheckInColumnE(ss, bossName, isChecked, row, rowsStr);
      return createJsonResponse({ status: 'success', message: 'Checked into column E' });
    }

    if (action === 'checkAll') {
      checkAllInColumnE(ss, Boolean(data.isChecked));
      return createJsonResponse({ status: 'success', message: 'All column E updated' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ==============================================================================
// 3. CÁC HÀM XỬ LÝ TRỰC TIẾP CỘT E
// ==============================================================================

function updateCheckInColumnE(ss, bossName, isChecked, rowNumber, rowsStr) {
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var cols = getColumnMap(sheet);
  var targetVal = Boolean(isChecked);

  // Cách 1: Cập nhật theo tên Boss (Tất cả hàng của Boss này ở Cột E đều được tick!)
  if (bossName) {
    var targetBoss = String(bossName).trim().toLowerCase();
    var bossValues = sheet.getRange(2, cols.bossCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < bossValues.length; i++) {
      var currentBoss = String(bossValues[i][0] || '').trim().toLowerCase();
      if (currentBoss === targetBoss) {
        sheet.getRange(i + 2, cols.checkCol).setValue(targetVal);
      }
    }
  }
  // Cách 2: Cập nhật theo danh sách hàng (rows)
  else if (rowsStr) {
    var rowsArr = String(rowsStr).split(',');
    for (var r = 0; r < rowsArr.length; r++) {
      var rNum = parseInt(rowsArr[r], 10);
      if (rNum >= 2 && rNum <= lastRow) {
        sheet.getRange(rNum, cols.checkCol).setValue(targetVal);
      }
    }
  }
  // Cách 3: Cập nhật theo dòng đơn lẻ
  else if (rowNumber && rowNumber >= 2 && rowNumber <= lastRow) {
    sheet.getRange(rowNumber, cols.checkCol).setValue(targetVal);
  }

  SpreadsheetApp.flush(); // Ép ghi ngay lập tức vào Google Sheet
}

function checkAllInColumnE(ss, isChecked) {
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var cols = getColumnMap(sheet);
  sheet.getRange(2, cols.checkCol, lastRow - 1, 1).setValue(Boolean(isChecked));
  SpreadsheetApp.flush();
}

function readSheetData(ss) {
  var sheet = getTargetSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { bossList: [], stores: [], attendance: {} };
  }

  var cols = getColumnMap(sheet);
  var maxCol = Math.max(cols.idCol, cols.storeCol, cols.bossCol, cols.dateCol, cols.checkCol);
  var data = sheet.getRange(1, 1, lastRow, maxCol).getValues();

  var bossMap = {};
  var bossList = [];
  var stores = [];
  var attendance = {};

  for (var i = 1; i < data.length; i++) {
    var rowNum = i + 1;
    var stId = String(data[i][cols.idCol - 1] || ('st-' + i)).trim();
    var stName = String(data[i][cols.storeCol - 1] || '').trim();
    var bossName = String(data[i][cols.bossCol - 1] || '').trim();
    var isChecked = isCellChecked(data[i][cols.checkCol - 1]);

    if (bossName) {
      // Lưu danh sách siêu thị (nếu cần tương thích)
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

      // Gom nhóm Boss duy nhất
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
