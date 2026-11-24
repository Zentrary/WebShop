export const ALLOWED_CATEGORY_ICONS = [
  'Home',
  'Category',
  'Tag',
  'Shop',
  'Cart',
  'CreditCard',
  'User',
  'Shield',
  'CheckCircle',
  'AlertCircle',
  'Mail',
  'Phone',
  'Link',
  'ExternalLink',
  'Instagram',
  'Facebook',
  'Tiktok',
  'Twitter',
  'Youtube',
  'Line',
  'Package',
  'Box',
  'Star',
  'Heart',
  'Clock',
  'Truck',
  'CreditCard',
  'Wallet',
  'Percent',
  'Discount',
];

export function isValidCategoryIcon(iconName) {
  return ALLOWED_CATEGORY_ICONS.includes(iconName);
}

export function getIconComponent(iconName) {
  if (!isValidCategoryIcon(iconName)) {
    iconName = 'Package';
  }
  return iconName;
}