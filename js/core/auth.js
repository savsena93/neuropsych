/**
 * auth.js
 * -----------------------------------------------------------------------
 * Login for three roles (admin, examiner, examinee) selected on the
 * login screen:
 *   - admin / examiner log in with a PIN (created by the admin under
 *     Admin -> Users). The selected role must match the PIN's role.
 *   - examinee logs in with the participant code created at intake —
 *     no PIN. They get a transient pseudo-user that only exists for the
 *     lifetime of the page and grants access to the test-taking flow
 *     (consent -> test selection -> runner -> summary) and nothing else.
 *
 * Keeps track of who is currently logged in for the lifetime of the page
 * (not persisted across a full app close, by design — every session
 * starts at the login screen). Because the DB layer may now be remote
 * (Worker + D1 when hosted), login is asynchronous and returns a Promise.
 */

var Auth = (function () {
  'use strict';

  var currentUser = null;

  // Restore currentUser from localStorage on startup if available
  try {
    var saved = localStorage.getItem('npa_currentUser');
    if (saved) {
      currentUser = JSON.parse(saved);
    }
  } catch (e) {
    // ignore
  }

  // credentials: { role: 'admin'|'examiner', pin } or
  //              { role: 'examinee', code }
  // Resolves to { ok: true, user } or { ok: false, error }.
  function login(credentials) {
    return DB.loginUser(credentials).then(function (result) {
      if (result && result.ok) {
        currentUser = result.user;
        try {
          localStorage.setItem('npa_currentUser', JSON.stringify(result.user));
          if (result.token) {
            localStorage.setItem('npa_token', result.token);
          }
        } catch (e) {}
      }
      return result;
    });
  }

  function logout() {
    currentUser = null;
    try {
      localStorage.removeItem('npa_currentUser');
      localStorage.removeItem('npa_token');
    } catch (e) {}
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isAdmin() {
    return !!currentUser && currentUser.role === 'admin';
  }

  function isExaminer() {
    return !!currentUser && currentUser.role === 'examiner';
  }

  function isExaminee() {
    return !!currentUser && currentUser.role === 'examinee';
  }

  function requireRole(role) {
    if (!currentUser) return false;
    if (Array.isArray(role)) return role.indexOf(currentUser.role) !== -1;
    return currentUser.role === role;
  }

  return {
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    isAdmin: isAdmin,
    isExaminer: isExaminer,
    isExaminee: isExaminee,
    requireRole: requireRole
  };
})();
