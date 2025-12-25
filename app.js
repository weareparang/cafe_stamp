// ============================================
// 설정 (배포 후 아래 URL을 실제 Apps Script URL로 변경하세요)
// ============================================
const CONFIG = {
    // Google Apps Script 웹 앱 URL (배포 후 여기에 실제 URL을 입력하세요)
    API_URL: 'https://script.google.com/macros/s/AKfycby7gCBJXIK4UeP3AvyEqDvBqVUDeN1sjm1N3dGBtUCnuv48j2QOzlxtU9hZoN4h5Zxh/exec',
    // 직원 인증 코드 (4자리 숫자)
    STAFF_CODE: '0426',
    // 쿠폰 발급 기준 도장 수
    STAMPS_PER_COUPON: 10
};

// ============================================
// 상태 관리
// ============================================
let currentUser = null;

// ============================================
// DOM 요소
// ============================================
const elements = {
    // 페이지
    loginPage: document.getElementById('login-page'),
    mainPage: document.getElementById('main-page'),

    // 로그인 폼
    nameInput: document.getElementById('name'),
    phoneInput: document.getElementById('phone'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),

    // 사용자 정보 표시
    userName: document.getElementById('user-name'),
    stampGrid: document.getElementById('stamp-grid'),
    currentStamps: document.getElementById('current-stamps'),
    couponCount: document.getElementById('coupon-count'),

    // 버튼
    useCouponBtn: document.getElementById('use-coupon-btn'),
    addStampBtn: document.getElementById('add-stamp-btn'),

    // 모달
    stampModal: document.getElementById('stamp-modal'),
    couponModal: document.getElementById('coupon-modal'),

    // 수량 선택
    stampQty: document.getElementById('stamp-qty'),
    couponQty: document.getElementById('coupon-qty'),

    // 인증 코드
    staffCodeStamp: document.getElementById('staff-code-stamp'),
    staffCodeCoupon: document.getElementById('staff-code-coupon'),

    // 확인 버튼
    confirmStampBtn: document.getElementById('confirm-stamp-btn'),
    confirmCouponBtn: document.getElementById('confirm-coupon-btn'),

    // 유틸리티
    toast: document.getElementById('toast'),
    loading: document.getElementById('loading')
};

// ============================================
// 초기화
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // 도장 그리드 생성
    createStampGrid();

    // 이벤트 리스너 설정
    setupEventListeners();

    // 휴대폰 번호 자동 포맷
    elements.phoneInput.addEventListener('input', formatPhoneNumber);

    // 로컬 스토리지에서 사용자 정보 복원
    restoreSession();
}

function createStampGrid() {
    elements.stampGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const stamp = document.createElement('div');
        stamp.className = 'stamp-item';
        stamp.dataset.index = i;
        elements.stampGrid.appendChild(stamp);
    }
}

function setupEventListeners() {
    // 로그인/로그아웃
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);

    // Enter 키로 로그인
    elements.phoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // 모달 열기
    elements.addStampBtn.addEventListener('click', () => openModal('stamp-modal'));
    elements.useCouponBtn.addEventListener('click', () => openModal('coupon-modal'));

    // 모달 닫기
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.modal);
        });
    });

    // 모달 바깥 클릭시 닫기
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // 수량 조절 버튼
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', handleQuantityChange);
    });

    // 확인 버튼
    elements.confirmStampBtn.addEventListener('click', handleAddStamp);
    elements.confirmCouponBtn.addEventListener('click', handleUseCoupon);
}

// ============================================
// 휴대폰 번호 포맷
// ============================================
function formatPhoneNumber(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');

    if (value.length > 11) {
        value = value.slice(0, 11);
    }

    if (value.length > 7) {
        value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
    } else if (value.length > 3) {
        value = value.slice(0, 3) + '-' + value.slice(3);
    }

    e.target.value = value;
}

// ============================================
// 세션 관리
// ============================================
function restoreSession() {
    const savedUser = localStorage.getItem('stampCouponUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            currentUser = user;
            showMainPage();
            refreshUserData();
        } catch (e) {
            localStorage.removeItem('stampCouponUser');
        }
    }
}

function saveSession() {
    if (currentUser) {
        localStorage.setItem('stampCouponUser', JSON.stringify(currentUser));
    }
}

function clearSession() {
    localStorage.removeItem('stampCouponUser');
    currentUser = null;
}

// ============================================
// 로그인/로그아웃
// ============================================
async function handleLogin() {
    const name = elements.nameInput.value.trim();
    const phone = elements.phoneInput.value.trim();

    if (!name) {
        showToast('이름을 입력해주세요', 'error');
        elements.nameInput.focus();
        return;
    }

    if (!validatePhone(phone)) {
        showToast('올바른 휴대폰 번호를 입력해주세요', 'error');
        elements.phoneInput.focus();
        return;
    }

    showLoading(true);

    try {
        const response = await apiCall('login', { name, phone });

        if (response.success) {
            currentUser = {
                name: response.name,
                phone: response.phone,
                stamps: response.stamps,
                coupons: response.coupons
            };

            saveSession();
            showMainPage();
            updateDisplay();
            showToast(`환영합니다, ${currentUser.name}님!`, 'success');
        } else {
            showToast(response.message || '로그인에 실패했습니다', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('서버 연결에 실패했습니다', 'error');
    } finally {
        showLoading(false);
    }
}

function handleLogout() {
    clearSession();
    showLoginPage();
    elements.nameInput.value = '';
    elements.phoneInput.value = '';
    showToast('로그아웃 되었습니다');
}

function validatePhone(phone) {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    return phoneRegex.test(phone);
}

// ============================================
// 페이지 전환
// ============================================
function showLoginPage() {
    elements.loginPage.classList.add('active');
    elements.mainPage.classList.remove('active');
}

function showMainPage() {
    elements.loginPage.classList.remove('active');
    elements.mainPage.classList.add('active');
    updateDisplay();
}

// ============================================
// 화면 업데이트
// ============================================
function updateDisplay() {
    if (!currentUser) return;

    // 이름 표시
    elements.userName.textContent = currentUser.name;

    // 도장 표시 (10개 기준 나머지)
    const displayStamps = currentUser.stamps % CONFIG.STAMPS_PER_COUPON;
    elements.currentStamps.textContent = displayStamps;

    // 도장 그리드 업데이트
    const stampItems = elements.stampGrid.querySelectorAll('.stamp-item');
    stampItems.forEach((stamp, index) => {
        if (index < displayStamps) {
            stamp.classList.add('filled');
        } else {
            stamp.classList.remove('filled');
        }
    });

    // 쿠폰 수 표시
    elements.couponCount.textContent = currentUser.coupons;

    // 쿠폰 사용 버튼 상태
    elements.useCouponBtn.disabled = currentUser.coupons < 1;
}

async function refreshUserData() {
    if (!currentUser) return;

    try {
        const response = await apiCall('getUser', { phone: currentUser.phone });

        if (response.success) {
            currentUser.stamps = response.stamps;
            currentUser.coupons = response.coupons;
            saveSession();
            updateDisplay();
        }
    } catch (error) {
        console.error('Refresh error:', error);
    }
}

// ============================================
// 모달 관리
// ============================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');

    // 수량 초기화
    if (modalId === 'stamp-modal') {
        elements.stampQty.textContent = '1';
        elements.staffCodeStamp.value = '';
    } else if (modalId === 'coupon-modal') {
        elements.couponQty.textContent = '1';
        elements.staffCodeCoupon.value = '';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

// ============================================
// 수량 조절
// ============================================
function handleQuantityChange(e) {
    const btn = e.currentTarget;
    const targetId = btn.dataset.target;
    const qtyElement = document.getElementById(targetId);
    let currentQty = parseInt(qtyElement.textContent);

    const isStamp = targetId === 'stamp-qty';
    const maxQty = isStamp ? 10 : currentUser.coupons;
    const minQty = 1;

    if (btn.classList.contains('plus')) {
        if (currentQty < maxQty) {
            currentQty++;
        }
    } else if (btn.classList.contains('minus')) {
        if (currentQty > minQty) {
            currentQty--;
        }
    }

    qtyElement.textContent = currentQty;
}

// ============================================
// 도장 찍기
// ============================================
async function handleAddStamp() {
    const qty = parseInt(elements.stampQty.textContent);
    const code = elements.staffCodeStamp.value;

    if (code !== CONFIG.STAFF_CODE) {
        showToast('인증 코드가 올바르지 않습니다', 'error');
        return;
    }

    showLoading(true);
    closeModal('stamp-modal');

    try {
        const response = await apiCall('addStamp', {
            phone: currentUser.phone,
            count: qty
        });

        if (response.success) {
            const oldStamps = currentUser.stamps;
            currentUser.stamps = response.stamps;
            currentUser.coupons = response.coupons;
            saveSession();

            // 애니메이션 효과로 도장 추가
            animateStampAddition(oldStamps, currentUser.stamps);

            // 새 쿠폰 발급 알림
            const newCoupons = response.newCoupons || 0;
            if (newCoupons > 0) {
                setTimeout(() => {
                    showToast(`축하합니다! 무료 음료 쿠폰 ${newCoupons}장이 발급되었습니다!`, 'success');
                }, 1000);
            } else {
                showToast(`도장 ${qty}개가 찍혔습니다!`, 'success');
            }
        } else {
            showToast(response.message || '도장 찍기에 실패했습니다', 'error');
        }
    } catch (error) {
        console.error('Add stamp error:', error);
        showToast('서버 연결에 실패했습니다', 'error');
    } finally {
        showLoading(false);
    }
}

function animateStampAddition(oldStamps, newStamps) {
    const oldDisplay = oldStamps % CONFIG.STAMPS_PER_COUPON;
    const newDisplay = newStamps % CONFIG.STAMPS_PER_COUPON;
    const stampItems = elements.stampGrid.querySelectorAll('.stamp-item');

    // 쿠폰이 발급된 경우 (10개 -> 0개로 리셋)
    if (newStamps > oldStamps && newDisplay < oldDisplay) {
        // 먼저 모든 도장 채우기
        stampItems.forEach((stamp, index) => {
            setTimeout(() => {
                stamp.classList.add('filled');
            }, index * 100);
        });

        // 잠시 후 리셋하고 새 도장 표시
        setTimeout(() => {
            stampItems.forEach(stamp => stamp.classList.remove('filled'));
            elements.currentStamps.textContent = newDisplay;

            for (let i = 0; i < newDisplay; i++) {
                setTimeout(() => {
                    stampItems[i].classList.add('filled');
                }, i * 100);
            }

            elements.couponCount.textContent = currentUser.coupons;
        }, 1200);
    } else {
        // 일반적인 도장 추가
        elements.currentStamps.textContent = newDisplay;

        for (let i = oldDisplay; i < newDisplay; i++) {
            setTimeout(() => {
                stampItems[i].classList.add('filled');
            }, (i - oldDisplay) * 150);
        }
    }
}

// ============================================
// 쿠폰 사용
// ============================================
async function handleUseCoupon() {
    const qty = parseInt(elements.couponQty.textContent);
    const code = elements.staffCodeCoupon.value;

    if (code !== CONFIG.STAFF_CODE) {
        showToast('인증 코드가 올바르지 않습니다', 'error');
        return;
    }

    if (qty > currentUser.coupons) {
        showToast('보유 쿠폰이 부족합니다', 'error');
        return;
    }

    showLoading(true);
    closeModal('coupon-modal');

    try {
        const response = await apiCall('useCoupon', {
            phone: currentUser.phone,
            count: qty
        });

        if (response.success) {
            currentUser.coupons = response.coupons;
            saveSession();
            updateDisplay();
            showToast(`쿠폰 ${qty}장이 사용되었습니다!`, 'success');
        } else {
            showToast(response.message || '쿠폰 사용에 실패했습니다', 'error');
        }
    } catch (error) {
        console.error('Use coupon error:', error);
        showToast('서버 연결에 실패했습니다', 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// API 통신
// ============================================
async function apiCall(action, data) {
    // 개발 모드: API URL이 설정되지 않은 경우 로컬 테스트 모드
    if (CONFIG.API_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
        console.warn('API URL이 설정되지 않았습니다. 테스트 모드로 동작합니다.');
        return mockApiCall(action, data);
    }

    const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action, ...data })
    });

    return await response.json();
}

// 테스트용 Mock API
function mockApiCall(action, data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // 로컬 스토리지에서 사용자 데이터 관리
            const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');

            switch (action) {
                case 'login':
                    if (!users[data.phone]) {
                        users[data.phone] = {
                            name: data.name,
                            phone: data.phone,
                            stamps: 0,
                            coupons: 0
                        };
                    }
                    localStorage.setItem('mockUsers', JSON.stringify(users));
                    resolve({
                        success: true,
                        ...users[data.phone]
                    });
                    break;

                case 'getUser':
                    const user = users[data.phone];
                    if (user) {
                        resolve({ success: true, ...user });
                    } else {
                        resolve({ success: false, message: '사용자를 찾을 수 없습니다' });
                    }
                    break;

                case 'addStamp':
                    if (users[data.phone]) {
                        const oldStamps = users[data.phone].stamps;
                        users[data.phone].stamps += data.count;
                        const newCoupons = Math.floor(users[data.phone].stamps / 10) - Math.floor(oldStamps / 10);
                        users[data.phone].coupons += newCoupons;
                        localStorage.setItem('mockUsers', JSON.stringify(users));
                        resolve({
                            success: true,
                            stamps: users[data.phone].stamps,
                            coupons: users[data.phone].coupons,
                            newCoupons: newCoupons
                        });
                    } else {
                        resolve({ success: false, message: '사용자를 찾을 수 없습니다' });
                    }
                    break;

                case 'useCoupon':
                    if (users[data.phone]) {
                        if (users[data.phone].coupons >= data.count) {
                            users[data.phone].coupons -= data.count;
                            localStorage.setItem('mockUsers', JSON.stringify(users));
                            resolve({
                                success: true,
                                coupons: users[data.phone].coupons
                            });
                        } else {
                            resolve({ success: false, message: '쿠폰이 부족합니다' });
                        }
                    } else {
                        resolve({ success: false, message: '사용자를 찾을 수 없습니다' });
                    }
                    break;

                default:
                    resolve({ success: false, message: '알 수 없는 요청입니다' });
            }
        }, 500);
    });
}

// ============================================
// 유틸리티
// ============================================
function showToast(message, type = '') {
    elements.toast.textContent = message;
    elements.toast.className = 'toast show';
    if (type) {
        elements.toast.classList.add(type);
    }

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    if (show) {
        elements.loading.classList.add('active');
    } else {
        elements.loading.classList.remove('active');
    }
}
