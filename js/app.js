// Точка входа приложения: читает риски через storage.js, применяет текущий
// фильтр статуса, сортирует через модель и переключает между видом реестра
// и видом формы создания/редактирования риска.

import { getAll, addRisk, updateRisk } from './storage.js';
import { compareRisks, createRisk } from './risk-model.js';
import { renderRiskList } from './ui/risk-list.js';
import { renderRiskForm } from './ui/risk-form.js';
import { renderFilters, getStatusesForFilter, DEFAULT_FILTER } from './ui/filters.js';

function main() {
  const container = document.getElementById('risk-list-container');
  const filtersContainer = document.getElementById('filters-container');
  const addButton = document.getElementById('add-risk-btn');

  // Текущий выбранный режим фильтра — состояние текущей сессии приложения
  // (переменная модуля, не localStorage): переживает перерисовку страницы
  // внутри одной загрузки приложения, включая сохранение отредактированного
  // риска, но не переживает F5 — персистентность после перезагрузки в этом
  // шаге не требуется.
  let currentFilter = DEFAULT_FILTER;

  function loadAllRisks() {
    const result = getAll();
    // Отдельный экран для повреждённых данных — шаг 6. Здесь, чтобы не
    // падать и не перезаписывать хранилище, повреждённые данные на этом
    // шаге отображаются как пустой реестр.
    return result.status === 'ok' ? result.risks : [];
  }

  function resetFilter() {
    currentFilter = DEFAULT_FILTER;
    showList();
  }

  function showList() {
    const allRisks = loadAllRisks();
    const isStoreEmpty = allRisks.length === 0;
    const statusesForFilter = getStatusesForFilter(currentFilter);
    const filteredRisks = allRisks
      .filter((risk) => statusesForFilter.includes(risk.status))
      .sort(compareRisks);

    // Постоянная кнопка и панель фильтра дублировали бы пустое состояние
    // реестра, пока хранилище действительно пусто — показываются, как
    // только в хранилище появляется хотя бы один риск, независимо от того,
    // что показывает текущий фильтр.
    addButton.hidden = isStoreEmpty;
    filtersContainer.hidden = isStoreEmpty;

    renderFilters(filtersContainer, {
      current: currentFilter,
      onChange: (value) => {
        currentFilter = value;
        showList();
      },
      onReset: resetFilter,
    });

    renderRiskList(container, filteredRisks, {
      onCreateFirst: showCreateForm,
      onEdit: showEditForm,
      onResetFilters: resetFilter,
      isStoreEmpty,
    });
  }

  function showCreateForm() {
    addButton.hidden = true;
    filtersContainer.hidden = true;
    renderRiskForm(container, {
      onSubmit: (data) => {
        addRisk(createRisk(data));
        showList();
      },
      onCancel: showList,
    });
  }

  function showEditForm(id) {
    const result = getAll();
    const risk = result.status === 'ok' ? result.risks.find((item) => item.id === id) : undefined;
    if (!risk) {
      showList();
      return;
    }

    addButton.hidden = true;
    filtersContainer.hidden = true;
    renderRiskForm(container, {
      risk,
      onSubmit: (data) => {
        updateRisk(id, data);
        showList();
      },
      onCancel: showList,
    });
  }

  addButton.addEventListener('click', showCreateForm);
  showList();
}

main();
