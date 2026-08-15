// Точка входа приложения: читает риски через storage.js, оставляет только
// активные статусы по умолчанию, сортирует через модель и рендерит реестр.

import { getAll } from './storage.js';
import { compareRisks } from './risk-model.js';
import { renderRiskList } from './ui/risk-list.js';

const ACTIVE_STATUSES = ['open', 'in_progress', 'monitoring'];

function main() {
  const container = document.getElementById('risk-list-container');
  const result = getAll();

  // Отдельный экран для повреждённых данных — шаг 6. Здесь, чтобы не падать
  // и не перезаписывать хранилище, повреждённые данные на этом шаге
  // отображаются как пустой реестр.
  const risks = result.status === 'ok' ? result.risks : [];

  const activeRisks = risks
    .filter((risk) => ACTIVE_STATUSES.includes(risk.status))
    .sort(compareRisks);

  renderRiskList(container, activeRisks);
}

main();
