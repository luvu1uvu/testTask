// Слой хранения поверх модели риска: чтение/запись localStorage с
// версионированием и атомарной проверкой повреждённых данных. Без DOM.

import { validateRiskRecord } from './risk-model.js';

export const STORAGE_KEY = 'project-risk-tracker:v1';
const STORAGE_VERSION = 1;

// Бросается CRUD-операциями, когда под ключом хранения найдены повреждённые
// данные — операция отказывается писать поверх них, чтобы не потерять
// возможность диагностировать и явно сбросить повреждённый набор.
export class StorageCorruptedError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'StorageCorruptedError';
    this.reason = reason;
  }
}

function corrupted(reason, message) {
  return { status: 'corrupted', reason, message };
}

function describeVersion(version) {
  return version === undefined ? 'отсутствует' : JSON.stringify(version);
}

// Читает и полностью проверяет данные по ключу, не изменяя localStorage.
// Три возможных статуса результата:
//   'empty'     — ключа нет вовсе, это валидное состояние «реестр пуст»
//                 (первый запуск), а не повреждение;
//   'ok'        — данные читаемы и полностью валидны, risks — проверенный
//                 массив записей;
//   'corrupted' — набор считается повреждённым целиком (неподдерживаемая
//                 версия, битый JSON, неверный тип risks либо хотя бы одна
//                 невалидная запись) — без частичного восстановления
//                 отдельных записей, согласовано в PLAN.md/шаг 2.
export function load(key = STORAGE_KEY) {
  const raw = localStorage.getItem(key);

  if (raw === null) {
    return { status: 'empty', risks: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return corrupted('invalid_json', 'Сохранённые данные повреждены: невалидный JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return corrupted('invalid_shape', 'Сохранённые данные повреждены: ожидался объект вида { version, risks }');
  }

  if (parsed.version !== STORAGE_VERSION) {
    return corrupted(
      'invalid_version',
      `Сохранённые данные имеют неподдерживаемую версию: ${describeVersion(parsed.version)}`,
    );
  }

  if (!Array.isArray(parsed.risks)) {
    return corrupted('invalid_risks_type', 'Сохранённые данные повреждены: поле risks не является массивом');
  }

  for (const record of parsed.risks) {
    if (!validateRiskRecord(record).valid) {
      return corrupted('invalid_record', 'Сохранённые данные повреждены: найдена невалидная запись риска');
    }
  }

  return { status: 'ok', risks: parsed.risks };
}

// Публичный alias для load() — используется там, где интерфейсу или CRUD
// нужен «список рисков» с тем же неавтоматическим (без throw) статусом.
// Имя выбрано по симметрии с addRisk/updateRisk/deleteRisk.
export function getAll(key = STORAGE_KEY) {
  return load(key);
}

// Записывает список рисков. Проверяет весь контракт перед записью и не
// трогает localStorage, если проверка не пройдена:
//   - risks должен быть массивом;
//   - каждая запись должна проходить validateRiskRecord() (в т.ч. запрет
//     сохранённых score/priority);
//   - если по key уже лежат повреждённые данные, save() отказывается их
//     молча перезаписывать валидным набором — сначала нужен явный
//     resetStorage(), иначе теряется сигнал о том, что данные были
//     повреждены.
export function save(risks, key = STORAGE_KEY) {
  if (!Array.isArray(risks)) {
    throw new Error('save() ожидает массив записей риска');
  }

  for (const record of risks) {
    const validation = validateRiskRecord(record);
    if (!validation.valid) {
      throw new Error(`Нельзя сохранить невалидную запись риска: ${JSON.stringify(validation.errors)}`);
    }
  }

  const current = load(key);
  if (current.status === 'corrupted') {
    throw new StorageCorruptedError(current.message, current.reason);
  }

  localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, risks }));
}

// Внутренний helper для CRUD: читает текущий валидный список рисков или
// бросает StorageCorruptedError — используется, чтобы add/update/delete
// не могли молча перезаписать повреждённый набор данными из этой операции.
function readOrThrow(key) {
  const result = load(key);
  if (result.status === 'corrupted') {
    throw new StorageCorruptedError(result.message, result.reason);
  }
  return result.risks;
}

// Добавляет уже сформированную запись риска (например, результат
// createRisk() из risk-model.js) в хранилище. save() сама проверяет запись
// через validateRiskRecord() перед записью — хранилище не может сохранить
// запись без id/дат или с вычисленными score/priority.
export function addRisk(record, key = STORAGE_KEY) {
  const risks = readOrThrow(key);
  save([...risks, record], key);
  return record;
}

// Возвращает ISO-время строго позже previousIso. Если системные часы дали
// то же самое или более раннее значение (два обновления в одну и ту же
// миллисекунду — на практике встречается при быстрых последовательных
// updateRisk()), время принудительно сдвигается на 1мс вперёд, чтобы
// updatedAt оставался строго монотонным индикатором порядка изменений.
function nextUpdatedAt(previousIso) {
  const now = new Date();
  const previousMs = Date.parse(previousIso);
  if (now.getTime() <= previousMs) {
    return new Date(previousMs + 1).toISOString();
  }
  return now.toISOString();
}

// Обновляет риск по id. updates — частичные редактируемые поля
// (title/description/probability/impact/measure/responsible/status);
// id/createdAt/updatedAt из updates игнорируются намеренно — id и
// createdAt существующей записи сохраняются, updatedAt проставляется
// заново и всегда строго позже предыдущего updatedAt. save() проверяет
// итоговую запись через validateRiskRecord() перед записью.
export function updateRisk(id, updates, key = STORAGE_KEY) {
  const risks = readOrThrow(key);
  const index = risks.findIndex((risk) => risk.id === id);
  if (index === -1) {
    throw new Error(`Риск с id ${id} не найден`);
  }

  const existing = risks[index];
  const { id: _ignoredId, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, ...editable } = updates ?? {};

  const merged = {
    ...existing,
    ...editable,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: nextUpdatedAt(existing.updatedAt),
  };

  const next = [...risks];
  next[index] = merged;
  save(next, key);
  return merged;
}

// Удаляет риск по id. Если id не найден — бросает ошибку, чтобы вызывающий
// код не принял отсутствие изменений за успешное удаление.
export function deleteRisk(id, key = STORAGE_KEY) {
  const risks = readOrThrow(key);
  const next = risks.filter((risk) => risk.id !== id);
  if (next.length === risks.length) {
    throw new Error(`Риск с id ${id} не найден`);
  }
  save(next, key);
}

// Явный сброс данных по ключу. Вызывается только по прямому действию
// вызывающего кода (например, подтверждённая пользователем кнопка сброса
// в будущем UI) — никогда не вызывается автоматически при обнаружении
// повреждения данных внутри load()/readOrThrow().
export function resetStorage(key = STORAGE_KEY) {
  localStorage.removeItem(key);
}
