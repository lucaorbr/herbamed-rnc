import { uploadLocalFile } from "../firebase";

export async function uploadStoredFile(file) {
  return uploadLocalFile(file);
}

export function isExternalStorageUrl(url = "") {
  return /supabase\.co|cloudinary\.com|storage\/v1/i.test(String(url));
}
