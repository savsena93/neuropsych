/**
 * router.js
 * -----------------------------------------------------------------------
 * Deliberately not a "real" SPA router (no history API, no URL hashes).
 * Every screen already exists in index.html as a <section data-view="...">
 * and this just shows one at a time. That keeps everything working from
 * a plain file:// URL with zero build step, which matters on a locked-down
 * offline tablet.
 *
 * Each route can declare which role(s) may enter it. Assessment screens
 * use the same mechanism as the administrative workspace.
 */

var Router = (function () {
  'use strict';

  var routes = {};   // name -> { roles: [...]|null, onEnter: fn|null }
  var current = null;
  var viewParams = {};

  function register(name, config) {
    routes[name] = config || {};
  }

  function navigate(name, params) {
    var route = routes[name];
    if (!route) {
      console.error('Router: no such view "' + name + '"');
      return false;
    }
    if (route.roles && !Auth.requireRole(route.roles)) {
      console.warn('Router: blocked navigation to "' + name + '" — role not permitted');
      navigate('login');
      return false;
    }

    document.querySelectorAll('[data-view]').forEach(function (el) {
      el.hidden = el.getAttribute('data-view') !== name;
    });

    current = name;
    viewParams = params || {};
    document.body.setAttribute('data-current-view', name);

    if (typeof route.onEnter === 'function') {
      // onEnter may be async (every DB.* call returns a Promise — see
      // storage.js): catch synchronous throws here and log async
      // rejections, so a failed screen never becomes an unhandled
      // rejection that vanishes silently.
      try {
        var maybePromise = route.onEnter(viewParams);
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(function (e) {
            console.error('Router: onEnter failed for "' + name + '"', e);
          });
        }
      } catch (e) {
        console.error('Router: onEnter failed for "' + name + '"', e);
      }
    }
    return true;
  }

  function getCurrent() {
    return current;
  }

  function getParams() {
    return viewParams;
  }

  return {
    register: register,
    navigate: navigate,
    getCurrent: getCurrent,
    getParams: getParams
  };
})();
