// Extrae un mensaje legible de cualquier error capturado en `catch (err: unknown)`.
// Cubre Error nativo y objetos tipo PostgrestError que vienen de supabase-js
// (no son `instanceof Error` pero sí tienen `.message`).
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}
