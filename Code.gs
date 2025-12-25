/**
 * 카페 도장 쿠폰 시스템 - Google Apps Script
 *
 * 이 코드를 Google Apps Script에 복사하여 사용하세요.
 * 설정 방법은 구현설명서.md를 참고해주세요.
 */

// ============================================
// 설정
// ============================================
const SETTINGS = {
  // 직원 인증 코드 (4자리 숫자)
  STAFF_CODE: '1234',
  // 쿠폰 발급 기준 도장 수
  STAMPS_PER_COUPON: 10,
  // 시트 이름
  SHEET_NAME: '고객목록'
};

// ============================================
// 웹 앱 엔트리 포인트
// ============================================

/**
 * GET 요청 처리 (CORS preflight 등)
 */
function doGet(e) {
  return createResponse({ success: true, message: 'API is running' });
}

/**
 * POST 요청 처리 (메인 API)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;

    switch (action) {
      case 'login':
        result = handleLogin(data.name, data.phone);
        break;
      case 'getUser':
        result = handleGetUser(data.phone);
        break;
      case 'addStamp':
        result = handleAddStamp(data.phone, data.count);
        break;
      case 'useCoupon':
        result = handleUseCoupon(data.phone, data.count);
        break;
      default:
        result = { success: false, message: '알 수 없는 요청입니다' };
    }

    return createResponse(result);

  } catch (error) {
    console.error('Error:', error);
    return createResponse({ success: false, message: '서버 오류가 발생했습니다: ' + error.message });
  }
}

/**
 * JSON 응답 생성 (CORS 헤더 포함)
 */
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 스프레드시트 유틸리티
// ============================================

/**
 * 스프레드시트 및 시트 가져오기
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS.SHEET_NAME);

  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS.SHEET_NAME);
    // 헤더 추가
    sheet.getRange(1, 1, 1, 6).setValues([['이름', '휴대폰번호', '총도장수', '쿠폰수', '등록일', '최근방문일']]);
    // 헤더 스타일 설정
    sheet.getRange(1, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#a7dbee');
    // 열 너비 조정
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 130);
    sheet.setColumnWidth(3, 80);
    sheet.setColumnWidth(4, 80);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 120);
  }

  return sheet;
}

/**
 * 휴대폰 번호로 사용자 행 찾기
 */
function findUserRow(sheet, phone) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === phone) {
      return i + 1; // 1-indexed row number
    }
  }
  return -1;
}

/**
 * 현재 시간 포맷
 */
function formatDate(date) {
  return Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
}

// ============================================
// API 핸들러
// ============================================

/**
 * 로그인 처리 (신규 사용자면 자동 등록)
 */
function handleLogin(name, phone) {
  const sheet = getSheet();
  const rowIndex = findUserRow(sheet, phone);
  const now = new Date();

  if (rowIndex === -1) {
    // 신규 사용자 등록
    const newRow = [name, phone, 0, 0, formatDate(now), formatDate(now)];
    sheet.appendRow(newRow);

    return {
      success: true,
      name: name,
      phone: phone,
      stamps: 0,
      coupons: 0,
      isNew: true
    };
  } else {
    // 기존 사용자 정보 반환
    const userData = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];

    // 최근 방문일 업데이트
    sheet.getRange(rowIndex, 6).setValue(formatDate(now));

    return {
      success: true,
      name: userData[0],
      phone: userData[1],
      stamps: userData[2],
      coupons: userData[3],
      isNew: false
    };
  }
}

/**
 * 사용자 정보 조회
 */
function handleGetUser(phone) {
  const sheet = getSheet();
  const rowIndex = findUserRow(sheet, phone);

  if (rowIndex === -1) {
    return { success: false, message: '사용자를 찾을 수 없습니다' };
  }

  const userData = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];

  return {
    success: true,
    name: userData[0],
    phone: userData[1],
    stamps: userData[2],
    coupons: userData[3]
  };
}

/**
 * 도장 추가
 */
function handleAddStamp(phone, count) {
  const sheet = getSheet();
  const rowIndex = findUserRow(sheet, phone);

  if (rowIndex === -1) {
    return { success: false, message: '사용자를 찾을 수 없습니다' };
  }

  // 현재 도장 및 쿠폰 수 가져오기
  const currentStamps = sheet.getRange(rowIndex, 3).getValue();
  const currentCoupons = sheet.getRange(rowIndex, 4).getValue();

  // 새 도장 수 계산
  const newStamps = currentStamps + count;

  // 새로 발급되는 쿠폰 수 계산
  const oldCouponEarned = Math.floor(currentStamps / SETTINGS.STAMPS_PER_COUPON);
  const newCouponEarned = Math.floor(newStamps / SETTINGS.STAMPS_PER_COUPON);
  const newCoupons = newCouponEarned - oldCouponEarned;

  // 업데이트
  sheet.getRange(rowIndex, 3).setValue(newStamps);
  sheet.getRange(rowIndex, 4).setValue(currentCoupons + newCoupons);
  sheet.getRange(rowIndex, 6).setValue(formatDate(new Date()));

  // 이력 기록 (선택사항)
  logActivity(phone, 'stamp', count, newStamps);

  return {
    success: true,
    stamps: newStamps,
    coupons: currentCoupons + newCoupons,
    newCoupons: newCoupons
  };
}

/**
 * 쿠폰 사용
 */
function handleUseCoupon(phone, count) {
  const sheet = getSheet();
  const rowIndex = findUserRow(sheet, phone);

  if (rowIndex === -1) {
    return { success: false, message: '사용자를 찾을 수 없습니다' };
  }

  const currentCoupons = sheet.getRange(rowIndex, 4).getValue();

  if (currentCoupons < count) {
    return { success: false, message: '쿠폰이 부족합니다' };
  }

  const newCoupons = currentCoupons - count;
  sheet.getRange(rowIndex, 4).setValue(newCoupons);
  sheet.getRange(rowIndex, 6).setValue(formatDate(new Date()));

  // 이력 기록 (선택사항)
  logActivity(phone, 'coupon', -count, newCoupons);

  return {
    success: true,
    coupons: newCoupons
  };
}

// ============================================
// 활동 이력 기록 (선택사항)
// ============================================

/**
 * 활동 이력을 별도 시트에 기록
 */
function logActivity(phone, type, amount, balance) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('활동이력');

  if (!logSheet) {
    logSheet = ss.insertSheet('활동이력');
    logSheet.getRange(1, 1, 1, 5).setValues([['일시', '휴대폰번호', '유형', '변동', '잔액']]);
    logSheet.getRange(1, 1, 1, 5)
      .setFontWeight('bold')
      .setBackground('#95c96a');
  }

  const typeText = type === 'stamp' ? '도장적립' : '쿠폰사용';
  const amountText = amount > 0 ? '+' + amount : amount.toString();

  logSheet.appendRow([formatDate(new Date()), phone, typeText, amountText, balance]);
}

// ============================================
// 유틸리티 함수 (관리자용)
// ============================================

/**
 * 모든 고객 목록 조회 (Apps Script 내에서 직접 실행 가능)
 */
function getAllCustomers() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  console.log(data);
  return data;
}

/**
 * 특정 고객 도장 초기화 (관리자용)
 */
function resetCustomerStamps(phone) {
  const sheet = getSheet();
  const rowIndex = findUserRow(sheet, phone);

  if (rowIndex === -1) {
    console.log('사용자를 찾을 수 없습니다:', phone);
    return false;
  }

  sheet.getRange(rowIndex, 3).setValue(0);
  console.log('도장이 초기화되었습니다:', phone);
  return true;
}

/**
 * 테스트용: 스프레드시트 초기화 및 샘플 데이터 추가
 */
function initializeWithSampleData() {
  const sheet = getSheet();

  // 샘플 데이터 추가
  const sampleData = [
    ['홍길동', '010-1234-5678', 5, 0, formatDate(new Date()), formatDate(new Date())],
    ['김철수', '010-9876-5432', 12, 1, formatDate(new Date()), formatDate(new Date())]
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, sampleData.length, 6).setValues(sampleData);

  console.log('샘플 데이터가 추가되었습니다.');
}
