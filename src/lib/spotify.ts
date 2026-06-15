// Хелперы Spotify. Все запросы — серверные; client secret и токены НЕ уходят
// в браузер. scope строго минимальный (только «что сейчас играет»).

export const SPOTIFY_SCOPE = "user-read-currently-playing";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";

function creds() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect = process.env.SPOTIFY_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    throw new Error("SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI не заданы");
  }
  return { id, secret, redirect };
}

/** Включён ли Spotify-функционал (заданы переменные). */
export function spotifyConfigured(): boolean {
  return !!(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REDIRECT_URI
  );
}

/** URL авторизации Spotify (куда редиректим пользователя). */
export function buildAuthUrl(state: string): string {
  const { id, redirect } = creds();
  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirect,
    scope: SPOTIFY_SCOPE,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuth(): string {
  const { id, secret } = creds();
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/** Обмен авторизационного кода на токены. Возвращает refresh_token. */
export async function exchangeCode(code: string): Promise<string> {
  const { redirect } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = (await res.json()) as { refresh_token?: string };
  if (!data.refresh_token) throw new Error("no refresh_token in response");
  return data.refresh_token;
}

/** Получить свежий access_token по refresh-токену. */
async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface NowPlaying {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  albumArt?: string;
  songUrl?: string;
}

/** Текущий трек пользователя. Наружу отдаём только безопасный минимум. */
export async function getNowPlaying(refreshToken: string): Promise<NowPlaying> {
  const token = await getAccessToken(refreshToken);
  const res = await fetch(NOW_PLAYING_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // 204 = ничего не играет.
  if (res.status === 204 || res.status > 400) return { isPlaying: false };

  const data = (await res.json()) as {
    is_playing?: boolean;
    item?: {
      name?: string;
      artists?: { name: string }[];
      album?: { images?: { url: string }[] };
      external_urls?: { spotify?: string };
    };
  };
  if (!data.item) return { isPlaying: false };

  return {
    isPlaying: !!data.is_playing,
    title: data.item.name,
    artist: (data.item.artists ?? []).map((a) => a.name).join(", "),
    albumArt: data.item.album?.images?.[0]?.url,
    songUrl: data.item.external_urls?.spotify,
  };
}
