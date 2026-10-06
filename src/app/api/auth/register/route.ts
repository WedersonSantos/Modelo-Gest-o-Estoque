import { assertSameOrigin, register } from "@/shared/lib/auth";
import { errorResponse } from "@/shared/lib/errors";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await register(await request.json());
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
