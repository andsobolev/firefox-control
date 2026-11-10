# Draft Mozilla listing

Name: Browser Control Bridge for Firefox

Summary (English): Connect Firefox tabs to your local AI assistant on Windows with explicit pairing and control.

Summary (Russian): Подключите вкладки Firefox к локальному ИИ-ассистенту в Windows с явным разрешением доступа.

## Description — English

Browser Control Bridge connects Firefox to a compatible local AI assistant such
as Codex through an authenticated companion on your Windows computer.

After setup, your assistant can list ordinary tabs, read a requested page, open
and navigate tabs, close selected tabs, remove exact duplicate addresses, click
visible controls, fill supported text fields, scroll and capture screenshots.

The local companion is required in addition to this add-on. Install it from the
project's verified release, then import the locally generated connection file in
the add-on settings and explicitly consent. Every computer uses its own pairing.
The setup interface currently uses Russian; the project README provides English steps.

Private windows are excluded. There is no developer-hosted relay or analytics.
Requested page data is returned to the local AI client, which may process it
through its AI provider according to its own settings. You can pause or disconnect
access from the Firefox toolbar at any time.

Windows, Firefox 142+ and Node.js 22+ are required. Protected browser pages, PDF
contents, iframe interiors, shadow DOM, password input, uploads/downloads and
trusted keyboard events are unsupported. This is an independent project and is
not affiliated with Mozilla or OpenAI.

## Description — Russian

Расширение подключает Firefox к совместимому локальному ИИ-ассистенту, например
Codex, через приложение-посредник на вашем компьютере с Windows.

После настройки ассистент может показывать вкладки, читать выбранные страницы,
открывать, перенаправлять и закрывать вкладки, удалять точные дубли, нажимать
видимые кнопки, заполнять обычные текстовые поля, прокручивать и делать снимки экрана.

Помимо расширения требуется локальная часть из проверенного выпуска проекта.
В настройках выберите созданный на этом компьютере файл подключения, прочитайте
описание доступа и явно разрешите соединение. Для каждого компьютера создаётся
собственный ключ. Доступ можно приостановить или отключить на панели Firefox.

Приватные окна исключены. Нет сервера-посредника разработчика или аналитики.
Запрошенные данные передаются локальному ИИ-клиенту; он может обрабатывать их
через своего поставщика ИИ согласно собственным настройкам. Защищённые страницы,
содержимое PDF, вложенные фреймы, Shadow DOM, ввод паролей и загрузка файлов
через инструменты не поддерживаются.

Требуются Windows, Firefox 142+ и Node.js 22+. Это независимый проект, не
связанный с Mozilla или OpenAI.

## Publication fields

- Publisher: andsobolev.
- Support: https://github.com/andsobolev/firefox-control/issues
- Homepage: https://github.com/andsobolev/firefox-control
- Privacy: https://github.com/andsobolev/firefox-control/blob/main/PRIVACY.md
- License: MIT; Copyright (c) 2026 andsobolev.
- Candidate categories: Tabs and Other (confirm available choices in AMO).
- Additional software/services: the local companion, Node.js and a compatible
  AI client are required. The owner must confirm any paid-service disclosure.
- Platforms: Windows desktop; no Android support is claimed.
- Reviewer notes: use the bundled MOZILLA_REVIEW_NOTES.txt and local test fixture.
