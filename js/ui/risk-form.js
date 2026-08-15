// UI-модуль: форма создания/редактирования риска. Только DOM и обвязка вокруг
// значений полей — валидация полностью делегирована validateRisk() из
// risk-model.js, чтобы не дублировать расходящуюся бизнес-логику. Статус
// риска показывается и редактируется только в режиме редактирования — при
// создании поля статуса нет вообще, новый риск всегда получает 'open' через
// createRisk().

import { validateRisk, STATUS_CODES, getStatusLabel } from '../risk-model.js';

const SCALE_VALUES = [1, 2, 3, 4, 5];

// Порядок определяет, какое поле получит фокус первым при нескольких
// одновременных ошибках — сверху вниз, как поля расположены в форме.
// 'status' присутствует только при редактировании — см. fieldOrder ниже.
const BASE_FIELD_ORDER = ['title', 'description', 'probability', 'impact'];
const RESPONSE_FIELD_ORDER = ['measure', 'responsible'];

function createFieldError(id) {
  const el = document.createElement('p');
  el.className = 'field-error';
  el.id = `${id}-error`;
  el.hidden = true;
  return el;
}

function createTextField({ id, label, multiline = false, required = false }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.className = 'form-field__label';
  labelEl.textContent = required ? `${label} *` : label;

  const input = document.createElement(multiline ? 'textarea' : 'input');
  if (!multiline) input.type = 'text';
  input.id = id;
  input.name = id;
  input.className = 'form-field__input';

  const error = createFieldError(id);
  input.setAttribute('aria-describedby', error.id);

  wrapper.append(labelEl, input, error);
  return { wrapper, input, error };
}

function createScaleField({ id, label, required = false }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.className = 'form-field__label';
  labelEl.textContent = required ? `${label} *` : label;

  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  select.className = 'form-field__input';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Не выбрано';
  select.appendChild(placeholder);

  for (const value of SCALE_VALUES) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = String(value);
    select.appendChild(option);
  }

  const error = createFieldError(id);
  select.setAttribute('aria-describedby', error.id);

  wrapper.append(labelEl, select, error);
  return { wrapper, input: select, error };
}

// Select статуса: ровно пять внутренних кодов из STATUS_CODES, подписи —
// через getStatusLabel(), без ручного дублирования кодов/текста. Всегда
// имеет выбранное значение (текущий статус риска) — в отличие от
// createScaleField() здесь нет пустого плейсхолдера, так как редактируемый
// риск уже имеет валидный статус.
function createStatusField({ id, label, required = false }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.className = 'form-field__label';
  labelEl.textContent = required ? `${label} *` : label;

  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  select.className = 'form-field__input';

  for (const code of STATUS_CODES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = getStatusLabel(code);
    select.appendChild(option);
  }

  const error = createFieldError(id);
  select.setAttribute('aria-describedby', error.id);

  wrapper.append(labelEl, select, error);
  return { wrapper, input: select, error };
}

// Рендерит форму создания (risk === null) или редактирования (risk — текущая
// запись) в container. onSubmit(data) вызывается только с уже валидными
// данными полей (без id/даты/статуса — их проставляют вызывающий код и
// createRisk()/updateRisk()). onCancel() вызывается по кнопке «Отмена».
export function renderRiskForm(container, { risk = null, onSubmit, onCancel } = {}) {
  const isEdit = risk !== null;

  container.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'risk-form';
  form.noValidate = true;

  const heading = document.createElement('h2');
  heading.className = 'risk-form__heading';
  heading.textContent = isEdit ? 'Редактирование риска' : 'Новый риск';

  const titleField = createTextField({ id: 'risk-title', label: 'Название', required: true });
  const descriptionField = createTextField({
    id: 'risk-description',
    label: 'Описание',
    multiline: true,
    required: true,
  });
  const probabilityField = createScaleField({ id: 'risk-probability', label: 'Вероятность (1–5)', required: true });
  const impactField = createScaleField({ id: 'risk-impact', label: 'Влияние (1–5)', required: true });
  const measureField = createTextField({ id: 'risk-measure', label: 'Мера реагирования', multiline: true });
  const responsibleField = createTextField({ id: 'risk-responsible', label: 'Ответственный' });
  // Поле статуса создаётся только в режиме редактирования — при создании
  // элемента для него в форме нет вообще, не только визуально скрыт.
  const statusField = isEdit ? createStatusField({ id: 'risk-status', label: 'Статус', required: true }) : null;

  const fields = {
    title: titleField,
    description: descriptionField,
    probability: probabilityField,
    impact: impactField,
    measure: measureField,
    responsible: responsibleField,
  };
  if (statusField) fields.status = statusField;

  // Порядок полей для показа ошибок и перевода фокуса: статус — только при
  // редактировании, между оценками и мерой/ответственным, как и расположен
  // в самой форме.
  const fieldOrder = isEdit
    ? [...BASE_FIELD_ORDER, 'status', ...RESPONSE_FIELD_ORDER]
    : [...BASE_FIELD_ORDER, ...RESPONSE_FIELD_ORDER];

  if (isEdit) {
    titleField.input.value = risk.title;
    descriptionField.input.value = risk.description;
    probabilityField.input.value = String(risk.probability);
    impactField.input.value = String(risk.impact);
    measureField.input.value = risk.measure ?? '';
    responsibleField.input.value = risk.responsible ?? '';
    statusField.input.value = risk.status;
  }

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'btn btn--primary';
  submitButton.textContent = isEdit ? 'Сохранить' : 'Создать риск';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn--secondary';
  cancelButton.textContent = 'Отмена';
  cancelButton.addEventListener('click', () => {
    if (typeof onCancel === 'function') onCancel();
  });

  actions.append(submitButton, cancelButton);

  form.append(
    heading,
    titleField.wrapper,
    descriptionField.wrapper,
    probabilityField.wrapper,
    impactField.wrapper,
    ...(statusField ? [statusField.wrapper] : []),
    measureField.wrapper,
    responsibleField.wrapper,
    actions,
  );

  function clearFieldErrors() {
    for (const key of fieldOrder) {
      fields[key].error.hidden = true;
      fields[key].error.textContent = '';
      fields[key].input.classList.remove('form-field__input--invalid');
    }
  }

  // Показывает ошибки у полей в порядке fieldOrder и переводит фокус на
  // первое из них с ошибкой — этот порядок и есть источник «первого
  // некорректного поля» для формы.
  function showFieldErrors(errors) {
    clearFieldErrors();
    let firstInvalidInput = null;
    for (const key of fieldOrder) {
      const message = errors[key];
      if (!message) continue;
      fields[key].error.textContent = message;
      fields[key].error.hidden = false;
      fields[key].input.classList.add('form-field__input--invalid');
      if (firstInvalidInput === null) {
        firstInvalidInput = fields[key].input;
      }
    }
    if (firstInvalidInput) firstInvalidInput.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const rawProbability = probabilityField.input.value;
    const rawImpact = impactField.input.value;

    // При редактировании статус для валидации берётся из выбора в форме —
    // именно он решает, обязательны ли мера/ответственный. При создании
    // элемента статуса нет, поэтому подставляется фиксированный 'open',
    // как и раньше (createRisk() сама проставит его).
    const validationData = {
      title: titleField.input.value,
      description: descriptionField.input.value,
      probability: rawProbability === '' ? undefined : Number(rawProbability),
      impact: rawImpact === '' ? undefined : Number(rawImpact),
      measure: measureField.input.value,
      responsible: responsibleField.input.value,
      status: isEdit ? statusField.input.value : 'open',
    };

    const { valid, errors } = validateRisk(validationData);

    if (!valid) {
      showFieldErrors(errors);
      return;
    }

    clearFieldErrors();

    if (typeof onSubmit === 'function') {
      const payload = {
        title: validationData.title,
        description: validationData.description,
        probability: validationData.probability,
        impact: validationData.impact,
        measure: validationData.measure,
        responsible: validationData.responsible,
      };
      // Статус передаётся в onSubmit только при редактировании — так
      // выбранный в форме статус доходит до updateRisk(). При создании
      // поле статуса намеренно не передаётся: createRisk() сама проставляет
      // 'open', а форма создания вообще не содержит элемента статуса.
      if (isEdit) {
        payload.status = validationData.status;
      }
      onSubmit(payload);
    }
  });

  container.appendChild(form);
  titleField.input.focus();
}
