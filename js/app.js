// Точка входа приложения: читает риски через storage.js, применяет текущий
// фильтр статуса, сортирует через модель и переключает между видом реестра
// и видом формы создания/редактирования риска.

import { getAll, addRisk, updateRisk, deleteRisk, resetStorage } from './storage.js';
import { compareRisks, createRisk } from './risk-model.js';
import { renderRiskList } from './ui/risk-list.js';
import { renderRiskForm } from './ui/risk-form.js';
import { renderFilters, getStatusesForFilter, DEFAULT_FILTER } from './ui/filters.js';
import { renderDataError } from './ui/data-error.js';

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

  function resetFilter() {
    currentFilter = DEFAULT_FILTER;
    showList();
  }

  // Вызывается только после подтверждения в диалоге data-error.js — сам
  // клик по кнопке «Сбросить данные» диалог не обходит.
  function handleResetData() {
    resetStorage();
    showList();
  }

  // Вызывается только после подтверждения в диалоге risk-list.js — сам клик
  // по кнопке «Удалить» в строке deleteRisk() не вызывает.
  function handleDelete(id) {
    deleteRisk(id);
    showList();
  }

  function showList() {
    const result = getAll();

    if (result.status === 'corrupted') {
      // Повреждённые или неподдерживаемые данные — реестр, фильтры и кнопки
      // создания скрываются целиком, вместо них экран ошибки с кнопкой
      // сброса (сама localStorage не трогается, пока пользователь не
      // подтвердит сброс в отдельном диалоге).
      addButton.hidden = true;
      filtersContainer.hidden = true;
      renderDataError(container, { onReset: handleResetData });
      return;
    }

    const allRisks = result.risks;
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
      onDelete: handleDelete,
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
