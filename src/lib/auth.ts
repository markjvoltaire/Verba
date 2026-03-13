import { Linking } from 'react-native';
import { supabase } from './supabase';

const REDIRECT_URL = 'verba://auth/callback';

export async function createSessionFromUrl(url: string) {
  if (!supabase) return null;
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

export async function signInWithAppleOAuth(): Promise<ReturnType<typeof createSessionFromUrl>> {
  if (!supabase) throw new Error('Supabase is not configured');
  const redirectTo = REDIRECT_URL;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  const authUrl = data?.url ?? '';
  if (!authUrl) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (session: Awaited<ReturnType<typeof createSessionFromUrl>>) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      clearTimeout(timeoutId);
      resolve(session);
    };
    const handleUrl = async (event: { url: string }) => {
      if (event.url.includes('access_token=') || event.url.includes('#access_token')) {
        try {
          const session = await createSessionFromUrl(event.url);
          finish(session);
        } catch {
          finish(null);
        }
      }
    };
    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.openURL(authUrl);
    const timeoutId = setTimeout(() => finish(null), 5 * 60 * 1000);
  });
}
