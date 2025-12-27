# Aptoria IT Finance System

Финансовая система для управления сетью сервисных центров.

## Развертывание на Vercel

1. Нажмите "Deploy" на Vercel
2. Добавьте переменную окружения:
   - `API_KEY` - ваш Google GenAI API ключ (Gemini)
3. Деплой будет автоматическим через Vite.

## Локальная разработка

```bash
npm install
cp .env.example .env.local
# Отредактируйте .env.local, добавив ваш API_KEY
npm run dev
```