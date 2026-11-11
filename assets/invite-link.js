// Group invite links: budgy.life/invite/group/<token> (thepeetp/budgy#1524).
//
// The app opens these links itself when it is installed (iOS applinks, Android App Links). This
// file holds the logic for the times it cannot: GitHub Pages serves 404.html for the path, which
// rewrites it to /invite/?code=<token>, and invite/index.html offers the ways into the app.
// Loaded by both pages and by node's test runner, so it stays plain ES5 with no DOM access.
(function (root) {
  'use strict';

  var HOST = 'budgy.life';
  var IOS_APP_ID = '6756961804';
  var ANDROID_PACKAGE = 'io.budgy.mobile';
  // The token the backend mints is a UUID; the app accepts 8-64 of these characters.
  var TOKEN = /^[A-Za-z0-9-]{8,64}$/;

  /** The token in a pathname like /invite/group/<token>, or null. */
  function tokenFromPath(pathname) {
    var segments = String(pathname || '').split('/').filter(Boolean);
    if (segments.length !== 3 || segments[0] !== 'invite' || segments[1] !== 'group') return null;
    return TOKEN.test(segments[2]) ? segments[2] : null;
  }

  /** The token in a query string like ?code=<token>, or null. */
  function tokenFromSearch(search) {
    var match = /[?&]code=([^&#]*)/.exec(String(search || ''));
    if (!match) return null;
    var code = decodeURIComponent(match[1]);
    return TOKEN.test(code) ? code : null;
  }

  /** Where 404.html sends an invite path: the fallback page, the token and the original query kept. */
  function fallbackLocation(pathname, search) {
    var token = tokenFromPath(pathname);
    if (!token) return null;
    var rest = String(search || '').replace(/^\?/, '');
    return '/invite/?code=' + encodeURIComponent(token) + (rest ? '&' + rest : '');
  }

  /** The link the app claims, exactly as the share button sends it. */
  function inviteUrl(token) {
    return 'https://' + HOST + '/invite/group/' + encodeURIComponent(token);
  }

  /**
   * Android: an intent that opens the app on this link, or the Play Store when it is not
   * installed. Chrome follows it from a button tap even when App Links did not fire.
   */
  function androidIntentUrl(token) {
    var store = 'https://play.google.com/store/apps/details?id=' + ANDROID_PACKAGE;
    return 'intent://' + HOST + '/invite/group/' + encodeURIComponent(token) +
      '#Intent;scheme=https;package=' + ANDROID_PACKAGE +
      ';S.browser_fallback_url=' + encodeURIComponent(store) + ';end';
  }

  /**
   * iOS Smart App Banner: Safari shows "Open" when the app is installed and hands it this link,
   * the one path into the app from a page on the same domain the app claims.
   */
  function smartBannerContent(token) {
    return 'app-id=' + IOS_APP_ID + ', app-argument=' + inviteUrl(token);
  }

  /**
   * LINE's in-app browser never opens another app. When the page finds itself there without the
   * flag, it reloads with openExternalBrowser=1 and LINE hands it to the system browser.
   */
  function lineExternalUrl(href, userAgent) {
    if (!/\bLine\//.test(String(userAgent || ''))) return null;
    if (/[?&]openExternalBrowser=1\b/.test(String(href))) return null;
    return String(href) + (String(href).indexOf('?') >= 0 ? '&' : '?') + 'openExternalBrowser=1';
  }

  var api = {
    tokenFromPath: tokenFromPath,
    tokenFromSearch: tokenFromSearch,
    fallbackLocation: fallbackLocation,
    inviteUrl: inviteUrl,
    androidIntentUrl: androidIntentUrl,
    smartBannerContent: smartBannerContent,
    lineExternalUrl: lineExternalUrl,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BudgyInvite = api;
})(this);
