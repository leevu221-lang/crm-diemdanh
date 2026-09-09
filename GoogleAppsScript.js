/**
 * ==============================================================================
 * MÃ NGUỒN GOOGLE APPS SCRIPT CHO HỆ THỐNG ĐIỂM DANH SIÊU THỊ & BOSS
 * (Hỗ trợ cả GET và POST để đảm bảo hoạt động mượt mà 100% trên mọi trình duyệt)
 * ==============================================================================
 */

// Danh sách 24 siêu thị gốc ban đầu
var DEFAULT_STORES = [
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

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNotExist(ss);

    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'get';
    var date = params.date || getTodayString();

    if (action === 'updateCheck') {
      var storeId = params.storeId;
      var isChecked = params.isChecked === 'true' || params.isChecked === true;
      updateSingleCheck(ss, date, storeId, isChecked);
      return createJsonResponse({ status: 'success', message: 'Updated' });
    } 
    else if (action === 'checkAll') {
      var isChecked = params.isChecked === 'true' || params.isChecked === true;
      updateCheckAll(ss, date, isChecked);
      return createJsonResponse({ status: 'success', message: 'CheckAll completed' });
    }
    else if (action === 'addStore') {
      var newStore = addStoreToSheet(ss, params.name, params.boss);
      return createJsonResponse({ status: 'success', store: newStore });
    }
    else if (action === 'deleteStore') {
      deleteStoreFromSheet(ss, params.storeId);
      return createJsonResponse({ status: 'success', message: 'Deleted' });
    }
    else if (action === 'resetStores') {
      resetStoresSheet(ss);
      return createJsonResponse({ status: 'success', message: 'Reset completed' });
    }

    // Mặc định: Lấy danh sách siêu thị và trạng thái điểm danh
    var stores = getStoresFromSheet(ss);
    var attendance = getAttendanceFromSheet(ss, date);

    return createJsonResponse({
      status: 'success',
      date: date,
      stores: stores,
      attendance: attendance
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNotExist(ss);

    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    var action = data.action;

    if (action === 'updateCheck') {
      updateSingleCheck(ss, data.date, data.storeId, data.isChecked);
      return createJsonResponse({ status: 'success', message: 'Updated' });
    } 
    else if (action === 'checkAll') {
      updateCheckAll(ss, data.date, data.isChecked);
      return createJsonResponse({ status: 'success', message: 'CheckAll completed' });
    }
    else if (action === 'addStore') {
      var newStore = addStoreToSheet(ss, data.name, data.boss);
      return createJsonResponse({ status: 'success', store: newStore });
    }
    else if (action === 'deleteStore') {
      deleteStoreFromSheet(ss, data.storeId);
      return createJsonResponse({ status: 'success', message: 'Deleted' });
    }
    else if (action === 'resetStores') {
      resetStoresSheet(ss);
      return createJsonResponse({ status: 'success', message: 'Reset completed' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
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

function initSheetsIfNotExist(ss) {
  var storeSheet = ss.getSheetByName('DanhSach_SieuThi');
  if (!storeSheet) {
    storeSheet = ss.insertSheet('DanhSach_SieuThi');
    storeSheet.appendRow(['ID', 'SIÊU THỊ', 'BOSS', 'NGÀY TẠO']);
    storeSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#e0e7ff');

    DEFAULT_STORES.forEach(function(st) {
      storeSheet.appendRow([st.id, st.name, st.boss, new Date()]);
    });
  }

  var attSheet = ss.getSheetByName('LichSu_DiemDanh');
  if (!attSheet) {
    attSheet = ss.insertSheet('LichSu_DiemDanh');
    attSheet.appendRow(['NGÀY', 'ID SIÊU THỊ', 'SIÊU THỊ', 'BOSS', 'TRẠNG THÁI', 'THỜI GIAN']);
    attSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#ecfdf5');
  }
}

function getStoresFromSheet(ss) {
  var sheet = ss.getSheetByName('DanhSach_SieuThi');
  var data = sheet.getDataRange().getValues();
  var stores = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      stores.push({
        id: String(data[i][0]),
        name: String(data[i][1]),
        boss: String(data[i][2])
      });
    }
  }
  return stores;
}

function getAttendanceFromSheet(ss, dateStr) {
  var sheet = ss.getSheetByName('LichSu_DiemDanh');
  var data = sheet.getDataRange().getValues();
  var attendance = {};

  for (var i = 1; i < data.length; i++) {
    var rowDate = String(data[i][0]);
    if (rowDate === dateStr) {
      var storeId = String(data[i][1]);
      var isChecked = String(data[i][4]) === 'ĐÃ ĐIỂM DANH';
      attendance[storeId] = isChecked;
    }
  }
  return attendance;
}

function updateSingleCheck(ss, dateStr, storeId, isChecked) {
  var sheet = ss.getSheetByName('LichSu_DiemDanh');
  var data = sheet.getDataRange().getValues();
  var statusText = isChecked ? 'ĐÃ ĐIỂM DANH' : 'CHƯA ĐIỂM DANH';
  var found = false;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === dateStr && String(data[i][1]) === storeId) {
      sheet.getRange(i + 1, 5).setValue(statusText);
      sheet.getRange(i + 1, 6).setValue(new Date());
      found = true;
      break;
    }
  }

  if (!found) {
    var stores = getStoresFromSheet(ss);
    var store = stores.filter(function(s) { return s.id === storeId; })[0];
    var storeName = store ? store.name : '';
    var storeBoss = store ? store.boss : '';
    sheet.appendRow([dateStr, storeId, storeName, storeBoss, statusText, new Date()]);
  }
}

function updateCheckAll(ss, dateStr, isChecked) {
  var stores = getStoresFromSheet(ss);
  stores.forEach(function(st) {
    updateSingleCheck(ss, dateStr, st.id, isChecked);
  });
}

function addStoreToSheet(ss, name, boss) {
  var sheet = ss.getSheetByName('DanhSach_SieuThi');
  var newId = 'st-' + Date.now();
  sheet.appendRow([newId, name, boss, new Date()]);
  return { id: newId, name: name, boss: boss };
}

function deleteStoreFromSheet(ss, storeId) {
  var sheet = ss.getSheetByName('DanhSach_SieuThi');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === storeId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function resetStoresSheet(ss) {
  var sheet = ss.getSheetByName('DanhSach_SieuThi');
  sheet.clear();
  sheet.appendRow(['ID', 'SIÊU THỊ', 'BOSS', 'NGÀY TẠO']);
  sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#e0e7ff');

  DEFAULT_STORES.forEach(function(st) {
    sheet.appendRow([st.id, st.name, st.boss, new Date()]);
  });
}
