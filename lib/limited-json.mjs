export async function readLimitedJson(request, maxBytes) {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { error: 'Request too large', status: 413 };
  }

  if (!request.body) return { error: 'Invalid JSON', status: 400 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return { error: 'Request too large', status: 413 };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { data: JSON.parse(text) };
  } catch {
    return { error: 'Invalid JSON', status: 400 };
  } finally {
    reader.releaseLock();
  }
}
