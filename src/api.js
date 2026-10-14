// Apps Script 창구 부르기. 본문은 JSON 글자를 text/plain으로 보낸다(브라우저 CORS 사전 요청을 피하려고).
import { API_URL } from './config.js';

export class AuthError extends Error {}
export class ApiError extends Error {}

const MESSAGES = {
  bad_request: '요청이 올바르지 않아요.',
  bad_action: '앱을 닫았다가 다시 열어 주세요.',
  server: '서버에서 오류가 났어요.'
};

let transport = null;

async function getTransport() {
  if (transport) return transport;
  if (import.meta.env.VITE_MOCK === '1') {
    // 개발용: 브라우저 안의 가짜 시트로 apps-script 코드를 그대로 돌린다. 배포판에는 들어가지 않는다.
    transport = (await import('./dev/mockServer.js')).mockPost;
  } else {
    transport = async (body) => {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
      if (!res.ok) throw new ApiError(`서버가 답하지 않아요 (${res.status}). 잠시 뒤 다시 해 주세요.`);
      try {
        return await res.json();
      } catch {
        throw new ApiError('서버가 잠시 답하지 않아요. 잠시 뒤 다시 해 주세요.');
      }
    };
  }
  return transport;
}

export async function call(code, action, payload = {}) {
  const send = await getTransport();
  let json;
  try {
    json = await send(JSON.stringify({ ...payload, action, code }));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('연결이 안 돼요. 인터넷을 확인해 주세요.');
  }
  if (!json || typeof json !== 'object') throw new ApiError('서버 응답이 이상해요.');
  if (!json.ok) {
    if (json.error === 'bad_code') throw new AuthError('코드가 맞지 않아요. 받은 링크나 코드를 다시 넣어 주세요.');
    throw new ApiError(json.message || MESSAGES[json.error] || '저장하지 못했어요.');
  }
  return json;
}
