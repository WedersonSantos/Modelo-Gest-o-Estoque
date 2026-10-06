import { assertSameOrigin, logout } from "@/shared/lib/auth";
import { errorResponse } from "@/shared/lib/errors";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await logout();
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
