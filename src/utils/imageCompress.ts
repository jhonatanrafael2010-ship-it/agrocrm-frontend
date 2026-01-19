export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.7
): Promise<File> {
  // Cria bitmap (rápido e compatível)
  const img = await createImageBitmap(file);

  // Calcula escala
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  // Canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  ctx.drawImage(img, 0, 0, width, height);

  // Converte para Blob JPEG
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir"))),
      "image/jpeg",
      quality
    );
  });

  // Retorna como File (mantém compatibilidade com FormData)
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
