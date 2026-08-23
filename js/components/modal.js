// components/modal.js

export function openModal(id) {
  document.getElementById(id).classList.add('open');

  if (id === 'modal-holding') {
    ['h-ticker', 'h-search', 'h-name', 'h-qty', 'h-cost'].forEach(i => {
      const el = document.getElementById(i);
      if (el) el.value = '';
    });

    document.getElementById('h-selected-ticker').style.display = 'none';
    document.getElementById('h-search-results').style.display = 'none';
    document.getElementById('h-type').value = 'bank';

    window.onHoldingTypeChange?.('bank');
  }
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function showAlert(msg, title = '') {
  return showDialog(msg, {
    title,
    confirmText: 'OK',
    cancelText: null
  });
}

export function showConfirm(msg, title = '', danger = false) {
  return showDialog(msg, {
    title,
    confirmText: 'OK',
    cancelText: 'Cancel',
    danger
  });
}

export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;

  t.textContent = msg;
  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 2500);
}

function showDialog(
  message,
  {
    title = '',
    confirmText = 'OK',
    cancelText = null,
    danger = false
  } = {}
) {
  return new Promise(resolve => {
    document.getElementById('dialog-title').textContent = title || '';
    document.getElementById('dialog-title').style.display =
      title ? '' : 'none';

    document.getElementById('dialog-message').innerHTML =
      message.replace(/\n/g, '<br>');

    const footer = document.getElementById('dialog-footer');
    footer.innerHTML = '';

    if (cancelText !== null) {
      const cancelBtn = document.createElement('button');

      cancelBtn.className = 'btn';
      cancelBtn.textContent = cancelText;

      cancelBtn.onclick = () => {
        closeModal('modal-dialog');
        resolve(false);
      };

      footer.appendChild(cancelBtn);
    }

    const okBtn = document.createElement('button');

    okBtn.className =
      'btn' + (danger ? ' btn-danger-filled' : ' btn-primary');

    okBtn.textContent = confirmText;

    okBtn.onclick = () => {
      closeModal('modal-dialog');
      resolve(true);
    };

    footer.appendChild(okBtn);

    openModal('modal-dialog');
  });
}


// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
window.openModal = openModal;
window.closeModal = closeModal;
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.toast = toast;