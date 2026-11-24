import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { insertAdminAudit } from "@/lib/admin-audit";
import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import { blockbustersFetch } from "@/lib/blockbusters-server";
import { getPool } from "@/lib/db";
import { canAccessDashboard, type PermissionName } from "@/lib/permissions";

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

type WriteRule = {
  permission: PermissionName;
  action: string;
  reasonRequired: boolean;
  stepUp: boolean;
  resource: "title" | "video";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRule(method: string, path: string): WriteRule | null {
  if (method === "POST" && path === "titles") {
    return { permission: "blockbusters.write", action: "blockbusters.title.create", reasonRequired: false, stepUp: false, resource: "title" };
  }
  if (method === "PATCH" && new RegExp(`^titles/${ID}$`, "i").test(path)) {
    return { permission: "blockbusters.write", action: "blockbusters.title.update", reasonRequired: false, stepUp: false, resource: "title" };
  }
  if (method === "POST" && new RegExp(`^titles/${ID}/publish$`, "i").test(path)) {
    return { permission: "blockbusters.publish", action: "blockbusters.title.publish", reasonRequired: true, stepUp: false, resource: "title" };
  }
  if (method === "POST" && new RegExp(`^titles/${ID}/unpublish$`, "i").test(path)) {
    return { permission: "blockbusters.publish", action: "blockbusters.title.unpublish", reasonRequired: true, stepUp: false, resource: "title" };
  }
  if (method === "DELETE" && new RegExp(`^titles/${ID}$`, "i").test(path)) {
    return { permission: "blockbusters.delete", action: "blockbusters.title.delete", reasonRequired: true, stepUp: true, resource: "title" };
  }
  if (method === "POST" && path === "uploads/init") {
    return { permission: "blockbusters.write", action: "blockbusters.video.upload", reasonRequired: false, stepUp: false, resource: "video" };
  }
  if (method === "POST" && ["uploads/complete", "uploads/abort"].includes(path)) {
    return { permission: "blockbusters.write", action: "blockbusters.video.upload", reasonRequired: false, stepUp: false, resource: "video" };
  }
  if (method === "POST" && path === "images/presign") {
    return { permission: "blockbusters.write", action: "blockbusters.title.image_upload", reasonRequired: false, stepUp: false, resource: "title" };
  }
  if (method === "POST" && new RegExp(`^videos/${ID}/retry$`, "i").test(path)) {
    return { permission: "blockbusters.write", action: "blockbusters.video.retry", reasonRequired: true, stepUp: false, resource: "video" };
  }
  return null;
}

function auditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(auditValue);
  if (!isRecord(value)) return value;
  const hidden = new Set([
    "uploadUrl", "url", "publicUrl", "sourceKey", "hlsKey", "uploadId",
    "adminSubject", "adminRequestId",
  ]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !hidden.has(key))
      .map(([key, child]) => [key, auditValue(child)]),
  );
}

function responseMessage(body: unknown, fallback: string) {
  return isRecord(body) && typeof body.message === "string" ? body.message : fallback;
}

async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const subpath = path.join("/");
  const rule = getRule(request.method, subpath);
  if (!rule) {
    return NextResponse.json({ message: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const guard = await requirePermission(request, rule.permission);
  if ("error" in guard) return guard.error;
  if (!canAccessDashboard(guard.admin.dashboards, "blockbusters")) {
    return NextResponse.json({ message: "You do not have access to Block Busters." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (rule.stepUp) {
    const stepUp = requireRecentAuth(guard.admin, "/blockbusters/titles");
    if (stepUp) return stepUp;
  }
  const rawBody: unknown = await request.json().catch(() => null);
  if (!isRecord(rawBody)) {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
  const body = { ...rawBody };
  const suppliedReason = typeof body.reason === "string" ? body.reason.trim() : "";
  delete body.reason;
  if (suppliedReason.length > 1000 || (rule.reasonRequired && suppliedReason.length < 3)) {
    return NextResponse.json(
      { message: rule.reasonRequired ? "Enter a reason for this change (3 to 1000 characters)." : "Reason must be no more than 1000 characters." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    rule.action === "blockbusters.title.delete" &&
    (typeof body.confirmation !== "string" || !body.confirmation.trim() || body.confirmation.length > 200)
  ) {
    return NextResponse.json({ message: "Type the title name to confirm deletion." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }

  const reason = suppliedReason || rule.action.replaceAll(".", " ");
  const requestId = randomUUID();
  let upstream: Response;
  try {
    upstream = await blockbustersFetch(
      `/api/internal/admin/${subpath}`,
      guard.admin,
      request,
      {
        method: request.method as "POST" | "PATCH" | "DELETE",
        body,
        reason,
        requestId,
      },
    );
  } catch (error) {
    console.error("Block Busters write request failed:", error);
    return NextResponse.json({ message: "Block Busters service is unavailable." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const responseBody: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return NextResponse.json({ message: "Block Busters service credentials rejected." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
    return NextResponse.json(
      { message: responseMessage(responseBody, "Block Busters request failed.") },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isRecord(responseBody) || !("data" in responseBody)) {
    console.error("Block Busters returned an invalid write response.");
    return NextResponse.json({ message: "Block Busters returned an invalid response." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const segments = subpath.split("/");
  const idFromPath = segments.length > 1 && segments[0] !== "uploads" && segments[0] !== "images"
    ? segments[1]
    : null;
  const data = isRecord(responseBody.data) ? responseBody.data : {};
  const resourceId =
    (typeof data.id === "string" && data.id) ||
    (typeof data.videoId === "string" && data.videoId) ||
    idFromPath ||
    (typeof body.titleId === "string" ? body.titleId : "unknown");
  const resourceType =
    subpath.startsWith("uploads/") || subpath.startsWith("videos/") ? "video" : rule.resource;
  try {
    const client = await getPool().connect();
    try {
      await insertAdminAudit(client, {
        admin: guard.admin,
        request,
        action: rule.action,
        resource: `blockbusters.${resourceType}:${resourceId}`,
        reason,
        before: responseBody.before === null || responseBody.before === undefined
          ? null
          : auditValue(responseBody.before) as Record<string, unknown>,
        after: auditValue(responseBody.data) as Record<string, unknown>,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Could not write admin audit for Block Busters action:", error);
  }

  return NextResponse.json(responseBody, {
    status: upstream.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
