export async function boundedJson(response: Response, maxBytes = 8192): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('application/json') || !response.body)
    throw new Error('unavailable');
  const reader = response.body.getReader();
  let total = 0,
    text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('unavailable');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    await reader.cancel();
  }
}
