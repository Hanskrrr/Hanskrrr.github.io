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

function readExhibit(value) {
  const text = (input, maximum) => {
    if (typeof input !== 'string' || input.length > maximum) throw new Error('Invalid content');
    return input;
  };
  if (!value || value.version !== 1 || !Array.isArray(value.articles) ||
      !Array.isArray(value.images) || value.articles.length > 100 || value.images.length > 100) {
    throw new Error('Invalid content');
  }
  const media = (item, allowedTypes) => {
    if (!item || !allowedTypes.includes(item.mime)) throw new Error('Invalid content');
    decodeBase64(item.data);
    return { title: text(item.title, 300), mime: item.mime, data: item.data };
  };
  const exhibit = {
    version: 1,
    title: text(value.title, 300),
    intro: text(value.intro, 10_000),
    articles: value.articles.map(article => ({
      title: text(article?.title, 300),
      body: text(article?.body, 500_000),
    })),
    images: value.images.map(item => media(item, ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])),
  };
  if (value.audio !== undefined) {
    exhibit.audio = media(value.audio, ['audio/wav', 'audio/mpeg', 'audio/ogg']);
  }
  // Optional timeline for the room's wall map: [{ date, title, text? }].
  if (value.timeline !== undefined) {
    if (!Array.isArray(value.timeline) || value.timeline.length > 200) throw new Error('Invalid content');
    exhibit.timeline = value.timeline.map(entry => {
      const item = { date: text(entry?.date, 40), title: text(entry?.title, 300) };
      if (entry.text !== undefined) item.text = text(entry.text, 5000);
      return item;
    });
  }
  return exhibit;
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
