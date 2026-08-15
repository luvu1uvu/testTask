import { createRisk } from '../risk-model.js';
import {
  STORAGE_KEY,
  StorageCorruptedError,
  load,
  getAll,
  save,
  addRisk,
  updateRisk,
  deleteRisk,
  resetStorage,
} from '../storage.js';

// Каждый тест получает собственный уникальный тестовый ключ — никогда не
// продакшн-ключ STORAGE_KEY. Ключ удаляется в finally, поэтому подчищается
// даже при упавшем тесте.
function testKey() {
  return `project-risk-tracker:v1:test:${crypto.randomUUID()}`;
}

function validRiskData(overrides = {}) {
  return {
    title: 'Задержка поставки оборудования',
    description: 'Поставщик может не успеть к согласованному сроку.',
    probability: 3,
    impact: 4,
    measure: '',
    responsible: '',
    ...overrides,
  };
}

function expectThrow(fn, ErrorClass) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  if (thrown === null) {
    throw new Error('Ожидалось исключение, но функция выполнилась без ошибки');
  }
  if (ErrorClass && !(thrown instanceof ErrorClass)) {
    throw new Error(`Ожидалось исключение ${ErrorClass.name}, получено ${thrown.constructor.name}`);
  }
  return thrown;
}

export function registerStorageTests(test, assert) {
  // --- Пустое хранилище и round-trip ---

  test('load() на пустом хранилище возвращает статус empty и пустой список', () => {
    const key = testKey();
    try {
      const result = load(key);
      assert.strictEqual(result.status, 'empty');
      assert.deepEqual(result.risks, []);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('getAll() на пустом хранилище тоже возвращает empty (та же семантика, что и load)', () => {
    const key = testKey();
    try {
      const result = getAll(key);
      assert.strictEqual(result.status, 'empty');
      assert.deepEqual(result.risks, []);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('save()+load() выполняют корректный round-trip', () => {
    const key = testKey();
    try {
      const risks = [
        createRisk(validRiskData({ title: 'Риск А', measure: 'Мера А', responsible: 'Иванов' })),
        createRisk(validRiskData({ title: 'Риск Б', probability: 1, impact: 2 })),
      ];
      save(risks, key);
      const result = load(key);
      assert.strictEqual(result.status, 'ok');
      assert.deepEqual(result.risks, risks);
    } finally {
      localStorage.removeItem(key);
    }
  });

  // --- CRUD ---

  test('addRisk сохраняет два риска с одинаковым названием как отдельные записи с разными id', () => {
    const key = testKey();
    try {
      const first = createRisk(validRiskData({ title: 'Сбой поставщика' }));
      const second = createRisk(validRiskData({ title: 'Сбой поставщика', description: 'Другое описание риска.' }));
      addRisk(first, key);
      addRisk(second, key);

      const result = getAll(key);
      assert.strictEqual(result.status, 'ok');
      assert.strictEqual(result.risks.length, 2);
      assert.strictEqual(result.risks[0].title, result.risks[1].title);
      assert.ok(result.risks[0].id !== result.risks[1].id, 'id записей должны различаться');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('updateRisk сохраняет id и createdAt, обновляет updatedAt, игнорирует попытку их переопределить', () => {
    const key = testKey();
    try {
      const original = createRisk(validRiskData());
      addRisk(original, key);

      const updated = updateRisk(
        original.id,
        {
          id: 'подделанный-id',
          createdAt: '2000-01-01T00:00:00.000Z',
          probability: 5,
          impact: 5,
        },
        key,
      );

      assert.strictEqual(updated.id, original.id);
      assert.strictEqual(updated.createdAt, original.createdAt);
      assert.strictEqual(updated.probability, 5);
      assert.strictEqual(updated.impact, 5);
      assert.ok(
        Date.parse(updated.updatedAt) > Date.parse(original.updatedAt),
        'updatedAt должен быть строго позже исходного значения',
      );

      const stored = getAll(key);
      assert.strictEqual(stored.risks.length, 1);
      assert.strictEqual(stored.risks[0].updatedAt, updated.updatedAt);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('два подряд updateRisk() дают строго возрастающую цепочку updatedAt, даже в одну и ту же миллисекунду', () => {
    const key = testKey();
    try {
      const original = createRisk(validRiskData());
      addRisk(original, key);

      const firstUpdate = updateRisk(original.id, { probability: 4 }, key);
      const secondUpdate = updateRisk(original.id, { probability: 5 }, key);

      assert.ok(
        Date.parse(firstUpdate.updatedAt) > Date.parse(original.updatedAt),
        'первое обновление должно быть строго позже createdAt/updatedAt при создании',
      );
      assert.ok(
        Date.parse(secondUpdate.updatedAt) > Date.parse(firstUpdate.updatedAt),
        'второе обновление должно быть строго позже первого, даже если выполнено в ту же миллисекунду',
      );
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('updateRisk бросает ошибку, если риск с указанным id не найден', () => {
    const key = testKey();
    try {
      expectThrow(() => updateRisk('несуществующий-id', { probability: 2 }, key));
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('deleteRisk удаляет риск по id, не затрагивая остальные записи', () => {
    const key = testKey();
    try {
      const first = createRisk(validRiskData({ title: 'Риск для удаления' }));
      const second = createRisk(validRiskData({ title: 'Риск, который остаётся' }));
      addRisk(first, key);
      addRisk(second, key);

      deleteRisk(first.id, key);

      const result = getAll(key);
      assert.strictEqual(result.status, 'ok');
      assert.strictEqual(result.risks.length, 1);
      assert.strictEqual(result.risks[0].id, second.id);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('deleteRisk бросает ошибку, если риск с указанным id не найден', () => {
    const key = testKey();
    try {
      expectThrow(() => deleteRisk('несуществующий-id', key));
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('addRisk отклоняет запись с сохранённым score и ничего не записывает в хранилище', () => {
    const key = testKey();
    try {
      const withScore = { ...createRisk(validRiskData()), score: 9 };
      expectThrow(() => addRisk(withScore, key));
      assert.strictEqual(localStorage.getItem(key), null, 'хранилище не должно быть создано невалидной записью');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('addRisk отклоняет запись с сохранённым priority', () => {
    const key = testKey();
    try {
      const withPriority = { ...createRisk(validRiskData()), priority: 'critical' };
      expectThrow(() => addRisk(withPriority, key));
      assert.strictEqual(localStorage.getItem(key), null);
    } finally {
      localStorage.removeItem(key);
    }
  });

  // --- Явный сброс ---

  test('resetStorage() явно удаляет данные по ключу', () => {
    const key = testKey();
    try {
      addRisk(createRisk(validRiskData()), key);
      assert.strictEqual(load(key).status, 'ok');

      resetStorage(key);

      assert.strictEqual(load(key).status, 'empty');
      assert.strictEqual(localStorage.getItem(key), null);
    } finally {
      localStorage.removeItem(key);
    }
  });

  // --- Обнаружение повреждённых данных (атомарно, весь набор целиком) ---

  test('load() считает битый JSON повреждённым', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, '{ не json');
      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_json');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает отсутствующую версию повреждённой', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, JSON.stringify({ risks: [] }));
      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_version');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает неподдерживаемую версию повреждённой', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, JSON.stringify({ version: 2, risks: [] }));
      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_version');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает неверный тип risks повреждённым', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: {} }));
      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_risks_type');
    } finally {
      localStorage.removeItem(key);
    }
  });

  // Начиная с доработки шага 2, save() сама валидирует каждую запись и
  // отказывается писать заведомо повреждённые данные — поэтому повреждённые
  // фикстуры для тестов load() ниже пишутся напрямую через localStorage.setItem(),
  // как имитация реального повреждения хранилища или стороннего вмешательства,
  // а не через save().

  test('load() считает набор повреждённым целиком, если хотя бы одна запись массива невалидна', () => {
    const key = testKey();
    try {
      const valid = createRisk(validRiskData());
      const garbage = { not: 'a risk record' };
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: [valid, garbage] }));

      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_record');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает запись с невалидной/отсутствующей датой повреждённой', () => {
    const key = testKey();
    try {
      const broken = { ...createRisk(validRiskData()), createdAt: 'не дата' };
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: [broken] }));

      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_record');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает запись с недопустимым статусом повреждённой', () => {
    const key = testKey();
    try {
      const broken = { ...createRisk(validRiskData()), status: 'Открыт' };
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: [broken] }));

      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_record');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает запись с сохранённым score повреждённой', () => {
    const key = testKey();
    try {
      const broken = { ...createRisk(validRiskData()), score: 12 };
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: [broken] }));

      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_record');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает запись с сохранённым priority повреждённой', () => {
    const key = testKey();
    try {
      const broken = { ...createRisk(validRiskData()), priority: 'high' };
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: [broken] }));

      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_record');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('load() считает запись без id повреждённой', () => {
    const key = testKey();
    try {
      const broken = createRisk(validRiskData());
      delete broken.id;
      localStorage.setItem(key, JSON.stringify({ version: 1, risks: [broken] }));

      const result = load(key);
      assert.strictEqual(result.status, 'corrupted');
      assert.strictEqual(result.reason, 'invalid_record');
    } finally {
      localStorage.removeItem(key);
    }
  });

  // --- Запрет автоматической перезаписи повреждённых данных ---

  test('addRisk отказывается писать поверх повреждённых данных', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, '{ битые данные');
      const before = localStorage.getItem(key);

      expectThrow(() => addRisk(createRisk(validRiskData()), key), StorageCorruptedError);

      assert.strictEqual(localStorage.getItem(key), before, 'повреждённые данные не должны быть перезаписаны');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('updateRisk отказывается писать поверх повреждённых данных', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, '{ битые данные');
      const before = localStorage.getItem(key);

      expectThrow(() => updateRisk('любой-id', { probability: 2 }, key), StorageCorruptedError);

      assert.strictEqual(localStorage.getItem(key), before);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('deleteRisk отказывается писать поверх повреждённых данных', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, '{ битые данные');
      const before = localStorage.getItem(key);

      expectThrow(() => deleteRisk('любой-id', key), StorageCorruptedError);

      assert.strictEqual(localStorage.getItem(key), before);
    } finally {
      localStorage.removeItem(key);
    }
  });

  // --- save(): контракт валидации и защита от перезаписи повреждённых данных ---

  test('save() отклоняет не-массив и ничего не записывает', () => {
    const key = testKey();
    try {
      expectThrow(() => save({ not: 'an array' }, key));
      assert.strictEqual(localStorage.getItem(key), null, 'save() не должна была создать запись по ключу');
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('save() отклоняет массив с невалидной записью', () => {
    const key = testKey();
    try {
      expectThrow(() => save([{ not: 'a risk record' }], key));
      assert.strictEqual(localStorage.getItem(key), null);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('save() отклоняет записи с сохранёнными score и priority', () => {
    const key = testKey();
    try {
      const withScore = { ...createRisk(validRiskData()), score: 9 };
      expectThrow(() => save([withScore], key));
      assert.strictEqual(localStorage.getItem(key), null);

      const withPriority = { ...createRisk(validRiskData()), priority: 'critical' };
      expectThrow(() => save([withPriority], key));
      assert.strictEqual(localStorage.getItem(key), null);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('save(): при отказе (не массив, невалидная запись, score/priority) прежнее сырое значение ключа остаётся побайтно неизменным', () => {
    const key = testKey();
    try {
      const validRecord = createRisk(validRiskData());
      save([validRecord], key);
      const before = localStorage.getItem(key);

      expectThrow(() => save('не массив', key));
      assert.strictEqual(localStorage.getItem(key), before);

      expectThrow(() => save([{ not: 'a risk' }], key));
      assert.strictEqual(localStorage.getItem(key), before);

      const withScore = { ...createRisk(validRiskData()), score: 9 };
      expectThrow(() => save([withScore], key));
      assert.strictEqual(localStorage.getItem(key), before);

      const withPriority = { ...createRisk(validRiskData()), priority: 'high' };
      expectThrow(() => save([withPriority], key));
      assert.strictEqual(localStorage.getItem(key), before);
    } finally {
      localStorage.removeItem(key);
    }
  });

  test('save() не перезаписывает уже повреждённые данные валидным набором без явного resetStorage()', () => {
    const key = testKey();
    try {
      localStorage.setItem(key, '{ битые данные');
      const before = localStorage.getItem(key);

      const validRisks = [createRisk(validRiskData())];
      expectThrow(() => save(validRisks, key), StorageCorruptedError);
      assert.strictEqual(
        localStorage.getItem(key),
        before,
        'save() не должна молча перезаписать повреждённые данные валидным набором',
      );

      resetStorage(key);
      save(validRisks, key);
      assert.strictEqual(load(key).status, 'ok');
    } finally {
      localStorage.removeItem(key);
    }
  });

  // --- Ключ хранения ---

  test('STORAGE_KEY равен согласованному продакшн-ключу project-risk-tracker:v1', () => {
    assert.strictEqual(STORAGE_KEY, 'project-risk-tracker:v1');
  });

  test('load() с тестовым ключом, отличным от STORAGE_KEY, возвращает независимый статус для этого ключа', () => {
    // Проверяет ровно то, что заявлено в названии: чтение по произвольному
    // тестовому ключу не зависит от STORAGE_KEY. Не является проверкой того,
    // что все CRUD-функции используют STORAGE_KEY по умолчанию, — это
    // потребовало бы вызова без явного ключа, а значит обращения к
    // продакшн-ключу из автотеста, что запрещено правилами изоляции тестов.
    const key = testKey();
    assert.ok(key !== STORAGE_KEY, 'тестовый ключ должен отличаться от продакшн-ключа');
    try {
      assert.strictEqual(load(key).status, 'empty');
    } finally {
      localStorage.removeItem(key);
    }
  });
}
