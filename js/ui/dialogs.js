// UI-модуль: универсальный диалог подтверждения опасного действия. Не знает
// о рисках, хранилище или бизнес-логике — только рендерит переданный текст
// и кнопки, вызывает переданные колбэки. Пользовательский текст выводится
// исключительно через textContent, без innerHTML.

let closeActiveDialog = null;

// Показывает модальный диалог с сообщением и двумя действиями — отменой и
// подтверждением. onConfirm вызывается только по клику на кнопку
// подтверждения, onCancel — по клику на кнопку отмены. Диалог сам ничего не
// удаляет и не изменяет — это остаётся на совести переданных колбэков.
// danger — визуально оформляет кнопку подтверждения как опасное действие.
export function showConfirmDialog({
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
} = {}) {
  if (typeof closeActiveDialog === 'function') closeActiveDialog();

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');

  const messageEl = document.createElement('p');
  messageEl.className = 'dialog__message';
  messageEl.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'dialog__actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn--secondary';
  cancelButton.textContent = cancelLabel;

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = danger ? 'btn btn--danger' : 'btn btn--primary';
  confirmButton.textContent = confirmLabel;

  function close() {
    overlay.remove();
    closeActiveDialog = null;
  }

  cancelButton.addEventListener('click', () => {
    close();
    if (typeof onCancel === 'function') onCancel();
  });

  confirmButton.addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });

  actions.append(cancelButton, confirmButton);
  dialog.append(messageEl, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  closeActiveDialog = close;

  // Фокус по умолчанию — на «Отмена», даже для опасного действия: случайное
  // нажатие Enter сразу после открытия диалога не должно ничего удалять.
  cancelButton.focus();
}
