import {API_URL} from './firebase-config.js';
import {isNewsImageDataUrl} from './news-utils.js';

const PUBLIC_ACTIONS = new Set(['listPublicNews', 'getPublicNews', 'getNewsImage']);
const LIST_STORAGE_KEY = 'huit:news-list:v2';
const LIST_FRESH_MS = 20_000, LIST_MAX_AGE_MS = 120_000;
const LIST_MAX_ENTRIES = 8, LIST_MAX_BYTES = 240_000;
const IMAGE_MAX_AGE_MS = 20_000, IMAGE_MAX_BYTES = 3_000_000;
const listCache = new Map(), imageCache = new Map(), pending = new Map();
let storageLoaded = false;

// Normalize defaults and field order so equivalent calls share one request.
function requestParams(action, payload = {}) {
  if (action === 'listPublicNews') return {
    category: String(payload.category || ''),
    page: String(payload.page || 1),
    query: String(payload.query || '').trim().slice(0, 150)
  };
  return {id: String(payload.id || '')};
}
function requestKey(action, payload) {return action + ':' + JSON.stringify(requestParams(action, payload));}
function abortError() {return Object.assign(new Error('Đã hủy tải tin tức.'), {name: 'AbortError'});}
function trimListCache() {
  const now = Date.now();
  for (const [key, entry] of listCache) if (now - entry.savedAt > LIST_MAX_AGE_MS || entry.savedAt > now) listCache.delete(key);
  while (listCache.size > LIST_MAX_ENTRIES || JSON.stringify([...listCache]).length * 2 > LIST_MAX_BYTES) {
    listCache.delete(listCache.keys().next().value);
  }
}
function validList(data) {return data?.success === true && Array.isArray(data.posts) && data.posts.every(post => post && typeof post.id === 'string' && (!post.status || post.status === 'published'));}
function loadStoredLists() {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    const raw = sessionStorage.getItem(LIST_STORAGE_KEY);
    if (!raw || raw.length * 2 > LIST_MAX_BYTES) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    entries.slice(-LIST_MAX_ENTRIES).forEach(([key, entry]) => {
      if (typeof key === 'string' && Number.isFinite(entry?.savedAt) && validList(entry.data)) listCache.set(key, entry);
    });
    trimListCache();
  } catch {/* Storage may be disabled; network reads still work. */}
}
function storeList(key, data) {
  if (!validList(data)) return;
  loadStoredLists();
  listCache.delete(key);
  listCache.set(key, {savedAt: Date.now(), data});
  trimListCache();
  try {sessionStorage.setItem(LIST_STORAGE_KEY, JSON.stringify([...listCache]));} catch {/* Quota is optional. */}
}

/** A short-lived, public-only snapshot for immediate rendering while refreshing. */
export function getCachedNewsList(payload = {}, {allowStale = false} = {}) {
  loadStoredLists();
  trimListCache();
  const entry = listCache.get(requestKey('listPublicNews', payload));
  if (!entry) return null;
  const stale = Date.now() - entry.savedAt >= LIST_FRESH_MS;
  return stale && !allowStale ? null : {...entry, stale};
}
export function invalidatePublicNewsCache() {
  listCache.clear(); imageCache.clear();
  try {sessionStorage.removeItem(LIST_STORAGE_KEY);} catch {/* Optional storage. */}
}

function startRequest(action, payload, key) {
  const controller = new AbortController();
  const entry = {controller, consumers: new Set(), promise: null};
  const url = new URL(API_URL, window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(requestParams(action, payload)).forEach(([name, value]) => url.searchParams.set(name, value));
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error('Tải tin tức quá lâu. Kiểm tra kết nối rồi thử lại.'), {code: 'NEWS_TIMEOUT'}));
      controller.abort();
    }, 20_000);
  });
  const cancelled = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(abortError()), {once: true}));
  // The deadline includes reading the body, which may also stall on a slow connection.
  const request = (async () => {
    const response = await fetch(url, {signal: controller.signal, redirect: 'follow', cache: 'no-store'});
    let result;
    try {result = await response.json();} catch (error) {
      if (controller.signal.aborted) throw abortError();
      throw new Error('Chưa đọc được dữ liệu tin tức từ máy chủ.');
    }
    if (!response.ok || result?.success !== true) throw Object.assign(new Error(result?.message || 'Chưa tải được tin tức. Vui lòng thử lại.'), {code: result?.code});
    if (action === 'listPublicNews' && !validList(result)) throw new Error('Dữ liệu danh sách tin tức chưa hợp lệ.');
    return result;
  })();
  entry.promise = Promise.race([request, timeout, cancelled]).then(result => {
    if (!controller.signal.aborted && action === 'listPublicNews') storeList(key, result);
    return result;
  }).finally(() => {
    clearTimeout(timer);
    if (pending.get(key) === entry) pending.delete(key);
  });
  pending.set(key, entry);
  return entry;
}

// Each caller owns its cancellation; cancelling one view does not cancel another.
function consumeRequest(entry, key, signal) {
  return new Promise((resolve, reject) => {
    const consumer = {};
    entry.consumers.add(consumer);
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      entry.consumers.delete(consumer);
      callback(value);
    };
    const onAbort = () => {
      finish(reject, abortError());
      if (!entry.consumers.size) {
        entry.controller.abort();
        if (pending.get(key) === entry) pending.delete(key);
      }
    };
    signal?.addEventListener('abort', onAbort, {once: true});
    entry.promise.then(value => finish(resolve, value), error => finish(reject, error));
    if (signal?.aborted) onAbort();
  });
}

export async function publicNewsRequest(action, payload = {}, {signal, fresh = false} = {}) {
  if (!PUBLIC_ACTIONS.has(action)) throw new Error('Thao tác đọc tin không hợp lệ.');
  if (signal?.aborted) throw abortError();
  if (action === 'listPublicNews' && !fresh) {
    const cached = getCachedNewsList(payload);
    if (cached) return cached.data;
  }
  const key = requestKey(action, payload);
  return consumeRequest(pending.get(key) || startRequest(action, payload, key), key, signal);
}

export async function loadNewsImage(id, {signal, revision = ''} = {}) {
  if (signal?.aborted) throw abortError();
  const now = Date.now(), key = id + ':' + revision;
  for (const [imageKey, item] of imageCache) if (now - item.savedAt >= IMAGE_MAX_AGE_MS) imageCache.delete(imageKey);
  if (imageCache.has(key)) return imageCache.get(key).dataUrl;
  // Images are never persisted. After 20 seconds the server checks publication again.
  const result = await publicNewsRequest('getNewsImage', {id}, {signal});
  if (!isNewsImageDataUrl(result.dataUrl)) throw new Error('Ảnh bài viết chưa sẵn sàng.');
  imageCache.set(key, {dataUrl: result.dataUrl, savedAt: Date.now()});
  let bytes = [...imageCache.values()].reduce((sum, item) => sum + item.dataUrl.length * 2, 0);
  while (imageCache.size > 6 || bytes > IMAGE_MAX_BYTES) {
    const oldest = imageCache.keys().next().value;
    bytes -= imageCache.get(oldest).dataUrl.length * 2;
    imageCache.delete(oldest);
  }
  return result.dataUrl;
}
