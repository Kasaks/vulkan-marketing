import { sign } from 'node:crypto';

const yandexApi = 'https://api.webmaster.yandex.net/v4';
const googleTokenUrl = 'https://oauth2.googleapis.com/token';
const pageSize = 500;
const metrics = ['IMPRESSIONS', 'CLICKS', 'CTR', 'POSITION'];
const dataRange = "'Данные'";
const statusRange = "'Статус'!A2:E2";

class ApiError extends Error {
  constructor(service, httpStatus, code) {
    super(`${service}: HTTP ${httpStatus}${code ? ` (${code})` : ''}`);
    this.code = code;
  }
}

async function requestJson(url, service, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45_000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const rawCode = payload?.error_code ?? payload?.error?.status;
    const code = typeof rawCode === 'string' && /^[A-Z_]+$/.test(rawCode) ? rawCode : '';
    throw new ApiError(service, response.status, code);
  }
  if (payload === null) throw new Error(`${service}: ожидался JSON`);
  return payload;
}

function readConfig() {
  const names = ['YANDEX_WEBMASTER_TOKEN', 'YANDEX_WEBMASTER_SITE', 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON', 'SEO_SPREADSHEET_ID'];
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    const message = `Заполните параметры GitHub Actions: ${missing.join(', ')}`;
    if (process.env.GITHUB_EVENT_NAME === 'schedule') {
      console.log(`::notice::${message}`);
      return null;
    }
    throw new Error(message);
  }

  let account;
  let site;
  try {
    account = JSON.parse(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON);
    site = new URL(process.env.YANDEX_WEBMASTER_SITE.trim());
  } catch {
    throw new Error('Проверьте JSON сервисного аккаунта и URL сайта в настройках GitHub Actions');
  }
  if (account?.type !== 'service_account' || !account.client_email || !account.private_key) {
    throw new Error('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON должен содержать ключ сервисного аккаунта Google');
  }
  if (!['https:', 'http:'].includes(site.protocol) || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
    throw new Error('YANDEX_WEBMASTER_SITE должен содержать адрес сайта целиком, без пути и параметров');
  }
  return {
    site: site.origin,
    yandexToken: process.env.YANDEX_WEBMASTER_TOKEN.trim(),
    account,
    spreadsheetId: process.env.SEO_SPREADSHEET_ID.trim(),
  };
}

async function getGoogleToken(account) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = [encode({ alg: 'RS256', typ: 'JWT' }), encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: googleTokenUrl,
    iat: now,
    exp: now + 3600,
  })].join('.');
  let signature;
  try {
    signature = sign('RSA-SHA256', Buffer.from(claim), account.private_key).toString('base64url');
  } catch {
    throw new Error('Google: проверьте закрытый ключ сервисного аккаунта');
  }
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${claim}.${signature}`,
  });
  const { access_token: token } = await requestJson(googleTokenUrl, 'Google OAuth', { method: 'POST', body });
  if (!token) throw new Error('Google OAuth: в ответе отсутствует токен доступа');
  return token;
}

async function getYandexRows(config) {
  const call = (path, body) => requestJson(`${yandexApi}${path}`, 'Яндекс Вебмастер', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `OAuth ${config.yandexToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const { user_id: userId } = await call('/user');
  if (!userId) throw new Error('Яндекс Вебмастер: в ответе отсутствует ID пользователя');
  const { hosts } = await call(`/user/${userId}/hosts`);
  const host = hosts.find(({ ascii_host_url }) => ascii_host_url && new URL(ascii_host_url).origin === config.site);
  if (!host?.host_id) throw new Error('У OAuth-аккаунта нет указанного сайта в Яндекс Вебмастере. Проверьте адрес и доступ');

  const path = `/user/${userId}/hosts/${encodeURIComponent(host.host_id)}/query-analytics/list`;
  const rows = [];
  try {
    for (const [type, label] of [['QUERY', 'Запрос'], ['URL', 'Страница']]) {
      for (let offset = 0; ; offset += pageSize) {
        const result = await call(path, {
          text_indicator: type,
          search_location: 'WEB_LOCATION',
          limit: pageSize,
          offset,
        });
        const entries = result.text_indicator_to_statistics;
        if (!Array.isArray(entries) || !Number.isSafeInteger(result.count)) {
          throw new Error('Яндекс Вебмастер: изменилась структура ответа мониторинга');
        }
        for (const entry of entries) {
          const byDate = new Map();
          const value = entry.text_indicator?.value;
          if (!value || !Array.isArray(entry.statistics)) {
            throw new Error('Яндекс Вебмастер: неполная запись мониторинга');
          }
          for (const { date, field, value: metricValue } of entry.statistics) {
            if (!metrics.includes(field) || !Number.isFinite(metricValue)) continue;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Яндекс Вебмастер: неверная дата в статистике');
            if (!byDate.has(date)) byDate.set(date, {});
            byDate.get(date)[field] = metricValue;
          }
          for (const [date, values] of byDate) {
            rows.push([date, label, value, ...metrics.map((field) => values[field] ?? '')]);
          }
        }
        if (offset + entries.length >= result.count) break;
        if (entries.length !== pageSize) throw new Error('Яндекс Вебмастер вернул неполную страницу данных');
      }
    }
  } catch (error) {
    if (error instanceof ApiError && ['HOST_NOT_INDEXED', 'HOST_NOT_LOADED'].includes(error.code)) {
      return { rows: [], reason: error.code === 'HOST_NOT_INDEXED' ? 'Сайт ещё не проиндексирован' : 'Вебмастер ещё не загрузил данные' };
    }
    throw error;
  }
  return { rows, reason: rows.length ? '' : 'За доступный период Вебмастер не вернул строк' };
}

function rowKey(row) {
  return JSON.stringify(row.slice(0, 3));
}

async function writeGoogleSheet(config, token, { rows, reason }) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
  const call = (path, payload) => requestJson(`${url}${path}`, 'Google Таблицы', {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const updates = [];
  const incoming = new Map(rows.map((row) => [rowKey(row), row]));
  if (incoming.size) {
    const existingRange = encodeURIComponent(`${dataRange}!A2:G`);
    const { values: existing = [] } = await call(`/values/${existingRange}?valueRenderOption=UNFORMATTED_VALUE`);
    const existingRows = new Map(existing.map((row, index) => [rowKey(row), { row, index: index + 2 }]));
    let nextRow = existing.length + 2;
    for (const [key, row] of incoming) {
      const previous = existingRows.get(key);
      if (previous && row.every((cell, index) => cell === (previous.row[index] ?? ''))) continue;
      updates.push({ index: previous?.index ?? nextRow++, row });
    }

    if (nextRow > existing.length + 2) {
      const { sheets } = await call('?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))');
      const data = sheets.find(({ properties }) => properties.title === 'Данные')?.properties;
      if (!data) throw new Error('В Google Таблице отсутствует лист «Данные»');
      const extraRows = nextRow - 1 - data.gridProperties.rowCount;
      if (extraRows > 0) {
        await call(':batchUpdate', { requests: [{ appendDimension: { sheetId: data.sheetId, dimension: 'ROWS', length: extraRows } }] });
      }
    }
  }

  const blocks = [];
  for (const { index, row } of updates.sort((a, b) => a.index - b.index)) {
    const last = blocks.at(-1);
    if (last && index === last.start + last.values.length) {
      last.values.push(row);
    } else {
      blocks.push({ start: index, values: [row] });
    }
  }
  const data = blocks.map(({ start, values }) => ({
    range: `${dataRange}!A${start}:G${start + values.length - 1}`,
    values,
  }));
  data.push({ range: statusRange, values: [[new Date().toISOString(), config.site, reason ? 'Ожидаются данные' : 'Выгрузка завершена', incoming.size, reason]] });
  await call('/values:batchUpdate', { valueInputOption: 'RAW', data });
  console.log(`Вебмастер: ${incoming.size} строк получено, ${updates.length} обновлено. ${reason}`);
}

async function main() {
  const config = readConfig();
  if (!config) return;
  const token = await getGoogleToken(config.account);
  const result = await getYandexRows(config);
  await writeGoogleSheet(config, token, result);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
