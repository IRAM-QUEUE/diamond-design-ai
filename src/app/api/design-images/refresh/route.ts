import { NextResponse } from "next/server";
import { handleApiError, parseJsonBody } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/services/supabase/admin";
import { createSignedImageUrls } from "@/services/supabase/storage";

export const runtime = "nodejs";

type RefreshImageLinksBody = {
  imageIds?: unknown;
};

type RefreshableImageRecord = {
  id: string;
  image_url: string | null;
  storage_path: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumImagesPerRequest = 100;

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof NextResponse) return auth;

    const body = await parseJsonBody<RefreshImageLinksBody>(request);
    const requestedIds = Array.isArray(body.imageIds) ? body.imageIds : [];
    const imageIds = Array.from(
      new Set(requestedIds.filter((id): id is string => typeof id === "string" && uuidPattern.test(id)))
    ).slice(0, maximumImagesPerRequest);

    if (!imageIds.length) {
      return NextResponse.json({ images: [] });
    }

    const admin = createAdminSupabaseClient();
    if (!admin) {
      return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
    }

    const { data, error } = await admin
      .from("design_images")
      .select("id,image_url,storage_path")
      .eq("user_id", auth.user.id)
      .in("id", imageIds);

    if (error) throw error;

    const records = (data ?? []) as RefreshableImageRecord[];
    const signedUrls = await createSignedImageUrls(
      records.map((record) => record.storage_path).filter((path): path is string => Boolean(path))
    );

    return NextResponse.json({
      images: records.map((record) => ({
        id: record.id,
        url: record.storage_path ? signedUrls.get(record.storage_path) ?? record.image_url ?? "" : record.image_url ?? ""
      }))
    });
  } catch (error) {
    return handleApiError(error, "Wishlist image links could not be refreshed.");
  }
}
