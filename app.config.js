// app.config.js is used at build time. extra.apiUrl is baked into the app so EAS/Expo
// builds work without .env (which is gitignored). Local .env still overrides via EXPO_PUBLIC_API_URL.
const appJson = require('./app.json');

const productionApiUrl = 'https://verbabackend.onrender.com';

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    scheme: 'verba',
    extra: {
      ...appJson.expo.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || productionApiUrl,
      revenueCatApiKeyTest: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_TEST || '',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
  },
};
