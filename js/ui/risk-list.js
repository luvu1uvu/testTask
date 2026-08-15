// UI-модуль: рендер реестра рисков и пустого состояния. Только DOM — расчёты
// берутся из risk-model.js, чтение данных и фильтрация/сортировка — на
// стороне вызывающего кода (app.js). Модуль сам не фильтрует и не сортирует.

import { calculateScore, getPriorityLevel, getPriorityLabel, getStatusLabel } from '../risk-model.js';

const EMPTY_MESSAGE =
  'В проекте пока нет рисков. Добавьте первый риск, чтобы оценить его приоритет и назначить меру реагирования';

// Обработчик клика появится в шаге 4 вместе с формой создания риска — здесь
// кнопка присутствует визуально, как требует состояние «пустой реестр».
function createEmptyState() {
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

  wrapper.append(message, button);
  return wrapper;
}

function createRiskRow(risk) {
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

  row.append(titleCell, scaleCell, scoreCell, priorityCell, statusCell, measureCell, responsibleCell);
  return row;
}

function createRiskTable(risks) {
  const table = document.createElement('table');
  table.className = 'risk-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Название', 'Вероятность × влияние', 'Балл', 'Приоритет', 'Статус', 'Мера реагирования', 'Ответственный'].forEach(
    (text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    },
  );
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  for (const risk of risks) {
    tbody.appendChild(createRiskRow(risk));
  }

  table.append(thead, tbody);
  return table;
}

// Рендерит риски в container: пустое состояние, если risks пуст, иначе
// таблицу реестра. risks должен быть уже отфильтрован и отсортирован
// вызывающим кодом.
export function renderRiskList(container, risks) {
  container.innerHTML = '';
  if (risks.length === 0) {
    container.appendChild(createEmptyState());
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'risk-table-wrapper';
  wrapper.appendChild(createRiskTable(risks));
  container.appendChild(wrapper);
}
