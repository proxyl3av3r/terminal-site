// Конвертация картинки в ASCII — полностью в браузере (canvas), на сервер
// изображение не уходит. Используется и в /dashboard/ascii, и в чате.
const RAMP = "@%#*+=-:. "; // тёмный → светлый

export function imageToAscii(
  file: File,
  cols = 80,
  invert = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("not an image"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Поправка на «вытянутость» моноширинного символа (~0.5).
      const rows = Math.max(1, Math.round((img.height / img.width) * cols * 0.5));
      const canvas = document.createElement("canvas");
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error("no canvas"));
      }
      ctx.drawImage(img, 0, 0, cols, rows);
      const { data } = ctx.getImageData(0, 0, cols, rows);
      const ramp = invert ? [...RAMP].reverse().join("") : RAMP;
      let out = "";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const a = data[i + 3] / 255;
          const lum =
            (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          const v = lum * a + (1 - a);
          const idx = Math.min(ramp.length - 1, Math.floor(v * (ramp.length - 1)));
          out += ramp[idx];
        }
        out += "\n";
      }
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}
