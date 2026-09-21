/**
 * backup-ui.js
 * -----------------------------------------------------------------------
 * Kept separate from app.js because it is the one place that touches
 * the DOM File and Blob APIs rather than plain form handling — easier
 * to find and to swap out later if the export/import mechanism changes
 * (e.g. to write directly to a mounted USB path via a WebView bridge).
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var exportBtn = document.getElementById('exportBtn');
    var importInput = document.getElementById('importFileInput');
    var status = document.getElementById('backupStatus');

    exportBtn.addEventListener('click', function () {
      // DB.exportAll returns a Promise in both modes (see storage.js) —
      // chain on it, then build the downloadable JSON file from the real
      // payload; a failure surfaces as a banner instead of vanishing.
      DB.exportAll().then(function (payload) {
        var json = JSON.stringify(payload, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        var stamp = payload.exportedAt.replace(/[:.]/g, '-');
        a.href = url;
        a.download = 'npa-backup-' + stamp + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus('Backup exported. Copy the downloaded file to your USB drive.', 'info');
      }).catch(function (err) {
        setStatus('Export failed: ' + err.message, 'error');
      });
    });

    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;

      AppDialogs.requestConfirm('Import backup', 'Continue to merge this backup with existing data? Cancel to choose replacement.', function (merge) {
        var mode = merge ? 'merge' : 'replace';
        if (mode === 'replace') {
          AppDialogs.requestConfirm('Replace all data', 'This permanently erases current data and replaces it with the backup.', function (confirmed) {
            if (!confirmed) { importInput.value = ''; return; }
            readBackup(mode);
          });
          return;
        }
        readBackup(mode);
      });

      function readBackup(mode) {
        var reader = new FileReader();
        reader.onload = function () {
        var payload;
        try {
          payload = JSON.parse(reader.result);
        } catch (err) {
          setStatus('Import failed: ' + err.message, 'error');
          importInput.value = '';
          return;
        }
        // DB.importAll returns a Promise in both modes (see storage.js) —
        // chain on it so the status message reflects the actual result.
        DB.importAll(Auth.getCurrentUser(), payload, mode).then(function () {
          setStatus('Backup imported (' + mode + ').', 'info');
          importInput.value = '';
        }).catch(function (err) {
          setStatus('Import failed: ' + err.message, 'error');
          importInput.value = '';
        });
      };
        reader.onerror = function () {
          setStatus('Could not read the selected file.', 'error');
          importInput.value = '';
        };
        reader.readAsText(file);
      }
    });

    function setStatus(message, kind) {
      status.textContent = message;
      status.className = 'banner banner--' + kind;
      status.hidden = !message;
    }
  });
})();
