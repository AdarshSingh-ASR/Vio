import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    authenticated_chat: { executor: "ramping-vus", startVUs: 1, stages: [{ duration: "30s", target: 5 }, { duration: "60s", target: 5 }, { duration: "30s", target: 0 }] },
  },
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<10000"] },
};

export default function authenticatedHistoryScenario() {
  const base = __ENV.E2E_BASE_URL;
  const jwt = __ENV.E2E_APPWRITE_JWT;
  if (!base || !jwt) throw new Error("E2E_BASE_URL and E2E_APPWRITE_JWT are required; this load test never uses mock authentication");
  const response = http.get(`${base.replace(/\/$/, "")}/api/chat/history?limit=20`, { headers: { "X-Appwrite-JWT": jwt } });
  check(response, { "history succeeds": (result) => result.status === 200 });
  sleep(1);
}
