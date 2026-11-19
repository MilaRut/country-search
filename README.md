# Country Search

Живой поиск стран через [countries.dev](https://countries.dev/): результаты
обновляются по мере ввода, устаревшие запросы отменяются, а карточка страны
показывает подробности. Повторные запросы кэшируются, история хранится в
браузере.

## Запуск

```bash
npm ci
npm run build
npm start
```

Откройте адрес, который покажет `serve`. Для разработки можно запустить
`npm run dev` и оставить локальный статический сервер работающим.

## Проверки

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Публикация на GitHub Pages

В репозитории настроен workflow `.github/workflows/pages.yml`. В настройках
GitHub откройте **Settings → Pages** и выберите **GitHub Actions** в качестве
источника сборки. После отправки ветки `country-search` workflow соберёт
приложение и опубликует его на GitHub Pages.

Откройте Pull Request из `country-search` в `main`, не выполняя merge, как
требует задание.

## Структура

- `src/searchCountries.ts` — запрос к API, 404 и таймауты.
- `src/searchController.ts` — debounce, отмена, повтор и состояния поиска.
- `src/searchCache.ts` — кэширование и дедупликация запросов.
- `src/searchHistory.ts` — история поиска в localStorage.
- `src/main.ts` — интерфейс и открытие подробностей страны.
- `DESIGN.md` — объяснение решений, сложности и принципов чистого кода.
