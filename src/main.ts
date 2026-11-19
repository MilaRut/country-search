import { createSearchCache } from './searchCache.js';
import type { SearchFailure } from './classifyError.js';
import {
  createSearchController,
  type SearchViewState,
} from './searchController.js';
import { createSearchHistory } from './searchHistory.js';
import type { Country } from './types.js';

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function createButton(label: string, className: string): HTMLButtonElement {
  const button = createElement('button', className);
  button.type = 'button';
  button.textContent = label;
  return button;
}

function formatPopulation(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function failureMessage(failure: SearchFailure): string {
  switch (failure.kind) {
    case 'timeout':
      return 'Сервис долго не отвечает. Попробуйте ещё раз.';
    case 'http':
      return `Сервис вернул ошибку (HTTP ${failure.status}). Попробуйте позже.`;
    case 'network':
      return 'Не удалось подключиться. Проверьте интернет и повторите поиск.';
    case 'unknown':
      return 'Что-то пошло не так. Попробуйте повторить поиск.';
    case 'aborted':
      return '';
  }
}

const storage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Search still works when browser storage is unavailable.
    }
  },
};

const history = createSearchHistory(storage);
const app = createElement('div', 'app-shell');

const header = createElement('header', 'site-header');
const brand = createElement('a', 'brand');
brand.href = '#top';
brand.setAttribute('aria-label', 'Country Search — на главную');
const brandMark = createElement('span', 'brand-mark');
brandMark.setAttribute('aria-hidden', 'true');
brandMark.textContent = 'C';
const brandName = createElement('span', 'brand-name');
brandName.textContent = 'Country Search';
brand.append(brandMark, brandName);

const headerNote = createElement('span', 'header-note');
headerNote.textContent = 'Страны мира';
header.append(brand, headerNote);

const main = createElement('main', 'main-content');
main.id = 'top';

const intro = createElement('section', 'intro');
intro.setAttribute('aria-labelledby', 'page-title');
const eyebrow = createElement('p', 'eyebrow');
eyebrow.textContent = 'Исследуйте мир';
const title = createElement('h1', 'page-title');
title.id = 'page-title';
title.textContent = 'Найдите страну';
const introText = createElement('p', 'intro-text');
introText.textContent =
  'Введите название — результаты появятся по мере ввода. Откройте карточку, чтобы узнать больше.';
intro.append(eyebrow, title, introText);

const searchPanel = createElement('section', 'search-panel');
searchPanel.setAttribute('aria-label', 'Поиск стран');
const searchForm = createElement('form', 'search-form');
searchForm.setAttribute('role', 'search');

const searchLabel = createElement('label', 'search-label');
searchLabel.htmlFor = 'country-query';
searchLabel.textContent = 'Название страны';

const searchControl = createElement('div', 'search-control');
const searchIcon = createElement('span', 'search-icon');
searchIcon.setAttribute('aria-hidden', 'true');
searchIcon.textContent = '⌕';
const searchInput = createElement('input', 'search-input');
searchInput.id = 'country-query';
searchInput.name = 'country';
searchInput.type = 'search';
searchInput.autocomplete = 'off';
searchInput.placeholder = 'Например, Spain';
searchInput.setAttribute('aria-describedby', 'search-hint');
searchControl.append(searchIcon, searchInput);

const searchHint = createElement('p', 'search-hint');
searchHint.id = 'search-hint';
searchHint.textContent = 'Можно вводить название на английском языке.';
searchForm.append(searchLabel, searchControl, searchHint);

const historyPanel = createElement('div', 'history-panel');
const historyLabel = createElement('span', 'history-label');
historyLabel.textContent = 'Недавние запросы';
const historyList = createElement('div', 'history-list');
historyPanel.append(historyLabel, historyList);

searchPanel.append(searchForm, historyPanel);

const resultsSection = createElement('section', 'results-section');
resultsSection.setAttribute('aria-labelledby', 'results-title');
const resultsHeading = createElement('h2', 'visually-hidden');
resultsHeading.id = 'results-title';
resultsHeading.textContent = 'Результаты поиска';
const statusMessage = createElement('div', 'status-message');
statusMessage.setAttribute('role', 'status');
statusMessage.setAttribute('aria-live', 'polite');
statusMessage.setAttribute('aria-atomic', 'true');
const countryList = createElement('ul', 'country-grid');
countryList.setAttribute('aria-label', 'Найденные страны');
resultsSection.append(resultsHeading, statusMessage, countryList);

const detailDialog = createElement('dialog', 'country-dialog');
detailDialog.setAttribute('aria-labelledby', 'detail-title');

main.append(intro, searchPanel, resultsSection);
app.append(header, main, detailDialog);
document.body.prepend(app);

function renderHistory(): void {
  const items = history.read();
  historyPanel.hidden = items.length === 0;
  historyList.replaceChildren();

  for (const query of items) {
    const button = createButton(query, 'history-chip');
    button.addEventListener('click', () => {
      searchInput.value = query;
      controller.searchNow(query);
      searchInput.focus();
    });
    historyList.append(button);
  }
}

function setStatus(text: string, tone = 'neutral'): void {
  statusMessage.className = `status-message status-message--${tone}`;
  statusMessage.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  statusMessage.setAttribute(
    'aria-live',
    tone === 'error' ? 'assertive' : 'polite',
  );
  statusMessage.replaceChildren();
  statusMessage.textContent = text;
}

function createCountryCard(country: Country): HTMLLIElement {
  const item = createElement('li', 'country-list-item');
  const card = createElement('button', 'country-card');
  card.type = 'button';
  card.dataset.countryCode = country.code;
  card.setAttribute('aria-label', `Подробнее о стране: ${country.name}`);

  const cardTop = createElement('div', 'country-card-top');
  const flag = createElement('img', 'country-flag');
  flag.src = country.flagUrl;
  flag.alt = '';
  flag.loading = 'lazy';
  flag.addEventListener('error', () => {
    flag.hidden = true;
  });
  const region = createElement('span', 'country-region');
  region.textContent = country.region || 'Регион не указан';
  cardTop.append(flag, region);

  const name = createElement('span', 'country-name');
  name.textContent = country.name;
  const nativeName = createElement('span', 'country-native-name');
  nativeName.textContent =
    country.nativeName && country.nativeName !== country.name
      ? country.nativeName
      : country.subregion || country.region;

  const divider = createElement('span', 'card-divider');
  divider.setAttribute('aria-hidden', 'true');
  const facts = createElement('span', 'country-facts');
  const capital = createElement('span', 'country-fact');
  const capitalLabel = createElement('span', 'fact-label');
  capitalLabel.textContent = 'Столица';
  const capitalValue = createElement('span', 'fact-value');
  capitalValue.textContent = country.capital || 'Не указана';
  capital.append(capitalLabel, capitalValue);

  const population = createElement('span', 'country-fact');
  const populationLabel = createElement('span', 'fact-label');
  populationLabel.textContent = 'Население';
  const populationValue = createElement('span', 'fact-value');
  populationValue.textContent = formatPopulation(country.population);
  population.append(populationLabel, populationValue);
  facts.append(capital, population);

  const openHint = createElement('span', 'card-open-hint');
  openHint.setAttribute('aria-hidden', 'true');
  openHint.textContent = '↗';
  card.append(cardTop, name, nativeName, divider, facts, openHint);
  item.append(card);
  return item;
}

function addDetailRow(
  list: HTMLDListElement,
  label: string,
  value: string,
): void {
  const row = createElement('div', 'detail-row');
  const term = createElement('dt', 'detail-label');
  term.textContent = label;
  const description = createElement('dd', 'detail-value');
  description.textContent = value || 'Нет данных';
  row.append(term, description);
  list.append(row);
}

function renderDetails(country: Country | null): void {
  if (!country) {
    if (detailDialog.open) {
      detailDialog.close();
    }
    return;
  }

  detailDialog.replaceChildren();
  const content = createElement('div', 'dialog-content');
  const top = createElement('div', 'dialog-top');
  const label = createElement('p', 'eyebrow');
  label.textContent = 'Карточка страны';
  const closeButton = createButton('Закрыть', 'dialog-close');
  closeButton.setAttribute('aria-label', 'Закрыть карточку страны');
  closeButton.addEventListener('click', () => detailDialog.close());
  top.append(label, closeButton);

  const profile = createElement('div', 'detail-profile');
  const flag = createElement('img', 'detail-flag');
  flag.src = country.flagUrl;
  flag.alt = '';
  flag.addEventListener('error', () => {
    flag.hidden = true;
  });
  const names = createElement('div', 'detail-names');
  const name = createElement('h2', 'detail-title');
  name.id = 'detail-title';
  name.textContent = country.name;
  const nativeName = createElement('p', 'detail-native-name');
  nativeName.textContent =
    country.nativeName && country.nativeName !== country.name
      ? country.nativeName
      : country.demonym;
  names.append(name, nativeName);
  profile.append(flag, names);

  const summary = createElement('p', 'detail-summary');
  const location = [country.region, country.subregion]
    .filter(Boolean)
    .join(' · ');
  summary.textContent = location
    ? `${country.name} — страна региона ${location}.`
    : `Сведения о стране ${country.name}.`;

  const details = createElement('dl', 'detail-list');
  const numberFormat = new Intl.NumberFormat('ru-RU');
  addDetailRow(details, 'Столица', country.capital ?? '');
  addDetailRow(details, 'Население', numberFormat.format(country.population));
  addDetailRow(
    details,
    'Площадь',
    country.area === null ? '' : `${numberFormat.format(country.area)} км²`,
  );
  addDetailRow(details, 'Регион', country.region);
  addDetailRow(details, 'Субрегион', country.subregion);
  addDetailRow(details, 'Границы', country.borders.join(', '));
  addDetailRow(details, 'Языки', country.languages.join(', '));
  addDetailRow(details, 'Валюта', country.currencies.join(', '));

  content.append(top, profile, summary, details);
  detailDialog.append(content);
  if (!detailDialog.open) {
    detailDialog.showModal();
  }
}

function renderState(state: SearchViewState): void {
  countryList.replaceChildren();

  switch (state.status) {
    case 'idle':
      setStatus('Введите название страны, чтобы начать поиск.');
      break;
    case 'loading': {
      statusMessage.className = 'status-message status-message--loading';
      statusMessage.setAttribute('role', 'status');
      statusMessage.setAttribute('aria-live', 'polite');
      const spinner = createElement('span', 'loading-spinner');
      spinner.setAttribute('aria-hidden', 'true');
      const text = createElement('span');
      text.textContent = `Ищем страны по запросу «${state.query}»…`;
      statusMessage.replaceChildren(spinner, text);
      break;
    }
    case 'empty':
      setStatus(
        `По запросу «${state.query}» ничего не найдено. Проверьте написание.`,
      );
      history.remember(state.query);
      renderHistory();
      break;
    case 'error': {
      statusMessage.className = 'status-message status-message--error';
      statusMessage.setAttribute('role', 'alert');
      statusMessage.setAttribute('aria-live', 'assertive');
      const message = createElement('span');
      message.textContent = failureMessage(state.failure);
      const retryButton = createButton('Повторить поиск', 'retry-button');
      retryButton.addEventListener('click', () => controller.retry());
      statusMessage.replaceChildren(message, retryButton);
      break;
    }
    case 'results': {
      setStatus(
        `Найдено стран: ${state.countries.length}. Нажмите на карточку для подробностей.`,
        'success',
      );
      for (const country of state.countries) {
        countryList.append(createCountryCard(country));
      }
      history.remember(state.query);
      renderHistory();
      break;
    }
  }

  renderDetails(controller.getSelected());
}

const controller = createSearchController({
  search: createSearchCache(),
  onStateChange: renderState,
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  controller.searchNow(searchInput.value);
});
searchInput.addEventListener('input', () => {
  controller.setQuery(searchInput.value);
});
countryList.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const card = event.target.closest<HTMLButtonElement>('[data-country-code]');
  if (card?.dataset.countryCode) {
    controller.selectCountry(card.dataset.countryCode);
  }
});
detailDialog.addEventListener('close', () => {
  if (controller.getSelected()) {
    controller.selectCountry('');
  }
});
detailDialog.addEventListener('click', (event) => {
  if (event.target === detailDialog) {
    detailDialog.close();
  }
});

renderHistory();
renderState(controller.getState());
