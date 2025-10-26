/**
 * TradingView API URLs Configuration
 * Migrated from Python config.py
 */

const urls = {
  // Authentication
  signin: 'https://www.tradingview.com/accounts/signin/',

  // User validation
  username_hint: 'https://www.tradingview.com/username_hint/',

  // Pine Script permissions
  list_users: 'https://www.tradingview.com/pine_perm/list_users/',
  add_access: 'https://www.tradingview.com/pine_perm/add/',
  modify_access: 'https://www.tradingview.com/pine_perm/modify_user_expiration/',
  remove_access: 'https://www.tradingview.com/pine_perm/remove/',

  // Account info
  tvcoins: 'https://www.tradingview.com/tvcoins/details/'
};

module.exports = { urls };
