import { SUPABASE_BUCKET, SUPABASE_KEY, SUPABASE_URL } from "../features/rnc/RncTabs";

export async function uploadPdfToSupabase(file) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${fileName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": file.type || "application/pdf",
      "x-upsert": "true"
    },
    body: file
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Erro no upload Supabase");
  }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;
  return { url: publicUrl, name: file.name, type: file.type, size: file.size };
}
