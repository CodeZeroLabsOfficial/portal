/**
 * Turn Firestore / Admin SDK error text into short copy for public proposal flows.
 * In development, the original message is usually preserved by {@link runAdminWrite}.
 */
export function softenPublicFirestoreErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("permission") || m.includes("insufficient permission") || m.includes("denied")) {
    return "We couldn't complete that request due to a permissions issue. Please contact support.";
  }
  if (
    m.includes("unavailable") ||
    m.includes("deadline-exceeded") ||
    m.includes("deadline exceeded") ||
    m.includes("aborted")
  ) {
    return "The service is temporarily unavailable. Please try again in a moment.";
  }
  if (m.includes("bucket") && m.includes("not specified")) {
    return "File storage is not configured correctly on the server. Please contact support.";
  }
  return message;
}
