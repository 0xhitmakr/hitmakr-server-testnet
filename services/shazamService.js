import { Shazam } from "node-shazam";

const shazam = new Shazam();

export async function recognizeSong(filePath) {
  try {
    const recognition = await shazam.recognise(filePath, "en-US");
    return recognition;
  } catch (error) {
    console.error("Shazam recognition error:", error);
    throw error;
  }
}

export function checkSongExistence(recognition) {
  return !!(recognition && recognition.track);
}