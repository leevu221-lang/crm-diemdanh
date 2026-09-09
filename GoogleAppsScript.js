/**
 * ==============================================================================
 * MÃ NGUỒN GOOGLE APPS SCRIPT CHO HỆ THỐNG ĐIỂM DANH: "BOSS" & "NHÂN VIÊN"
 * ==============================================================================
 * 
 * Script này phục vụ 2 mục đích:
 * 1. Chạy trực tiếp trong Google Sheets (Menu "📋 ĐIỂM DANH" có tính năng lấy tag Zalo, tick checkbox...)
 * 2. Cung cấp API Web App để trang web GitHub Pages đồng bộ 2 chiều thời gian thực!
 * 
 * HƯỚNG DẪN CẬP NHẬT TRÊN GOOGLE APPS SCRIPT:
 * 1. Mở file Google Sheet của bạn (đang có 2 trang "BOSS" và "NHÂN VIÊN").
 * 2. Vào: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xoá toàn bộ code cũ trong file Code.gs và DÁN TOÀN BỘ CODE NÀY VÀO.
 * 4. Nhấn biểu tượng Đĩa mềm 💾 (Lưu).
 * 5. Nhấn "Triển khai" (Deploy) -> "Quản lý bản triển khai" (Manage deployments) ->
 *    Chọn phiên bản đang có -> Bấm biểu tượng Bút chì ✏️ -> Ở mục "Phiên bản" chọn "Phiên bản mới" (New version) -> Bấm "Triển khai".
 * ==============================================================================
 */

// Tên 2 trang tính chuẩn trong Google Sheet của bạn
var SHEET_NAMES = {
  BOSS: 'BOSS',
  STAFF: 'NHÂN VIÊN'
};

// ==============================================================================
// 1. MENU CHẠY TRỰC TIẾP TRONG GOOGLE SHEETS
// ==============================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 ĐIỂM DANH')
    .addItem('📢 Lấy Tag người CHƯA CHECK (Dán Zalo)', 'menuCopyUncheckedTags')
    .addSeparator()
    .addItem('✅ Check TẤT CẢ trang hiện tại', 'menuCheckAll')
    .addItem('🔄 Bỏ check TẤT CẢ trang hiện tại', 'menuUncheckAll')
    .addSeparator()
    .addItem('☑️ Chèn ô Checkbox cho cột CHECK', 'menuInsertCheckboxes')
    .addItem('💾 Lưu vào Lịch Sử Điểm Danh', 'menuSaveDailyHistory')
    .addToUi();
}

// Menu: Lấy danh sách tag @MãNV của những người chưa check
function menuCopyUncheckedTags() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var sheetName = sheet.getName();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('Trang tính hiện tại chưa có dữ liệu!');
    return;
  }

  var tags = [];
  for (var i = 1; i < data.length; i++) {
    var nameStr = String(data[i][1] || '').trim();
    var isChecked = isCellChecked(data[i][2]);

    if (nameStr && !isChecked) {
      tags.push(extractTag(nameStr));
    }
  }

  var ui = SpreadsheetApp.getUi();
  if (tags.length === 0) {
    ui.alert('🎉 Tuyệt vời! Tất cả mọi người trong trang "' + sheetName + '" đều ĐÃ ĐIỂM DANH.');
  } else {
    var tagString = tags.join(' ');
    var htmlOutput = HtmlService.createHtmlOutput(
      '<div style="font-family: sans-serif; padding: 10px;">' +
      '<p>Tìm thấy <b>' + tags.length + '</b> người chưa điểm danh trong trang <b>' + sheetName + '</b>:</p>' +
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
    ui.showModalDialog(htmlOutput, '📢 Danh Sách Tag Nhắc Nhở Zalo');
  }
}

// Menu: Check tất cả trang hiện tại
function menuCheckAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 3, lastRow - 1, 1).setValue(true);
    SpreadsheetApp.getActiveSpreadsheet().toast('Đã đánh dấu tất cả thành ĐÃ CHECK!', 'Thành công');
  }
}

// Menu: Bỏ check tất cả trang hiện tại
function menuUncheckAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 3, lastRow - 1, 1).setValue(false);
    SpreadsheetApp.getActiveSpreadsheet().toast('Đã đặt lại trạng thái CHƯA CHECK!', 'Thành công');
  }
}

// Menu: Chèn ô checkbox cột C
function menuInsertCheckboxes() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var range = sheet.getRange(2, 3, lastRow - 1, 1);
    range.insertCheckboxes();
    SpreadsheetApp.getActiveSpreadsheet().toast('Đã chèn hộp kiểm Checkbox cho cột CHECK!', 'Thành công');
  }
}

// Menu: Lưu lịch sử hôm nay
function menuSaveDailyHistory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = getTodayString();
  var historySheet = ss.getSheetByName('LichSu_DiemDanh');
  if (!historySheet) {
    historySheet = ss.insertSheet('LichSu_DiemDanh');
    historySheet.appendRow(['NGÀY', 'LOẠI', 'STT', 'HỌ TÊN', 'TRẠNG THÁI', 'THỜI GIAN LƯU']);
    historySheet.getRange('A1:F1').setFontWeight('bold').setBackground('#ecfdf5');
  }

  [SHEET_NAMES.BOSS, SHEET_NAMES.STAFF].forEach(function(sName) {
    var sheet = getSheetByNameFlexible(ss, sName);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1]) {
        var isChecked = isCellChecked(data[i][2]);
        historySheet.appendRow([
          today,
          sName,
          data[i][0] || i,
          data[i][1],
          isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH',
          new Date()
        ]);
      }
    }
  });

  SpreadsheetApp.getUi().alert('Đã lưu dữ liệu điểm danh ngày ' + today + ' vào trang "LichSu_DiemDanh" thành công!');
}

// ==============================================================================
// 2. API WEB APP (DÀNH CHO TRANG WEB GITHUB PAGES)
// ==============================================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'getAll';
    var targetSheet = params.sheet || SHEET_NAMES.STAFF; // 'BOSS' hoặc 'NHÂN VIÊN'

    // Xử lý cập nhật 1 người (Check / Bỏ check)
    if (action === 'updateCheck') {
      var row = parseInt(params.row, 10);
      var isChecked = params.isChecked === 'true' || params.isChecked === true;
      updateCheckInSheet(ss, targetSheet, row, isChecked);
      return createJsonResponse({ status: 'success', message: 'Updated check' });
    }

    // Check tất cả
    if (action === 'checkAll') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true;
      checkAllInSheet(ss, targetSheet, isChecked);
      return createJsonResponse({ status: 'success', message: 'Check all updated' });
    }

    // Thêm người mới
    if (action === 'addMember') {
      var newRow = addMemberToSheet(ss, targetSheet, params.name);
      return createJsonResponse({ status: 'success', row: newRow });
    }

    // Xoá người
    if (action === 'deleteMember') {
      var row = parseInt(params.row, 10);
      deleteMemberFromSheet(ss, targetSheet, row);
      return createJsonResponse({ status: 'success', message: 'Deleted' });
    }

    // Mặc định: Trả về dữ liệu của CẢ 2 TRANG "BOSS" VÀ "NHÂN VIÊN"
    var bossList = readSheetData(ss, SHEET_NAMES.BOSS);
    var staffList = readSheetData(ss, SHEET_NAMES.STAFF);

    return createJsonResponse({
      status: 'success',
      date: getTodayString(),
      bossList: bossList,
      staffList: staffList
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
    var targetSheet = data.sheet || SHEET_NAMES.STAFF;

    if (action === 'updateCheck') {
      updateCheckInSheet(ss, targetSheet, parseInt(data.row, 10), data.isChecked);
      return createJsonResponse({ status: 'success', message: 'Updated' });
    }
    if (action === 'checkAll') {
      checkAllInSheet(ss, targetSheet, data.isChecked);
      return createJsonResponse({ status: 'success', message: 'Check all updated' });
    }
    if (action === 'addMember') {
      var newRow = addMemberToSheet(ss, targetSheet, data.name);
      return createJsonResponse({ status: 'success', row: newRow });
    }
    if (action === 'deleteMember') {
      deleteMemberFromSheet(ss, targetSheet, parseInt(data.row, 10));
      return createJsonResponse({ status: 'success', message: 'Deleted' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ==============================================================================
// 3. CÁC HÀM XỬ LÝ DỮ LIỆU GOOGLE SHEETS
// ==============================================================================

function getSheetByNameFlexible(ss, name) {
  var sheets = ss.getSheets();
  var normalizedTarget = name.toLowerCase().trim();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().toLowerCase().trim();
    if (sName === normalizedTarget) {
      return sheets[i];
    }
  }
  // Nếu chưa có, tạo mới
  return ss.insertSheet(name);
}

function readSheetData(ss, sheetName) {
  var sheet = getSheetByNameFlexible(ss, sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(1, 1, lastRow, 3).getValues();
  var list = [];

  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][1] || '').trim();
    if (name) {
      var isChecked = isCellChecked(data[i][2]);
      list.push({
        row: i + 1, // Dòng thực tế trên Sheet
        stt: data[i][0] || i,
        name: name,
        isChecked: isChecked,
        tag: extractTag(name)
      });
    }
  }
  return list;
}

function updateCheckInSheet(ss, sheetName, rowNumber, isChecked) {
  var sheet = getSheetByNameFlexible(ss, sheetName);
  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.getRange(rowNumber, 3).setValue(Boolean(isChecked));
  }
}

function checkAllInSheet(ss, sheetName, isChecked) {
  var sheet = getSheetByNameFlexible(ss, sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 3, lastRow - 1, 1).setValue(Boolean(isChecked));
  }
}

function addMemberToSheet(ss, sheetName, name) {
  var sheet = getSheetByNameFlexible(ss, sheetName);
  var lastRow = sheet.getLastRow();
  var nextStt = lastRow >= 2 ? lastRow : 1;
  sheet.appendRow([nextStt, name, false]);
  var newRow = sheet.getLastRow();
  sheet.getRange(newRow, 3).insertCheckboxes();
  return { row: newRow, stt: nextStt, name: name, isChecked: false, tag: extractTag(name) };
}

function deleteMemberFromSheet(ss, sheetName, rowNumber) {
  var sheet = getSheetByNameFlexible(ss, sheetName);
  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
  }
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
  if (numMatch) {
    return '@' + numMatch[0];
  }
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
