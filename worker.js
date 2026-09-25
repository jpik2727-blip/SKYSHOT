/**
 * Skyshot Polska — pośrednik przed plikami strony na Cloudflare.
 *
 * Cloudflare podaje pliki w całości, nawet gdy przeglądarka prosi o fragment.
 * Safari na iPhonie i iPadzie wymaga odpowiedzi fragmentami (HTTP 206),
 * inaczej w ogóle nie odtworzy filmu. Ten skrypt obsługuje takie prośby
 * dla plików z folderu /media/ — wszystko inne przechodzi bez zmian.
 */
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const range = request.headers.get('Range');
    if (!range || response.status !== 200 || !response.body) return response;

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === '' && match[2] === '')) return response;

    let size = Number(response.headers.get('Content-Length'));
    let body = response.body;
    if (!size) {
      // Brak rozmiaru w nagłówku — ustalamy go, wczytując plik
      const buffer = await response.arrayBuffer();
      size = buffer.byteLength;
      body = new Blob([buffer]).stream();
    }

    let start, end;
    if (match[1] === '') {                      // "bytes=-500" → ostatnie 500 bajtów
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
    }

    if (start > end || start >= size) {
      body.cancel();
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }

    // Przepuszczamy tylko potrzebny fragment strumienia
    let position = 0;
    const slicer = new TransformStream({
      transform(chunk, controller) {
        const chunkStart = position;
        const chunkEnd = position + chunk.byteLength;   // bez włączenia
        position = chunkEnd;
        if (chunkEnd <= start || chunkStart > end) return;
        const from = Math.max(0, start - chunkStart);
        const to = Math.min(chunk.byteLength, end + 1 - chunkStart);
        controller.enqueue(chunk.subarray(from, to));
      },
    });
    body.pipeTo(slicer.writable).catch(() => {});

    // Strumień o znanej długości — dzięki temu Cloudflare wysyła nagłówek
    // Content-Length, którego Safari oczekuje przy odpowiedziach 206.
    const length = end - start + 1;
    const fixed = new FixedLengthStream(length);
    slicer.readable.pipeTo(fixed.writable).catch(() => {});

    const headers = new Headers(response.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Accept-Ranges', 'bytes');
    headers.delete('Content-Length');
    return new Response(fixed.readable, { status: 206, headers });
  },
};
