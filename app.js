(function () {
  'use strict';

  var C = window.HOUSE_CONFIG || {};
  var BOT_URL = C.botUrl || 'https://max.ru/se14972607_1_bot';
  var BOT_PAGE = C.botPage || 'https://annaserba.ru/bot/';
  var API_URL = C.apiUrl || 'https://bi.annaserba.ru/por48-api/apply';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Ссылки на бота заявок и на страницу бота о свете */
  $$('[data-bot]').forEach(function (link) {
    link.href = BOT_URL;
    link.target = '_blank';
    link.rel = 'noopener';
  });
  $$('[data-botpage]').forEach(function (link) {
    link.href = BOT_PAGE;
  });

  var form = $('#join');
  var formView = $('[data-form-view]');
  var success = $('[data-success]');
  var successTitle = $('[data-success-title]');
  var submitBtn = $('[data-submit]');
  var submitError = $('[data-submit-error]');
  var submitLabel = submitBtn ? submitBtn.innerHTML : '';
  var sending = false;

  /* ---------- Телефон ---------- */

  var phone = $('#phone');

  function formatPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.charAt(0) === '8') d = '7' + d.slice(1);
    if (d.charAt(0) !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    return out;
  }

  if (phone) {
    phone.addEventListener('input', function () {
      var next = formatPhone(phone.value);
      if (phone.value !== next) phone.value = next;
      clearError('phone');
      hideSubmitError();
    });
  }

  /* ---------- Ошибки ---------- */

  function fieldEl(name) { return form ? form.querySelector('[data-field="' + name + '"]') : null; }
  function errorEl(name) { return form ? form.querySelector('[data-error="' + name + '"]') : null; }

  function setError(name, message) {
    var field = fieldEl(name);
    var err = errorEl(name);
    if (field) field.classList.add('has-error');
    if (err) err.textContent = message;
    var inputs = field ? $$('input', field) : [];
    inputs.forEach(function (input) { input.setAttribute('aria-invalid', 'true'); });
    return inputs[0] || null;
  }

  function clearError(name) {
    var field = fieldEl(name);
    var err = errorEl(name);
    if (field) field.classList.remove('has-error');
    if (err) err.textContent = '';
    var inputs = field ? $$('input', field) : [];
    inputs.forEach(function (input) { input.removeAttribute('aria-invalid'); });
  }

  function showSubmitError(message) {
    if (!submitError) return;
    submitError.textContent = message;
    submitError.hidden = false;
  }
  function hideSubmitError() {
    if (!submitError) return;
    submitError.hidden = true;
    submitError.textContent = '';
  }

  /* ---------- Выбор варианта ---------- */

  function syncChoices() {
    $$('.choice', form).forEach(function (label) {
      var input = label.querySelector('input');
      label.classList.toggle('is-checked', !!(input && input.checked));
    });
  }

  if (form) {
    $$('.choice input', form).forEach(function (input) {
      input.addEventListener('change', function () {
        syncChoices();
        clearError(input.name);
        hideSubmitError();
      });
    });

    $$('input', form).forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.type !== 'radio' && input.type !== 'checkbox') clearError(input.name);
        hideSubmitError();
      });
      input.addEventListener('change', function () {
        if (input.type === 'checkbox') clearError(input.name);
      });
    });
  }

  /* ---------- Валидация ---------- */

  function readForm() {
    var name = $('#name') ? $('#name').value.trim() : '';
    var house = form.querySelector('input[name="house"]:checked');
    var status = form.querySelector('input[name="status"]:checked');
    var phoneValue = phone ? phone.value.trim() : '';
    var consent = form.querySelector('input[name="consent"]');
    var digits = phoneValue.replace(/\D/g, '');

    var firstError = null;
    function fail(field, message) {
      var el = setError(field, message);
      if (!firstError) firstError = el;
    }

    clearError('name'); clearError('house'); clearError('status'); clearError('phone'); clearError('consent');

    if (name.length < 2) fail('name', 'Напишите имя — так я буду знать, кого добавлять.');
    if (!house) fail('house', 'Выберите, с какого вы дома.');
    if (!status) fail('status', 'Укажите, собственник вы или нет.');
    if (digits.length !== 11) fail('phone', 'Введите телефон полностью: +7 (978) 123-45-67.');
    if (!consent || !consent.checked) fail('consent', 'Нужно согласие на обработку данных.');

    if (firstError) {
      firstError.focus();
      return null;
    }

    return {
      name: name,
      house: house.value,
      status: status.value,
      phone: formatPhone(phoneValue).replace(/\s+/g, ' '),
      consent: true
    };
  }

  /* ---------- Отправка ---------- */

  function setSending(value) {
    sending = value;
    if (!submitBtn) return;
    submitBtn.disabled = value;
    submitBtn.classList.toggle('is-loading', value);
    submitBtn.innerHTML = value ? 'Отправляю…' : submitLabel;
  }

  function showSuccess() {
    hideSubmitError();
    if (formView) formView.hidden = true;
    if (success) success.hidden = false;
    var card = $('.form-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (successTitle) window.setTimeout(function () { successTitle.focus({ preventScroll: true }); }, 350);
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;

      hideSubmitError();
      var data = readForm();
      if (!data) return;

      setSending(true);
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, 15000) : null;

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller ? controller.signal : undefined,
        credentials: 'omit'
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          return { response: response, body: body };
        });
      }).then(function (result) {
        if (result.response.ok && result.body && result.body.ok) {
          showSuccess();
          return;
        }
        if (result.response.status === 429) {
          throw new Error('Слишком много заявок подряд. Подождите немного и попробуйте снова.');
        }
        if (result.response.status === 503) {
          throw new Error('Заявки временно не принимаются. Напишите в бот заявок — ссылка в шапке.');
        }
        throw new Error('Не получилось отправить заявку. Проверьте связь и попробуйте ещё раз.');
      }).catch(function (error) {
        var message = error && error.name === 'AbortError'
          ? 'Сервер не ответил. Проверьте связь и попробуйте ещё раз.'
          : (error && error.message) || 'Не получилось отправить заявку. Попробуйте ещё раз.';
        showSubmitError(message);
        if (submitError) submitError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).then(function () {
        if (timer) window.clearTimeout(timer);
        setSending(false);
      });
    });
  }

  /* ---------- Изменить данные ---------- */

  var editBtn = $('[data-edit]');
  if (editBtn) {
    editBtn.addEventListener('click', function () {
      if (success) success.hidden = true;
      if (formView) formView.hidden = false;
      var card = $('.form-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var name = $('#name');
      if (name) window.setTimeout(function () { name.focus({ preventScroll: true }); }, 300);
    });
  }

  /* ---------- Политика ---------- */

  $$('[data-privacy]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var details = document.getElementById('privacy');
      if (!details) return;
      event.preventDefault();
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  /* ---------- Год ---------- */

  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  syncChoices();
})();
