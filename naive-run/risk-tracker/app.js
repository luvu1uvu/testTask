'use strict';

/* ---------- Константы и справочники ---------- */

const STORAGE_KEY = 'risk-tracker:risks:v1';

const CATEGORY_LABELS = {
  technical: 'Технический',
  schedule: 'Сроки',
  budget: 'Бюджет',
  resource: 'Ресурсы',
  scope: 'Содержание',
  external: 'Внешний',
  other: 'Другое',
};

const STATUS_LABELS = {
  open: 'Открыт',
  in_progress: 'В работе',
  mitigated: 'Снижен',
  closed: 'Закрыт',
};

const STRATEGY_LABELS = {
  avoid: 'Избежать',
  mitigate: 'Снизить',
  transfer: 'Передать',
  accept: 'Принять',
};

const PRIORITY_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

/* Порог приоритета по произведению вероятность × влияние (1..25) */
function scoreToLevel(score) {
  if (score >= 15) return 'critical';
  if (score >= 9) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

/* ---------- Хранилище ---------- */

const Store = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Не удалось прочитать localStorage', e);
      return [];
    }
  },
  save(risks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(risks));
  },
};

let risks = Store.load();
let matrixFilter = null; // {probability, impact} или null

/* ---------- Утилиты ---------- */

function uid() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

/* ---------- Рендер: статистика ---------- */

function renderStats() {
  const total = risks.length;
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  let openCount = 0;
  risks.forEach(r => {
    counts[scoreToLevel(r.probability * r.impact)]++;
    if (r.status !== 'closed') openCount++;
  });

  const statsRow = document.getElementById('statsRow');
  statsRow.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Всего рисков</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${openCount}</div>
      <div class="stat-label">Активных (не закрыто)</div>
    </div>
    <div class="stat-card accent-critical">
      <div class="stat-value">${counts.critical}</div>
      <div class="stat-label">Критических</div>
    </div>
    <div class="stat-card accent-high">
      <div class="stat-value">${counts.high}</div>
      <div class="stat-label">Высоких</div>
    </div>
    <div class="stat-card accent-medium">
      <div class="stat-value">${counts.medium}</div>
      <div class="stat-label">Средних</div>
    </div>
    <div class="stat-card accent-low">
      <div class="stat-value">${counts.low}</div>
      <div class="stat-label">Низких</div>
    </div>
  `;
}

/* ---------- Рендер: матрица 5x5 ---------- */

function renderMatrix() {
  const matrixEl = document.getElementById('riskMatrix');
  matrixEl.innerHTML = '';

  // Строки — влияние (сверху = 5, снизу = 1); столбцы — вероятность (слева = 1, справа = 5)
  for (let impact = 5; impact >= 1; impact--) {
    for (let probability = 1; probability <= 5; probability++) {
      const score = probability * impact;
      const level = scoreToLevel(score);
      const count = risks.filter(r => r.probability === probability && r.impact === impact).length;

      const cell = document.createElement('div');
      cell.className = `matrix-cell lvl-${level}` + (count === 0 ? ' empty-cell' : '');
      cell.title = `Вероятность ${probability} × Влияние ${impact} = ${score} (${PRIORITY_LABELS[level]})`;
      cell.innerHTML = `<span class="cell-count">${count > 0 ? count : ''}</span>`;

      if (matrixFilter && matrixFilter.probability === probability && matrixFilter.impact === impact) {
        cell.classList.add('selected');
      }

      cell.addEventListener('click', () => {
        if (matrixFilter && matrixFilter.probability === probability && matrixFilter.impact === impact) {
          matrixFilter = null;
        } else {
          matrixFilter = { probability, impact };
        }
        renderAll();
      });

      matrixEl.appendChild(cell);
    }
  }

  document.getElementById('btnClearMatrixFilter').hidden = !matrixFilter;
}

/* ---------- Рендер: список рисков ---------- */

function getFilteredSortedRisks() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = document.getElementById('filterCategory').value;
  const priority = document.getElementById('filterPriority').value;
  const status = document.getElementById('filterStatus').value;
  const sortBy = document.getElementById('sortBy').value;

  let list = risks.filter(r => {
    if (search && !r.title.toLowerCase().includes(search)) return false;
    if (category && r.category !== category) return false;
    if (status && r.status !== status) return false;
    if (priority && scoreToLevel(r.probability * r.impact) !== priority) return false;
    if (matrixFilter && (r.probability !== matrixFilter.probability || r.impact !== matrixFilter.impact)) return false;
    return true;
  });

  list.sort((a, b) => {
    switch (sortBy) {
      case 'priority_asc':
        return (a.probability * a.impact) - (b.probability * b.impact);
      case 'created_desc':
        return b.createdAt - a.createdAt;
      case 'created_asc':
        return a.createdAt - b.createdAt;
      case 'title_asc':
        return a.title.localeCompare(b.title, 'ru');
      case 'priority_desc':
      default:
        return (b.probability * b.impact) - (a.probability * a.impact);
    }
  });

  return list;
}

function renderList() {
  const listEl = document.getElementById('riskList');
  const emptyEl = document.getElementById('riskListEmpty');
  const filtered = getFilteredSortedRisks();

  if (risks.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.querySelector('p').textContent = 'Рисков пока нет.';
    emptyEl.querySelector('button').hidden = false;
    return;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.querySelector('p').textContent = 'Ничего не найдено по заданным фильтрам.';
    emptyEl.querySelector('button').hidden = true;
    return;
  }

  emptyEl.hidden = true;

  listEl.innerHTML = filtered.map(r => {
    const score = r.probability * r.impact;
    const level = scoreToLevel(score);
    return `
    <article class="risk-card" data-id="${r.id}">
      <div class="risk-card-top">
        <div>
          <h3 class="risk-title">${escapeHtml(r.title)}</h3>
          ${r.description ? `<p class="risk-desc">${escapeHtml(r.description)}</p>` : ''}
        </div>
        <div class="risk-score-badge lvl-${level}" style="background:var(--lvl-${level}-bg); color:var(--lvl-${level})">
          <span class="score-num">${score}</span>
          <span class="score-lbl">${PRIORITY_LABELS[level]}</span>
        </div>
      </div>
      <div class="risk-card-meta">
        <span class="badge tag">${CATEGORY_LABELS[r.category] || r.category}</span>
        <span class="status-pill status-${r.status}">${STATUS_LABELS[r.status]}</span>
        <span class="badge tag">${STRATEGY_LABELS[r.responseStrategy] || '—'}</span>
        ${r.owner ? `<span class="risk-owner">👤 ${escapeHtml(r.owner)}</span>` : ''}
        ${r.dueDate ? `<span class="risk-due">📅 до ${formatDate(r.dueDate)}</span>` : ''}
      </div>
    </article>
  `;
  }).join('');

  listEl.querySelectorAll('.risk-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="">Все категории</option>' +
    Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  sel.value = current;
}

function renderAll() {
  renderStats();
  renderMatrix();
  renderList();
}

/* ---------- Модальное окно ---------- */

const modal = document.getElementById('riskModal');
const form = document.getElementById('riskForm');

function updatePriorityPreview() {
  const p = Number(document.getElementById('riskProbability').value);
  const i = Number(document.getElementById('riskImpact').value);
  document.getElementById('probValue').textContent = p;
  document.getElementById('impactValue').textContent = i;
  const score = p * i;
  const level = scoreToLevel(score);
  document.getElementById('priorityPreviewScore').textContent = score;
  const lbl = document.getElementById('priorityPreviewLabel');
  lbl.textContent = PRIORITY_LABELS[level];
  lbl.className = `badge lvl-${level}`;
}

function openModal(id) {
  form.reset();
  const isEdit = !!id;
  document.getElementById('modalTitle').textContent = isEdit ? 'Редактировать риск' : 'Новый риск';
  document.getElementById('btnDeleteRisk').hidden = !isEdit;
  document.getElementById('riskId').value = '';

  if (isEdit) {
    const r = risks.find(x => x.id === id);
    if (!r) return;
    document.getElementById('riskId').value = r.id;
    document.getElementById('riskTitle').value = r.title;
    document.getElementById('riskDescription').value = r.description || '';
    document.getElementById('riskCategory').value = r.category;
    document.getElementById('riskOwner').value = r.owner || '';
    document.getElementById('riskProbability').value = r.probability;
    document.getElementById('riskImpact').value = r.impact;
    document.getElementById('riskResponseStrategy').value = r.responseStrategy;
    document.getElementById('riskStatus').value = r.status;
    document.getElementById('riskMitigation').value = r.mitigation || '';
    document.getElementById('riskDueDate').value = r.dueDate || '';
  } else {
    document.getElementById('riskProbability').value = 3;
    document.getElementById('riskImpact').value = 3;
  }

  updatePriorityPreview();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('riskTitle').focus(), 30);
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('riskId').value;
  const title = document.getElementById('riskTitle').value.trim();
  if (!title) return;

  const payload = {
    title,
    description: document.getElementById('riskDescription').value.trim(),
    category: document.getElementById('riskCategory').value,
    owner: document.getElementById('riskOwner').value.trim(),
    probability: Number(document.getElementById('riskProbability').value),
    impact: Number(document.getElementById('riskImpact').value),
    responseStrategy: document.getElementById('riskResponseStrategy').value,
    status: document.getElementById('riskStatus').value,
    mitigation: document.getElementById('riskMitigation').value.trim(),
    dueDate: document.getElementById('riskDueDate').value,
  };

  if (id) {
    const idx = risks.findIndex(x => x.id === id);
    if (idx !== -1) {
      risks[idx] = { ...risks[idx], ...payload, updatedAt: Date.now() };
      showToast('Риск обновлён');
    }
  } else {
    risks.push({ id: uid(), ...payload, createdAt: Date.now(), updatedAt: Date.now() });
    showToast('Риск добавлен');
  }

  Store.save(risks);
  closeModal();
  renderAll();
}

function handleDelete() {
  const id = document.getElementById('riskId').value;
  if (!id) return;
  if (!confirm('Удалить этот риск? Действие нельзя отменить.')) return;
  risks = risks.filter(x => x.id !== id);
  Store.save(risks);
  closeModal();
  renderAll();
  showToast('Риск удалён');
}

/* ---------- Экспорт / импорт / очистка / пример ---------- */

function exportJson() {
  const blob = new Blob([JSON.stringify(risks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `risks-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('Ожидался массив рисков');
      const valid = data.filter(r => r && typeof r.title === 'string');
      const normalized = valid.map(r => ({
        id: r.id || uid(),
        title: r.title,
        description: r.description || '',
        category: CATEGORY_LABELS[r.category] ? r.category : 'other',
        owner: r.owner || '',
        probability: Math.min(5, Math.max(1, Number(r.probability) || 3)),
        impact: Math.min(5, Math.max(1, Number(r.impact) || 3)),
        responseStrategy: STRATEGY_LABELS[r.responseStrategy] ? r.responseStrategy : 'mitigate',
        status: STATUS_LABELS[r.status] ? r.status : 'open',
        mitigation: r.mitigation || '',
        dueDate: r.dueDate || '',
        createdAt: r.createdAt || Date.now(),
        updatedAt: r.updatedAt || Date.now(),
      }));
      risks = risks.concat(normalized);
      Store.save(risks);
      renderAll();
      showToast(`Импортировано рисков: ${normalized.length}`);
    } catch (err) {
      alert('Не удалось прочитать файл: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm('Удалить ВСЕ риски безвозвратно?')) return;
  risks = [];
  matrixFilter = null;
  Store.save(risks);
  renderAll();
  showToast('Все риски удалены');
}

function seedExample() {
  const today = new Date();
  const inDays = n => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const examples = [
    {
      title: 'Задержка поставки оборудования',
      description: 'Поставщик может не успеть доставить серверное оборудование к сроку монтажа.',
      category: 'external', owner: 'Иванов И.И.',
      probability: 4, impact: 4, responseStrategy: 'mitigate', status: 'in_progress',
      mitigation: 'Заключить резервный контракт со вторым поставщиком, ускорить оплату аванса.',
      dueDate: inDays(10),
    },
    {
      title: 'Недостаток квалифицированных разработчиков',
      description: 'Ключевые разработчики перегружены на других проектах.',
      category: 'resource', owner: 'Петрова А.С.',
      probability: 3, impact: 4, responseStrategy: 'transfer', status: 'open',
      mitigation: 'Привлечь подрядчика на часть задач, пересмотреть приоритеты найма.',
      dueDate: inDays(20),
    },
    {
      title: 'Превышение бюджета на инфраструктуру',
      description: 'Рост цен на облачные ресурсы может привести к перерасходу.',
      category: 'budget', owner: 'Смирнов К.В.',
      probability: 2, impact: 3, responseStrategy: 'accept', status: 'open',
      mitigation: 'Настроить алерты по расходам, зарезервировать 10% бюджета на непредвиденные расходы.',
      dueDate: inDays(30),
    },
    {
      title: 'Изменение требований заказчика',
      description: 'Заказчик может существенно изменить объём работ на середине проекта.',
      category: 'scope', owner: 'Кузнецова Е.П.',
      probability: 3, impact: 5, responseStrategy: 'mitigate', status: 'open',
      mitigation: 'Зафиксировать scope в договоре, ввести формальный процесс запроса изменений.',
      dueDate: inDays(15),
    },
    {
      title: 'Сбой в системе резервного копирования',
      description: 'Отсутствие проверенных бэкапов может привести к потере данных.',
      category: 'technical', owner: 'Смирнов К.В.',
      probability: 2, impact: 5, responseStrategy: 'mitigate', status: 'mitigated',
      mitigation: 'Настроено ежедневное автоматическое резервное копирование с проверкой восстановления.',
      dueDate: inDays(5),
    },
    {
      title: 'Отставание от графика на этапе тестирования',
      description: 'Недостаточно времени заложено на регрессионное тестирование.',
      category: 'schedule', owner: 'Иванов И.И.',
      probability: 4, impact: 2, responseStrategy: 'mitigate', status: 'open',
      mitigation: 'Автоматизировать часть регрессионных тестов, добавить буфер в график.',
      dueDate: inDays(12),
    },
    {
      title: 'Смена законодательных требований',
      description: 'Возможные изменения в регулировании отрасли повлияют на функциональность.',
      category: 'external', owner: 'Кузнецова Е.П.',
      probability: 1, impact: 3, responseStrategy: 'accept', status: 'closed',
      mitigation: 'Мониторинг изменений законодательства раз в квартал.',
      dueDate: '',
    },
  ];

  const now = Date.now();
  examples.forEach((ex, i) => {
    risks.push({ id: uid(), ...ex, createdAt: now - (examples.length - i) * 1000, updatedAt: now });
  });
  Store.save(risks);
  renderAll();
  showToast('Пример данных загружен');
}

/* ---------- Инициализация ---------- */

function init() {
  populateCategoryFilter();
  renderAll();

  document.getElementById('btnAddRisk').addEventListener('click', () => openModal(null));
  document.getElementById('btnAddRiskEmpty').addEventListener('click', () => openModal(null));
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);
  document.getElementById('btnDeleteRisk').addEventListener('click', handleDelete);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  form.addEventListener('submit', handleFormSubmit);
  document.getElementById('riskProbability').addEventListener('input', updatePriorityPreview);
  document.getElementById('riskImpact').addEventListener('input', updatePriorityPreview);

  document.getElementById('searchInput').addEventListener('input', renderList);
  document.getElementById('filterCategory').addEventListener('change', renderList);
  document.getElementById('filterPriority').addEventListener('change', renderList);
  document.getElementById('filterStatus').addEventListener('change', renderList);
  document.getElementById('sortBy').addEventListener('change', renderList);

  document.getElementById('btnClearMatrixFilter').addEventListener('click', () => {
    matrixFilter = null;
    renderAll();
  });

  document.getElementById('btnExport').addEventListener('click', exportJson);
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importJson(file);
    e.target.value = '';
  });
  document.getElementById('btnSeed').addEventListener('click', seedExample);
  document.getElementById('btnClearAll').addEventListener('click', clearAll);
}

document.addEventListener('DOMContentLoaded', init);
