// UI-модуль: фильтр реестра рисков по статусу. Работает только с внутренними
// кодами статуса (STATUS_CODES) — русские подписи берутся из risk-model.js
// и не дублируются здесь, кроме отдельного режима «Активные», который не
// является одним статусом, а объединяет три кода.

import { STATUS_CODES, getStatusLabel } from '../risk-model.js';

export const DEFAULT_FILTER = 'active';

const ACTIVE_STATUSES = Object.freeze(['open', 'in_progress', 'monitoring']);

// Режимы фильтра в порядке отображения в select: «Активные» первым (режим
// по умолчанию), затем по одному режиму на каждый внутренний код статуса —
// код и подпись берутся из STATUS_CODES/getStatusLabel, без ручного
// дублирования.
function getFilterModes() {
  return [
    { code: DEFAULT_FILTER, label: 'Активные', statuses: ACTIVE_STATUSES },
    ...STATUS_CODES.map((code) => ({ code, label: getStatusLabel(code), statuses: [code] })),
  ];
}

// Возвращает список внутренних кодов статуса, которые должен показывать
// список рисков для переданного кода режима фильтра. Неизвестный код режима
// не должен встречаться в UI (select содержит только известные режимы), но
// на случай мусорного значения безопасно откатывается к режиму по умолчанию.
export function getStatusesForFilter(filterCode) {
  const mode = getFilterModes().find((item) => item.code === filterCode);
  return mode ? mode.statuses : ACTIVE_STATUSES;
}

// Рендерит select режима фильтра и кнопку «Сбросить фильтры» в container.
// current — код текущего выбранного режима. onChange(code) вызывается при
// выборе другого режима в select. onReset() вызывается по кнопке сброса —
// вызывающий код (app.js) сам возвращает текущий фильтр к DEFAULT_FILTER.
export function renderFilters(container, { current = DEFAULT_FILTER, onChange, onReset } = {}) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'filters';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', 'status-filter');
  labelEl.className = 'filters__label';
  labelEl.textContent = 'Статус';

  const select = document.createElement('select');
  select.id = 'status-filter';
  select.name = 'status-filter';
  select.className = 'filters__select';

  for (const mode of getFilterModes()) {
    const option = document.createElement('option');
    option.value = mode.code;
    option.textContent = mode.label;
    if (mode.code === current) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    if (typeof onChange === 'function') onChange(select.value);
  });

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.id = 'reset-filters-btn';
  resetButton.className = 'btn btn--secondary btn--small';
  resetButton.textContent = 'Сбросить фильтры';
  resetButton.addEventListener('click', () => {
    if (typeof onReset === 'function') onReset();
  });

  wrapper.append(labelEl, select, resetButton);
  container.appendChild(wrapper);
}
