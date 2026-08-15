import {
  STATUS_CODES,
  STATUS_LABELS,
  PRIORITY_LABELS,
  isValidStatus,
  getStatusLabel,
  calculateScore,
  getPriorityLevel,
  getPriorityLabel,
  createRisk,
  compareRisks,
  validateRisk,
  validateRiskRecord,
} from '../risk-model.js';

const EXPECTED_STATUS_LABELS = {
  open: 'Открыт',
  in_progress: 'В работе',
  monitoring: 'Под наблюдением',
  realized: 'Реализовался',
  closed: 'Закрыт',
};

function validRiskData(overrides = {}) {
  return {
    title: 'Задержка поставки оборудования',
    description: 'Поставщик может не успеть к согласованному сроку.',
    probability: 3,
    impact: 4,
    measure: '',
    responsible: '',
    status: 'open',
    ...overrides,
  };
}

export function registerRiskModelTests(test, assert) {
  // --- Статусы и таблица подписей ---

  test('STATUS_CODES содержит ровно 5 внутренних кодов', () => {
    assert.strictEqual(STATUS_CODES.length, 5);
    assert.deepEqual(
      [...STATUS_CODES].sort(),
      ['closed', 'in_progress', 'monitoring', 'open', 'realized'].sort(),
    );
  });

  test('STATUS_LABELS покрывает все 5 кодов верными русскими подписями', () => {
    for (const code of STATUS_CODES) {
      assert.strictEqual(STATUS_LABELS[code], EXPECTED_STATUS_LABELS[code]);
    }
    assert.deepEqual(Object.keys(STATUS_LABELS).sort(), [...STATUS_CODES].sort());
  });

  test('getStatusLabel возвращает подпись по коду', () => {
    assert.strictEqual(getStatusLabel('open'), 'Открыт');
    assert.strictEqual(getStatusLabel('in_progress'), 'В работе');
    assert.strictEqual(getStatusLabel('monitoring'), 'Под наблюдением');
    assert.strictEqual(getStatusLabel('realized'), 'Реализовался');
    assert.strictEqual(getStatusLabel('closed'), 'Закрыт');
  });

  test('isValidStatus принимает все 5 кодов', () => {
    for (const code of STATUS_CODES) {
      assert.ok(isValidStatus(code), `код ${code} должен быть валиден`);
    }
  });

  test('isValidStatus отклоняет русскую подпись вместо кода', () => {
    assert.ok(!isValidStatus('Открыт'));
    assert.ok(!isValidStatus('В работе'));
  });

  test('isValidStatus отклоняет произвольный мусор', () => {
    assert.ok(!isValidStatus(''));
    assert.ok(!isValidStatus(undefined));
    assert.ok(!isValidStatus(null));
    assert.ok(!isValidStatus('unknown_status'));
  });

  // --- Балл и приоритет ---

  test('calculateScore считает произведение вероятности и влияния', () => {
    assert.strictEqual(calculateScore(5, 5), 25);
    assert.strictEqual(calculateScore(1, 1), 1);
    assert.strictEqual(calculateScore(3, 4), 12);
  });

  test('границы уровней приоритета: 4 — низкий', () => {
    assert.strictEqual(getPriorityLevel(4), 'low');
    assert.strictEqual(getPriorityLabel(4), 'Низкий');
  });

  test('границы уровней приоритета: 5 — средний', () => {
    assert.strictEqual(getPriorityLevel(5), 'medium');
    assert.strictEqual(getPriorityLabel(5), 'Средний');
  });

  test('границы уровней приоритета: 9 — средний', () => {
    assert.strictEqual(getPriorityLevel(9), 'medium');
    assert.strictEqual(getPriorityLabel(9), 'Средний');
  });

  test('границы уровней приоритета: 10 — высокий', () => {
    assert.strictEqual(getPriorityLevel(10), 'high');
    assert.strictEqual(getPriorityLabel(10), 'Высокий');
  });

  test('границы уровней приоритета: 15 — высокий', () => {
    assert.strictEqual(getPriorityLevel(15), 'high');
    assert.strictEqual(getPriorityLabel(15), 'Высокий');
  });

  test('границы уровней приоритета: 16 — критический', () => {
    assert.strictEqual(getPriorityLevel(16), 'critical');
    assert.strictEqual(getPriorityLabel(16), 'Критический');
  });

  test('риск 5×5 получает балл 25 и приоритет «Критический»', () => {
    const score = calculateScore(5, 5);
    assert.strictEqual(score, 25);
    assert.strictEqual(getPriorityLabel(score), 'Критический');
  });

  test('PRIORITY_LABELS содержит все 4 уровня', () => {
    assert.deepEqual(Object.keys(PRIORITY_LABELS).sort(), ['critical', 'high', 'low', 'medium'].sort());
  });

  // --- Фабрика createRisk ---

  test('createRisk ставит статус open и совпадающие ISO-даты создания/обновления', () => {
    const risk = createRisk(validRiskData());
    assert.strictEqual(risk.status, 'open');
    assert.strictEqual(risk.createdAt, risk.updatedAt);
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(risk.createdAt),
      `createdAt должен быть в формате ISO, получено: ${risk.createdAt}`,
    );
  });

  test('createRisk проставляет непустой id', () => {
    const risk = createRisk(validRiskData());
    assert.ok(typeof risk.id === 'string' && risk.id.length > 0);
  });

  test('объект риска не содержит полей балла и приоритета', () => {
    const risk = createRisk(validRiskData());
    assert.ok(!('score' in risk), 'риск не должен хранить score');
    assert.ok(!('priority' in risk), 'риск не должен хранить priority');
  });

  test('1000 последовательно созданных рисков получают 1000 уникальных id', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i += 1) {
      const risk = createRisk(validRiskData({ title: `Риск №${i}` }));
      ids.add(risk.id);
    }
    assert.strictEqual(ids.size, 1000);
  });

  // --- Сортировка ---

  test('compareRisks: больший балл выше', () => {
    const low = createRisk(validRiskData({ probability: 1, impact: 1 }));
    const high = createRisk(validRiskData({ probability: 5, impact: 5 }));
    assert.ok(compareRisks(high, low) < 0);
    assert.ok(compareRisks(low, high) > 0);
  });

  test('compareRisks: при равном балле выше риск с большим влиянием', () => {
    // балл 12 у обоих: 3×4 и 4×3
    const strongerImpact = createRisk(validRiskData({ probability: 3, impact: 4 }));
    const weakerImpact = createRisk(validRiskData({ probability: 4, impact: 3 }));
    assert.ok(compareRisks(strongerImpact, weakerImpact) < 0);
  });

  test('compareRisks: при равном балле и влиянии выше более новый (по createdAt)', () => {
    const older = createRisk(validRiskData({ probability: 2, impact: 3 }));
    older.createdAt = '2026-01-01T00:00:00.000Z';
    older.updatedAt = older.createdAt;
    const newer = createRisk(validRiskData({ probability: older.probability, impact: older.impact }));
    newer.createdAt = '2026-06-01T00:00:00.000Z';
    newer.updatedAt = newer.createdAt;
    assert.ok(compareRisks(newer, older) < 0);
  });

  test('compareRisks корректно сортирует смешанный массив рисков', () => {
    const a = createRisk(validRiskData({ probability: 1, impact: 1 })); // балл 1
    const b = createRisk(validRiskData({ probability: 5, impact: 5 })); // балл 25
    const c = createRisk(validRiskData({ probability: 3, impact: 4 })); // балл 12
    const d = createRisk(validRiskData({ probability: 4, impact: 3 })); // балл 12, влияние меньше
    const sorted = [a, b, c, d].sort(compareRisks);
    assert.deepEqual(
      sorted.map((risk) => risk.id),
      [b, c, d, a].map((risk) => risk.id),
    );
  });

  // --- Валидация: название ---

  test('валидация: пустое название отклоняется с нужным сообщением', () => {
    const { valid, errors } = validateRisk(validRiskData({ title: '' }));
    assert.ok(!valid);
    assert.strictEqual(errors.title, 'Укажите название риска');
  });

  test('валидация: название из одних пробелов считается пустым', () => {
    const { valid, errors } = validateRisk(validRiskData({ title: '     ' }));
    assert.ok(!valid);
    assert.strictEqual(errors.title, 'Укажите название риска');
  });

  test('валидация: название короче 3 символов после trim отклоняется', () => {
    const { valid, errors } = validateRisk(validRiskData({ title: '  ab  ' }));
    assert.ok(!valid);
    assert.ok(errors.title && errors.title.includes('от 3 до 120'));
  });

  test('валидация: название длиной ровно 3 символа проходит', () => {
    const { valid, errors } = validateRisk(validRiskData({ title: 'abc' }));
    assert.ok(errors.title === undefined);
  });

  test('валидация: название длиной ровно 120 символов проходит', () => {
    const { errors } = validateRisk(validRiskData({ title: 'a'.repeat(120) }));
    assert.ok(errors.title === undefined);
  });

  test('валидация: название длиной 121 символ отклоняется', () => {
    const { valid, errors } = validateRisk(validRiskData({ title: 'a'.repeat(121) }));
    assert.ok(!valid);
    assert.ok(errors.title && errors.title.includes('от 3 до 120'));
  });

  // --- Валидация: описание ---

  test('валидация: пустое описание отклоняется', () => {
    const { valid, errors } = validateRisk(validRiskData({ description: '' }));
    assert.ok(!valid);
    assert.ok(errors.description);
  });

  test('валидация: описание из одних пробелов считается пустым', () => {
    const { valid, errors } = validateRisk(validRiskData({ description: '   \n  ' }));
    assert.ok(!valid);
    assert.ok(errors.description);
  });

  test('валидация: описание длиной 9 символов отклоняется', () => {
    const { valid, errors } = validateRisk(validRiskData({ description: 'a'.repeat(9) }));
    assert.ok(!valid);
    assert.ok(errors.description && errors.description.includes('от 10 до 1000'));
  });

  test('валидация: описание длиной ровно 10 символов проходит', () => {
    const { errors } = validateRisk(validRiskData({ description: 'a'.repeat(10) }));
    assert.ok(errors.description === undefined);
  });

  test('валидация: описание длиной ровно 1000 символов проходит', () => {
    const { errors } = validateRisk(validRiskData({ description: 'a'.repeat(1000) }));
    assert.ok(errors.description === undefined);
  });

  test('валидация: описание длиной 1001 символ отклоняется', () => {
    const { valid, errors } = validateRisk(validRiskData({ description: 'a'.repeat(1001) }));
    assert.ok(!valid);
    assert.ok(errors.description && errors.description.includes('от 10 до 1000'));
  });

  // --- Валидация: вероятность и влияние ---

  test('валидация: вероятность и влияние вне 1–5 отклоняются', () => {
    for (const value of [0, 6, -1, 3.5, null, undefined, 'a', NaN]) {
      const { valid, errors } = validateRisk(validRiskData({ probability: value }));
      assert.ok(!valid, `probability=${value} должно быть невалидно`);
      assert.strictEqual(errors.probability, 'Выберите вероятность');

      const { valid: validImpact, errors: errorsImpact } = validateRisk(validRiskData({ impact: value }));
      assert.ok(!validImpact, `impact=${value} должно быть невалидно`);
      assert.strictEqual(errorsImpact.impact, 'Выберите влияние');
    }
  });

  test('валидация: вероятность и влияние 1 и 5 (границы) проходят', () => {
    const { errors: e1 } = validateRisk(validRiskData({ probability: 1, impact: 1 }));
    assert.ok(e1.probability === undefined && e1.impact === undefined);
    const { errors: e2 } = validateRisk(validRiskData({ probability: 5, impact: 5 }));
    assert.ok(e2.probability === undefined && e2.impact === undefined);
  });

  // --- Валидация: мера и ответственный ---

  test('валидация: мера и ответственный не обязательны при статусе open', () => {
    const { valid } = validateRisk(validRiskData({ status: 'open', measure: '', responsible: '' }));
    assert.ok(valid);
  });

  test('валидация: статус in_progress без меры и ответственного блокируется', () => {
    const { valid, errors } = validateRisk(
      validRiskData({ status: 'in_progress', measure: '', responsible: '' }),
    );
    assert.ok(!valid);
    assert.strictEqual(errors.measure, 'Укажите меру реагирования для риска в работе');
    assert.strictEqual(errors.responsible, 'Укажите ответственного для риска в работе');
  });

  test('валидация: статус in_progress с мерой из пробелов всё равно блокируется', () => {
    const { valid, errors } = validateRisk(
      validRiskData({ status: 'in_progress', measure: '   ', responsible: '   ' }),
    );
    assert.ok(!valid);
    assert.ok(errors.measure);
    assert.ok(errors.responsible);
  });

  test('валидация: статус in_progress с заполненными мерой и ответственным проходит', () => {
    const { valid, errors } = validateRisk(
      validRiskData({ status: 'in_progress', measure: 'Согласовать резервного поставщика', responsible: 'Иванов И.И.' }),
    );
    assert.ok(valid);
    assert.strictEqual(errors.measure, undefined);
    assert.strictEqual(errors.responsible, undefined);
  });

  test('валидация: мера длиной 1000 символов проходит, 1001 отклоняется', () => {
    const ok = validateRisk(validRiskData({ status: 'open', measure: 'a'.repeat(1000) }));
    assert.ok(ok.errors.measure === undefined);
    const tooLong = validateRisk(validRiskData({ status: 'open', measure: 'a'.repeat(1001) }));
    assert.ok(tooLong.errors.measure !== undefined);
  });

  test('валидация: ответственный длиной 100 символов проходит, 101 отклоняется', () => {
    const ok = validateRisk(validRiskData({ status: 'open', responsible: 'a'.repeat(100) }));
    assert.ok(ok.errors.responsible === undefined);
    const tooLong = validateRisk(validRiskData({ status: 'open', responsible: 'a'.repeat(101) }));
    assert.ok(tooLong.errors.responsible !== undefined);
  });

  // --- Валидация: статус ---

  test('валидация: русская подпись статуса вместо кода отклоняется', () => {
    const { valid, errors } = validateRisk(validRiskData({ status: 'Открыт' }));
    assert.ok(!valid);
    assert.ok(errors.status);
  });

  test('валидация: отсутствующий статус отклоняется', () => {
    const data = validRiskData();
    delete data.status;
    const { valid, errors } = validateRisk(data);
    assert.ok(!valid);
    assert.ok(errors.status);
  });

  test('валидация: полностью корректный риск проходит без ошибок', () => {
    const { valid, errors } = validateRisk(validRiskData());
    assert.ok(valid);
    assert.deepEqual(errors, {});
  });

  // --- validateRisk: устойчивость к мусорному входу ---

  test('validateRisk(null) не бросает исключение и возвращает невалидный результат', () => {
    const { valid, errors } = validateRisk(null);
    assert.ok(!valid);
    assert.ok(errors && Object.keys(errors).length > 0);
  });

  test('validateRisk(undefined) не бросает исключение и возвращает невалидный результат', () => {
    const { valid, errors } = validateRisk(undefined);
    assert.ok(!valid);
    assert.ok(errors && Object.keys(errors).length > 0);
  });

  test('validateRisk(строка) не бросает исключение и возвращает невалидный результат', () => {
    const { valid } = validateRisk('не объект');
    assert.ok(!valid);
  });

  test('validateRisk(массив) не бросает исключение и возвращает невалидный результат', () => {
    const { valid } = validateRisk([1, 2, 3]);
    assert.ok(!valid);
  });

  // --- validateRiskRecord: полноценная проверка сохранённой записи ---

  test('validateRiskRecord: корректный результат createRisk() проходит полную проверку', () => {
    const risk = createRisk(validRiskData());
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(valid, `ожидалась валидная запись, ошибки: ${JSON.stringify(errors)}`);
    assert.deepEqual(errors, {});
  });

  test('validateRiskRecord(null/undefined/строка/массив) отклоняются без исключения', () => {
    for (const garbage of [null, undefined, 'не объект', [1, 2, 3]]) {
      const { valid } = validateRiskRecord(garbage);
      assert.ok(!valid, `значение ${JSON.stringify(garbage)} должно быть отклонено`);
    }
  });

  test('validateRiskRecord: отсутствующий статус отклоняется', () => {
    const risk = createRisk(validRiskData());
    delete risk.status;
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.status);
  });

  test('validateRiskRecord: неизвестный статус отклоняется', () => {
    const risk = createRisk(validRiskData());
    risk.status = 'archived';
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.status);
  });

  test('validateRiskRecord: отсутствующий id отклоняется', () => {
    const risk = createRisk(validRiskData());
    delete risk.id;
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.id);
  });

  test('validateRiskRecord: пустой id (в т.ч. из пробелов) отклоняется', () => {
    const risk = createRisk(validRiskData());
    risk.id = '   ';
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.id);
  });

  test('validateRiskRecord: отсутствующие даты отклоняются', () => {
    const risk = createRisk(validRiskData());
    delete risk.createdAt;
    delete risk.updatedAt;
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.createdAt);
    assert.ok(errors.updatedAt);
  });

  test('validateRiskRecord: невалидные даты (не ISO, не существующие) отклоняются', () => {
    const risk = createRisk(validRiskData());
    risk.createdAt = '15.08.2026';
    risk.updatedAt = '2026-02-30T00:00:00.000Z';
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.createdAt);
    assert.ok(errors.updatedAt);
  });

  test('validateRiskRecord: updatedAt раньше createdAt отклоняется', () => {
    const risk = createRisk(validRiskData());
    risk.createdAt = '2026-06-01T00:00:00.000Z';
    risk.updatedAt = '2026-01-01T00:00:00.000Z';
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.updatedAt);
  });

  test('validateRiskRecord: неверный тип title/description/measure/responsible отклоняется', () => {
    for (const field of ['title', 'description', 'measure', 'responsible']) {
      const risk = createRisk(validRiskData());
      risk[field] = 12345;
      const { valid, errors } = validateRiskRecord(risk);
      assert.ok(!valid, `поле ${field} с числом вместо строки должно быть отклонено`);
      assert.ok(errors[field], `ожидалась ошибка для поля ${field}`);
    }
  });

  test('validateRiskRecord: неверные вероятность/влияние отклоняются', () => {
    const risk = createRisk(validRiskData());
    risk.probability = 0;
    risk.impact = 7;
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.probability);
    assert.ok(errors.impact);
  });

  test('validateRiskRecord: сохранённое поле score отклоняется', () => {
    const risk = createRisk(validRiskData());
    risk.score = 25;
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.score);
  });

  test('validateRiskRecord: сохранённое поле priority отклоняется', () => {
    const risk = createRisk(validRiskData());
    risk.priority = 'critical';
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.priority);
  });

  test('validateRiskRecord: запись со статусом in_progress без меры/ответственного отклоняется', () => {
    const risk = createRisk(validRiskData());
    risk.status = 'in_progress';
    const { valid, errors } = validateRiskRecord(risk);
    assert.ok(!valid);
    assert.ok(errors.measure);
    assert.ok(errors.responsible);
  });
}
