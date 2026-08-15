// UI-модуль: экран повреждённых или неподдерживаемых данных при загрузке
// приложения. Показывается вместо реестра, фильтров и кнопок создания, когда
// storage.js сообщает status === 'corrupted'. Сам не читает и не изменяет
// localStorage — только показывает сообщение и по подтверждённому клику
// вызывает переданный колбэк onReset (реальный вызов resetStorage() —
// на стороне app.js).

import { showConfirmDialog } from './dialogs.js';

const ERROR_MESSAGE =
  'Не удалось загрузить сохранённые данные. Возможно, они повреждены или созданы несовместимой версией приложения';

const RESET_CONFIRM_MESSAGE =
  'Сохранённые данные будут безвозвратно удалены без возможности восстановления.';

// Рендерит экран ошибки в container. onReset() вызывается только после
// подтверждения в отдельном диалоге — клик по кнопке «Сбросить данные и
// начать заново» сам по себе ничего не удаляет.
export function renderDataError(container, { onReset } = {}) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const message = document.createElement('p');
  message.className = 'empty-state__message';
  message.textContent = ERROR_MESSAGE;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'reset-data-btn';
  button.className = 'btn btn--danger';
  button.textContent = 'Сбросить данные и начать заново';
  button.addEventListener('click', () => {
    showConfirmDialog({
      message: RESET_CONFIRM_MESSAGE,
      confirmLabel: 'Сбросить данные',
      cancelLabel: 'Отмена',
      danger: true,
      onConfirm: () => {
        if (typeof onReset === 'function') onReset();
      },
    });
  });

  wrapper.append(message, button);
  container.appendChild(wrapper);
}
