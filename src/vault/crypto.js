import { isAllowedEmbed } from './embeds.js';

const ENVELOPE_VERSION = 1;
const ITERATIONS = 600_000;
const AAD = new TextEncoder().encode('gallery-exhibit:v1');
const MAX_CIPHERTEXT_BYTES = 16 * 1024 * 1024;
const FAILURE_MESSAGE = '无法解锁内容，请检查输入后重试。';

function decodeBase64(value, maxBytes = MAX_CIPHERTEXT_BYTES) {
  if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid data');
  }
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (bytes.length > maxBytes) throw new Error('Invalid data');
  return bytes;
}

function readEnvelope(envelope) {
  if (!envelope || envelope.version !== ENVELOPE_VERSION ||
      envelope.kdf?.name !== 'PBKDF2' || envelope.kdf.hash !== 'SHA-256' ||
      envelope.kdf.iterations !== ITERATIONS || envelope.cipher?.name !== 'AES-GCM' ||
      envelope.cipher.length !== 256 || envelope.cipher.tagLength !== 128) {
    throw new Error('Invalid data');
  }
  const salt = decodeBase64(envelope.kdf.salt, 16);
  const iv = decodeBase64(envelope.cipher.iv, 12);
  const ciphertext = decodeBase64(envelope.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
    throw new Error('Invalid data');
  }
  return { salt, iv, ciphertext };
}

const IMAGE_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
const AUDIO_TYPES = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/webm'];
const MEDIA_AAD = new TextEncoder().encode('gallery-media:v1');

/**
 * Validate decrypted content; unknown fields are dropped. Shape:
 * { version, title, intro, introHtml?, articles, photos, books, films, music, timeline? }
 * Media is either inline { mime, data } or a separately encrypted file
 * { mime, file: 'room/<hex>.bin', key, iv, sha256? } (see decryptMedia).
 * The older { images, audio } fields are read as photos and one music item.
 */
export function readExhibit(value) {
  const fail = () => { throw new Error('Invalid content'); };
  const text = (input, maximum) => (typeof input === 'string' && input.length <= maximum ? input : fail());
  const optional = (item, key, maximum, target) => { if (item[key] !== undefined) target[key] = text(item[key], maximum); };
  const list = (input, maximum = 500) => (input === undefined ? [] : Array.isArray(input) && input.length <= maximum ? input : fail());
  const url = input => (/^https?:\/\/[^\s"'<>]+$/.test(text(input, 2000)) ? input : fail());
  const media = (item, types) => {
    if (!item || !types.includes(item.mime)) fail();
    if (item.data !== undefined) { decodeBase64(item.data); return { mime: item.mime, data: item.data }; }
    if (!/^room\/[0-9a-f]{32}\.bin$/.test(item.file) || decodeBase64(item.key, 32).length !== 32 || decodeBase64(item.iv, 12).length !== 12) fail();
    const ref = { mime: item.mime, file: item.file, key: item.key, iv: item.iv };
    if (item.sha256 !== undefined) ref.sha256 = /^[0-9a-f]{64}$/.test(item.sha256) ? item.sha256 : fail();
    return ref;
  };
  /** Shared fields of shelf items (books, films, music): text, links, a cover and a comment. */
  const shelfItem = (item, fields) => {
    if (!item || typeof item !== 'object') fail();
    const out = { title: text(item.title, 300) };
    for (const key of fields) optional(item, key, 300, out);
    if (item.link !== undefined) out.link = url(item.link);
    if (item.embed !== undefined) out.embed = isAllowedEmbed(item.embed) ? item.embed : fail();
    if (item.cover !== undefined) out.cover = media(item.cover, IMAGE_TYPES);
    if (item.audio !== undefined) out.audio = media(item.audio, AUDIO_TYPES);
    optional(item, 'html', 4_000_000, out);
    return out;
  };
  if (!value || value.version !== 1 || !Array.isArray(value.articles) || value.articles.length > 500) fail();
  const exhibit = {
    version: 1,
    title: text(value.title, 300),
    intro: text(value.intro, 10_000),
    // Private vault notes also carry pre-rendered html (from scripts/publish.mjs) and a date.
    articles: value.articles.map(article => {
      const item = { title: text(article?.title, 300), body: text(article?.body, 500_000) };
      optional(article, 'html', 4_000_000, item);
      optional(article, 'date', 40, item);
      return item;
    }),
    photos: [
      ...list(value.images, 200).map(item => ({ title: text(item?.title, 300), media: media(item, IMAGE_TYPES) })),
      ...list(value.photos, 500).map(item => ({ title: text(item?.title, 300), media: media(item?.media, IMAGE_TYPES) })),
    ],
    books: list(value.books).map(item => shelfItem(item, ['author', 'year', 'shelf'])),
    films: list(value.films).map(item => shelfItem(item, ['director', 'year', 'kind'])),
    music: [
      ...(value.audio !== undefined ? [{ title: text(value.audio.title, 300), audio: media(value.audio, AUDIO_TYPES) }] : []),
      ...list(value.music).map(item => shelfItem(item, ['artist', 'album', 'year'])),
    ],
  };
  optional(value, 'introHtml', 1_000_000, exhibit);
  // Optional timeline for the room's wall map: [{ date, title, text? }].
  if (value.timeline !== undefined) {
    exhibit.timeline = list(value.timeline, 500).map(entry => {
      const item = { date: text(entry?.date, 40), title: text(entry?.title, 300) };
      optional(entry, 'text', 5000, item);
      return item;
    });
  }
  return exhibit;
}

/** Fetch and decrypt one separately encrypted media file; returns its bytes. */
export async function decryptMedia(ref, { signal } = {}) {
  const response = await fetch(new URL(`../data/${ref.file}`, import.meta.url), { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Media unavailable');
  const key = await crypto.subtle.importKey('raw', decodeBase64(ref.key, 32), 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(ref.iv, 12), additionalData: MEDIA_AAD, tagLength: 128 },
    key, await response.arrayBuffer(),
  ));
}

/** Decrypt and validate one authenticated envelope. No password or key is retained. */
export async function decryptPayload(envelope, passphrase) {
  let plaintext;
  try {
    if (typeof passphrase !== 'string' || passphrase.length === 0 || passphrase.length > 1024) {
      throw new Error('Invalid input');
    }
    const { salt, iv, ciphertext } = readEnvelope(envelope);
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt },
      material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
    );
    plaintext = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: AAD, tagLength: 128 }, key, ciphertext,
    ));
    return readExhibit(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
  } catch {
    // Malformed data, authentication failure and wrong passwords have the same public result.
    throw new Error(FAILURE_MESSAGE);
  } finally {
    plaintext?.fill(0);
  }
}

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('操作已取消。', 'AbortError');
}

/** Fetch ciphertext; decryption occurs only in this browser. */
export async function unlockExhibit(passphrase, { signal } = {}) {
  try {
    checkAbort(signal);
    const response = await fetch(new URL('../data/exhibit.enc.json', import.meta.url), {
      signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(FAILURE_MESSAGE);
    const envelope = await response.json();
    checkAbort(signal);
    const exhibit = await decryptPayload(envelope, passphrase);
    // Web Crypto itself cannot be cancelled, so discard a late result after navigation/lock.
    checkAbort(signal);
    return exhibit;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') {
      throw new DOMException('操作已取消。', 'AbortError');
    }
    throw new Error(FAILURE_MESSAGE);
  }
}
