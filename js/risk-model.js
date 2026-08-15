// Модель риска: чистые функции над данными, без DOM и localStorage.

export const STATUS_CODES = Object.freeze([
  'open',
  'in_progress',
  'monitoring',
  'realized',
  'closed',
]);

// Единая таблица соответствия внутренних кодов статуса русским подписям.
// Используется и валидацией (здесь), и интерфейсом (в будущих шагах) —
// правится только текст подписи, внутренний код данных не меняется.
export const STATUS_LABELS = Object.freeze({
  open: 'Открыт',
  in_progress: 'В работе',
  monitoring: 'Под наблюдением',
  realized: 'Реализовался',
  closed: 'Закрыт',
});

export const PRIORITY_CODES = Object.freeze(['low', 'medium', 'high', 'critical']);

export const PRIORITY_LABELS = Object.freeze({
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
});

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 1000;
const MEASURE_MAX_LENGTH = 1000;
const RESPONSIBLE_MAX_LENGTH = 100;

export function isValidStatus(status) {
  return STATUS_CODES.includes(status);
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status];
}

export function calculateScore(probability, impact) {
  return probability * impact;
}

export function getPriorityLevel(score) {
  if (score >= 16) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function getPriorityLabel(score) {
  return PRIORITY_LABELS[getPriorityLevel(score)];
}

// Фабрика создания риска: новый риск всегда открыт, id и даты
// проставляются здесь и не принимаются извне.
export function createRisk({
  title,
  description,
  probability,
  impact,
  measure = '',
  responsible = '',
} = {}) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    description,
    probability,
    impact,
    measure,
    responsible,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

// Сортировка реестра: балл ↓, затем влияние ↓, затем более новый риск выше.
export function compareRisks(a, b) {
  const scoreA = calculateScore(a.probability, a.impact);
  const scoreB = calculateScore(b.probability, b.impact);
  if (scoreB !== scoreA) return scoreB - scoreA;
  if (b.impact !== a.impact) return b.impact - a.impact;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function trimmedOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Строка только из пробелов считается пустой — сравнение идёт по длине
// после trim, а не по исходной длине значения.
function isBlank(value) {
  return trimmedOrEmpty(value).length === 0;
}

function isValidScaleValue(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

// Отличает обычный объект от null/массива/примитива — используется, чтобы
// validateRisk/validateRiskRecord не бросали исключение на мусорном входе.
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Строгая ISO-строка в формате Date.prototype.toISOString() (именно так её
// проставляет createRisk). Раунд-трип через Date отсеивает синтаксически
// похожие, но фактически несуществующие даты (например, 31 февраля).
function isIsoDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
}

// Валидация полей риска (используется и формой, и validateRiskRecord).
// Обязательность меры и ответственного зависит от data.status: включается
// только когда статус — 'in_progress'. Статус обязателен всегда: без него
// нельзя решить, требуются ли мера и ответственный.
// Устойчива к мусорному входу (null/undefined/строка/массив) — в этом
// случае возвращает невалидный результат, а не бросает исключение.
export function validateRisk(data) {
  if (!isPlainObject(data)) {
    return { valid: false, errors: { _record: 'Данные риска должны быть объектом' } };
  }

  const errors = {};

  if (isBlank(data.title)) {
    errors.title = 'Укажите название риска';
  } else {
    const length = trimmedOrEmpty(data.title).length;
    if (length < TITLE_MIN_LENGTH || length > TITLE_MAX_LENGTH) {
      errors.title = `Название должно содержать от ${TITLE_MIN_LENGTH} до ${TITLE_MAX_LENGTH} символов`;
    }
  }

  if (isBlank(data.description)) {
    errors.description = 'Добавьте описание длиной не менее 10 символов';
  } else {
    const length = trimmedOrEmpty(data.description).length;
    if (length < DESCRIPTION_MIN_LENGTH || length > DESCRIPTION_MAX_LENGTH) {
      errors.description = `Описание должно содержать от ${DESCRIPTION_MIN_LENGTH} до ${DESCRIPTION_MAX_LENGTH} символов`;
    }
  }

  if (!isValidScaleValue(data.probability)) {
    errors.probability = 'Выберите вероятность';
  }

  if (!isValidScaleValue(data.impact)) {
    errors.impact = 'Выберите влияние';
  }

  const requiresMeasureAndResponsible = data.status === 'in_progress';
  const measureLength = trimmedOrEmpty(data.measure).length;
  const responsibleLength = trimmedOrEmpty(data.responsible).length;

  if (requiresMeasureAndResponsible && isBlank(data.measure)) {
    errors.measure = 'Укажите меру реагирования для риска в работе';
  } else if (measureLength > MEASURE_MAX_LENGTH) {
    errors.measure = `Мера реагирования не должна превышать ${MEASURE_MAX_LENGTH} символов`;
  }

  if (requiresMeasureAndResponsible && isBlank(data.responsible)) {
    errors.responsible = 'Укажите ответственного для риска в работе';
  } else if (responsibleLength > RESPONSIBLE_MAX_LENGTH) {
    errors.responsible = `Ответственный не должен превышать ${RESPONSIBLE_MAX_LENGTH} символов`;
  }

  if (!isValidStatus(data.status)) {
    errors.status = 'Недопустимый статус риска';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Полноценная проверка сохранённой записи риска (id, даты, отсутствие
// вычисляемых полей) поверх правил полей из validateRisk. Предназначена
// для storage.js на следующем шаге: там нужно отличать «одна запись
// повреждена» от «поле формы не заполнено», не бросая исключений на
// произвольном содержимом localStorage.
export function validateRiskRecord(record) {
  if (!isPlainObject(record)) {
    return { valid: false, errors: { _record: 'Запись риска должна быть объектом' } };
  }

  const errors = {};

  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    errors.id = 'Отсутствует или пуст идентификатор риска';
  }

  const stringFields = ['title', 'description', 'measure', 'responsible'];
  for (const field of stringFields) {
    if (typeof record[field] !== 'string') {
      errors[field] = `Поле «${field}» должно быть строкой`;
    }
  }

  // Правила длины/обязательности/допустимых значений — общие с формой.
  // Не переопределяем уже найденную ошибку типа более общим сообщением.
  const fieldValidation = validateRisk(record);
  for (const [field, message] of Object.entries(fieldValidation.errors)) {
    if (errors[field] === undefined) {
      errors[field] = message;
    }
  }

  for (const dateField of ['createdAt', 'updatedAt']) {
    if (!isIsoDateString(record[dateField])) {
      errors[dateField] = `Поле «${dateField}» должно быть корректной ISO-датой`;
    }
  }

  if (
    errors.createdAt === undefined &&
    errors.updatedAt === undefined &&
    Date.parse(record.updatedAt) < Date.parse(record.createdAt)
  ) {
    errors.updatedAt = 'updatedAt не может быть раньше createdAt';
  }

  if ('score' in record) {
    errors.score = 'Запись не должна содержать сохранённый балл — он вычисляется';
  }

  if ('priority' in record) {
    errors.priority = 'Запись не должна содержать сохранённый приоритет — он вычисляется';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
