// Точка входа приложения: читает риски через storage.js, оставляет только
// активные статусы по умолчанию, сортирует через модель и переключает между
// видом реестра и видом формы создания/редактирования риска.

import { getAll, addRisk, updateRisk } from './storage.js';
import { compareRisks, createRisk } from './risk-model.js';
import { renderRiskList } from './ui/risk-list.js';
import { renderRiskForm } from './ui/risk-form.js';

const ACTIVE_STATUSES = ['open', 'in_progress', 'monitoring'];

function main() {
  const container = document.getElementById('risk-list-container');
  const addButton = document.getElementById('add-risk-btn');

  function loadActiveRisks() {
    const result = getAll();
    // Отдельный экран для повреждённых данных — шаг 6. Здесь, чтобы не
    // падать и не перезаписывать хранилище, повреждённые данные на этом
    // шаге отображаются как пустой реестр.
    const risks = result.status === 'ok' ? result.risks : [];
    return risks.filter((risk) => ACTIVE_STATUSES.includes(risk.status)).sort(compareRisks);
  }

  function showList() {
    const risks = loadActiveRisks();
    // Постоянная кнопка дублировала бы кнопку пустого состояния, пока в
    // отображаемом реестре нет ни одного риска — показывается только после
    // появления хотя бы одной записи.
    addButton.hidden = risks.length === 0;
    renderRiskList(container, risks, {
      onCreateFirst: showCreateForm,
      onEdit: showEditForm,
    });
  }

  function showCreateForm() {
    addButton.hidden = true;
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
