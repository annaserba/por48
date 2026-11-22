(function () {
  'use strict';

  var C = window.HOUSE_CONFIG || {};
  var MAX_PROFILE = C.maxProfile || '';
  var SHARE_BASE = C.shareBase || 'https://max.ru/:share?text=';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function toast(message) {
    var el = $('[data-toast]');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { el.classList.remove('is-visible'); }, 3200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* Ссылки на страницу бота */
  var BOT_URL = C.botUrl || 'https://annaserba.ru/bot/';
  $$('[data-botpage]').forEach(function (link) {
    link.href = BOT_URL;
  });

  /* Ссылки на MAX */
  $$('[data-max]').forEach(function (link) {
    if (MAX_PROFILE) link.href = MAX_PROFILE;
    link.target = '_blank';
    link.rel = 'noopener';
  });

  var form = $('#join');
  var formView = $('[data-form-view]');
  var success = $('[data-success]');
  var successLead = $('[data-success-lead]');
  var msgEl = $('[data-message]');
  var shareLink = $('[data-share-link]');
  var successTitle = $('[data-success-title]');
  var currentMessage = '';

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
      });
    });

    $$('input', form).forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.type !== 'radio' && input.type !== 'checkbox') clearError(input.name);
      });
      input.addEventListener('change', function () {
        if (input.type === 'checkbox') clearError(input.name);
      });
    });
  }

  /* ---------- Валидация и сообщение ---------- */

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
      message: ''
    };
  }

  function buildMessage(data) {
    return [
      'Здравствуйте, Анна! Заявка в чат дома «ПОР 48 и 48/1».',
      '',
      'Дом: ' + data.house,
      'Статус: ' + data.status.toLowerCase(),
      'Имя: ' + data.name,
      'Телефон: ' + data.phone,
      '',
      'Прошу добавить в чат дома.'
    ].join('\n');
  }

  function showSuccess(message, shareUrl, blocked) {
    currentMessage = message;
    if (formView) formView.hidden = true;
    if (form) form.hidden = true;
    if (success) success.hidden = false;
    if (msgEl) msgEl.textContent = message;
    if (shareLink) shareLink.href = shareUrl;
    if (successLead) {
      successLead.textContent = blocked
        ? 'Браузер заблокировал вкладку. Текст уже скопирован — нажмите «Открыть MAX» и выберите чат Анны.'
        : 'MAX открывается в новой вкладке. Выберите чат Анны и отправьте сообщение. Если вкладка не открылась — нажмите кнопку ниже.';
    }

    // Максимально честно: если вкладку заблокировали, кнопка рядом.
    var card = $('.form-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (successTitle) window.setTimeout(function () { successTitle.focus({ preventScroll: true }); }, 350);
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = readForm();
      if (!data) return;

      var message = buildMessage(data);
      var shareUrl = SHARE_BASE + encodeURIComponent(message);

      var win = null;
      try { win = window.open(shareUrl, '_blank'); } catch (e) { win = null; }
      if (win) win.opener = null;

      copyText(message);
      showSuccess(message, shareUrl, !win);

      if (!win) {
        toast('Браузер заблокировал вкладку — нажмите «Открыть MAX»');
      }
    });
  }

  /* ---------- Кнопки в блоке успеха ---------- */

  var copyBtn = $('[data-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      copyText(currentMessage).then(function (ok) {
        toast(ok ? 'Текст скопирован' : 'Не получилось скопировать — выделите текст вручную');
      });
    });
  }

  var editBtn = $('[data-edit]');
  if (editBtn) {
    editBtn.addEventListener('click', function () {
      if (success) success.hidden = true;
      if (formView) formView.hidden = false;
      if (form) form.hidden = false;
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
