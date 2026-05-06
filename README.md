# Verba

AI language tutor for speaking practice. Practice phrases, get pronunciation feedback, and have scenario-based conversations.

## Setup

### Prerequisites

- Node.js 18+
- Expo Go app (for mobile testing)
- OpenAI API key (for speech evaluation and conversations)

### Backend (VerbaBackend)

```bash
cd VerbaBackend
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
npm start
```

The backend runs on http://localhost:3000 by default.

### Frontend (Verba)

```bash
cd Verba
npm start
```

- **iOS Simulator:** Use `http://localhost:3000` for the API (default in `.env`)
- **Android Emulator:** Set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` in `.env`

### Supabase (optional)

For production, run the SQL in `VerbaBackend/supabase/schema.sql` and `seed.sql` in your Supabase project. The app works without Supabase using local JSON phrase data.

## Features

- **Onboarding:** Select target language (Spanish, French, Italian, English)
- **Phrase Practice:** Speak phrases, get AI pronunciation feedback
- **Listen Mode:** Hear correct pronunciation with text-to-speech
- **Scenario Practice:** Restaurant, Airport, Hotel, Small talk conversations
- **Daily Goal:** Practice 5 phrases per day
- **Streaks:** Consecutive day tracking
- **Freemium:** 3 minutes free speaking per day; upgrade prompt for Pro

!
