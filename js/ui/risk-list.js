// UI-модуль: рендер реестра рисков и пустого состояния. Только DOM — расчёты
// берутся из risk-model.js, чтение данных и фильтрация/сортировка — на
// стороне вызывающего кода (app.js). Модуль сам не фильтрует и не сортирует.

import { calculateScore, getPriorityLevel, getPriorityLabel, getStatusLabel } from '../risk-model.js';

const EMPTY_MESSAGE =
  'В проекте пока нет рисков. Добавьте первый риск, чтобы оценить его приоритет и назначить меру реагирования';

function createEmptyState(onCreateFirst) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const message = document.createElement('p');
  message.className = 'empty-state__message';
  message.textContent = EMPTY_MESSAGE;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'add-first-risk-btn';
  button.className = 'btn btn--primary';
  button.textContent = 'Добавить первый риск';
  button.addEventListener('click', () => {
    if (typeof onCreateFirst === 'function') onCreateFirst();
  });

  wrapper.append(message, button);
  return wrapper;
}

function createRiskRow(risk, onEdit) {
  const score = calculateScore(risk.probability, risk.impact);
  const priorityLevel = getPriorityLevel(score);
  const priorityLabel = getPriorityLabel(score);
  const statusLabel = getStatusLabel(risk.status);

  const row = document.createElement('tr');
  row.className = 'risk-row';

  const titleCell = document.createElement('td');
  titleCell.className = 'risk-row__title';
  titleCell.textContent = risk.title;

  const scaleCell = document.createElement('td');
  scaleCell.textContent = `${risk.probability} × ${risk.impact}`;

  const scoreCell = document.createElement('td');
  scoreCell.textContent = String(score);

  const priorityCell = document.createElement('td');
  const priorityBadge = document.createElement('span');
  priorityBadge.className = `priority-badge priority-badge--${priorityLevel}`;
  priorityBadge.textContent = priorityLabel;
  priorityCell.appendChild(priorityBadge);

  const statusCell = document.createElement('td');
  statusCell.textContent = statusLabel;

  const measureCell = document.createElement('td');
  measureCell.textContent = risk.measure || '—';

  const responsibleCell = document.createElement('td');
  responsibleCell.textContent = risk.responsible || '—';

  const actionsCell = document.createElement('td');
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'btn btn--secondary btn--small';
  editButton.textContent = 'Изменить';
  editButton.addEventListener('click', () => {
    if (typeof onEdit === 'function') onEdit(risk.id);
  });
  actionsCell.appendChild(editButton);

  row.append(titleCell, scaleCell, scoreCell, priorityCell, statusCell, measureCell, responsibleCell, actionsCell);
  return row;
}

function createRiskTable(risks, onEdit) {
  const table = document.createElement('table');
  table.className = 'risk-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    'Название',
    'Вероятность × влияние',
    'Балл',
    'Приоритет',
    'Статус',
    'Мера реагирования',
    'Ответственный',
    'Действия',
  ].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  for (const risk of risks) {
    tbody.appendChild(createRiskRow(risk, onEdit));
  }

  table.append(thead, tbody);
  return table;
}

// Рендерит риски в container: пустое состояние, если risks пуст, иначе
// таблицу реестра. risks должен быть уже отфильтрован и отсортирован
// вызывающим кодом. callbacks.onCreateFirst — клик по кнопке пустого
// состояния; callbacks.onEdit(id) — клик по кнопке «Изменить» в строке.
export function renderRiskList(container, risks, { onCreateFirst, onEdit } = {}) {
  container.innerHTML = '';
  if (risks.length === 0) {
    container.appendChild(createEmptyState(onCreateFirst));
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'risk-table-wrapper';
  wrapper.appendChild(createRiskTable(risks, onEdit));
  container.appendChild(wrapper);
}
