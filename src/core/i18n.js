/**
 * ZenMarket i18n
 * ระบบแปลภาษา TH / EN ด้วย DOM TreeWalker (แปลเฉพาะข้อความ UI ที่กำหนด ไม่แตะข้อมูลลูกค้า/สินค้า)
 */

const TRANSLATIONS = {
  th: {
    'nav.home': 'หน้าแรก',
    'nav.shop': 'ร้านค้า',
    'nav.account': 'บัญชีของฉัน',
    'nav.cart': 'ตะกร้า',
    'nav.admin': 'จัดการร้าน',
    'nav.logout': 'ออกจากระบบ',
    'nav.login': 'เข้าสู่ระบบ',
    'nav.register': 'สมัครสมาชิก',

    'home.hero_title': 'ZenMarket',
    'home.hero_subtitle': 'ร้านค้าออนไลน์ ด้วยความตั้งใจและความใส่ใจ',
    'home.steps.title': 'วิธีการสั่งซื้อ',
    'home.steps.1': 'เลือกสินค้า',
    'home.steps.2': 'ชำระเงิน',
    'home.steps.3': 'รับสินค้า',
    'home.reviews.title': 'รีวิวจากลูกค้า',
    'home.faq.title': 'คำถามที่พบบ่อย',

    'cart.title': 'ตะกร้าสินค้า',
    'cart.empty': 'ตะกร้าสินค้าของคุณว่างเปล่า',
    'cart.subtotal': 'ยอดรวมสินค้า',
    'cart.shipping': 'ค่าจัดส่ง',
    'cart.total': 'รวมทั้งหมด',
    'cart.checkout': 'ไปยังหน้าชำระเงิน',

    'checkout.title': 'ชำระเงิน',
    'checkout.shipping_info': 'ข้อมูลการจัดส่ง',
    'checkout.payment_method': 'วิธีการชำระเงิน',
    'checkout.promptpay': 'พร้อมเพย์ (PromptPay)',
    'checkout.cod': 'เก็บเงินปลายทาง (COD)',
    'checkout.place_order': 'ยืนยันคำสั่งซื้อ',

    'account.title': 'บัญชีของฉัน',
    'account.profile': 'โปรไฟล์',
    'account.addresses': 'สมุดที่อยู่',
    'account.orders': 'คำสั่งซื้อ',
    'account.favorites': 'รายการโปรด',

    'admin.dashboard': 'แดชบอร์ด',
    'admin.orders': 'คำสั่งซื้อ',
    'admin.products': 'สินค้า',
    'admin.categories': 'หมวดหมู่',
    'admin.reviews': 'รีวิว',
    'admin.settings': 'การตั้งค่า',
    'admin.payments': 'การชำระเงิน',
    'admin.operations': 'การดำเนินงาน',

    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.delete': 'ลบ',
    'common.edit': 'แก้ไข',
    'common.close': 'ปิด',
    'common.search': 'ค้นหา',
    'common.loading': 'กำลังโหลด...',
    'common.error': 'เกิดข้อผิดพลาด',
    'common.success': 'สำเร็จ',
  },
  en: {
    'nav.home': 'Home',
    'nav.shop': 'Shop',
    'nav.account': 'My Account',
    'nav.cart': 'Cart',
    'nav.admin': 'Admin',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    'nav.register': 'Register',

    'home.hero_title': 'ZenMarket',
    'home.hero_subtitle': 'Online store with care and attention',
    'home.steps.title': 'How to Order',
    'home.steps.1': 'Select Product',
    'home.steps.2': 'Pay',
    'home.steps.3': 'Receive',
    'home.reviews.title': 'Customer Reviews',
    'home.faq.title': 'Frequently Asked Questions',

    'cart.title': 'Shopping Cart',
    'cart.empty': 'Your cart is empty',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Shipping',
    'cart.total': 'Total',
    'cart.checkout': 'Proceed to Checkout',

    'checkout.title': 'Checkout',
    'checkout.shipping_info': 'Shipping Information',
    'checkout.payment_method': 'Payment Method',
    'checkout.promptpay': 'PromptPay',
    'checkout.cod': 'Cash on Delivery (COD)',
    'checkout.place_order': 'Place Order',

    'account.title': 'My Account',
    'account.profile': 'Profile',
    'account.addresses': 'Address Book',
    'account.orders': 'Orders',
    'account.favorites': 'Favorites',

    'admin.dashboard': 'Dashboard',
    'admin.orders': 'Orders',
    'admin.products': 'Products',
    'admin.categories': 'Categories',
    'admin.reviews': 'Reviews',
    'admin.settings': 'Settings',
    'admin.payments': 'Payments',
    'admin.operations': 'Operations',

    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
  },
};

let currentLang = 'th';

/**
 * ตั้งค่าภาษาปัจจุบัน
 */
export function setLanguage(lang) {
  if (TRANSLATIONS[lang]) {
    currentLang = lang;
    localStorage.setItem('zenmarket_lang', lang);
    translatePage();
  }
}

/**
 * รับภาษาปัจจุบัน
 */
export function getLanguage() {
  if (currentLang !== 'th') return currentLang;
  const stored = localStorage.getItem('zenmarket_lang');
  if (stored && TRANSLATIONS[stored]) {
    currentLang = stored;
    return currentLang;
  }
  return 'th';
}

/**
 * แปลข้อความด้วย key
 */
export function t(key) {
  const strings = TRANSLATIONS[currentLang];
  return strings && strings[key] ? strings[key] : key;
}

/**
 * แปลทั้งหน้าโดยใช้ data-i18n attribute
 * ใช้ DOM TreeWalker เพื่อแปลเฉพาะข้อความ UI ที่กำหนด
 */
export function translatePage() {
  const lang = getLanguage();
  const strings = TRANSLATIONS[lang];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const key = node.getAttribute('data-i18n');
        if (key && strings[key]) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  const nodes = [];
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    nodes.push(currentNode);
  }

  for (const node of nodes) {
    const key = node.getAttribute('data-i18n');
    if (key && strings[key]) {
      if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
        if (!node.value || node.value === node.getAttribute('data-i18n-original')) {
          node.placeholder = strings[key];
          node.setAttribute('data-i18n-original', strings[key]);
        }
      } else {
        node.textContent = strings[key];
      }
    }
  }
}

/**
 * เริ่มต้นระบบ i18n
 */
export function initI18n() {
  const lang = getLanguage();
  translatePage();
}