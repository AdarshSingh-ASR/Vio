import { executeQuery, executeSingle } from "@/lib/tidb";
import { ApiError } from "@/lib/request-auth";

export async function enforceRateLimit(userId: string, routeKey: string, limit: number, windowSeconds: number) {
  const normalizedKey = routeKey.slice(0, 120);
  await executeSingle(
    `INSERT INTO api_rate_limits (user_id, route_key, request_count) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       request_count=IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND), 1, request_count + 1),
       window_started_at=IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND), UTC_TIMESTAMP(), window_started_at)`,
    [userId, normalizedKey, windowSeconds, windowSeconds]
  );
  const rows = await executeQuery<any>(`SELECT request_count, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), DATE_ADD(window_started_at, INTERVAL ? SECOND)) AS retry_after FROM api_rate_limits WHERE user_id=? AND route_key=?`, [windowSeconds, userId, normalizedKey]);
  if (Number(rows[0]?.request_count || 0) > limit) throw new ApiError(429, `Too many requests. Retry in ${Math.max(1, Number(rows[0]?.retry_after || 1))} seconds.`, "RATE_LIMITED");
}
