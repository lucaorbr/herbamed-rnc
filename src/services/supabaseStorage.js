import { uploadLocalFile } from "../firebase";

export async function uploadPdfToSupabase(file) {
  return uploadLocalFile(file);
}
