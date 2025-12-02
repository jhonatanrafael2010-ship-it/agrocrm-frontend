import React, { useState, useRef, useEffect } from "react";

interface PhotoItem {
  id: number;
  url?: string;
  dataUrl?: string;
  caption?: string;
}

interface Props {
  photos: PhotoItem[];
  onClose: () => void;
}

const PhotoCarousel: React.FC<Props> = ({ photos, onClose }) => {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const current = photos[index];
  const imageSrc = current.url || current.dataUrl;

  // 🔒 Impede que o body role atrás do carrossel
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function next() {
    setScale(1);
    setIndex((i) => (i + 1 < photos.length ? i + 1 : 0));
  }

  function prev() {
    setScale(1);
    setIndex((i) => (i - 1 >= 0 ? i - 1 : photos.length - 1));
  }

  // 📌 Zoom com scroll (Desktop)
  function handleWheel(e: React.WheelEvent) {
    // Zoom natural: sem precisar segurar CTRL
    const amount = e.deltaY < 0 ? 0.1 : -0.1;
    setScale((s) => Math.min(Math.max(s + amount, 1), 4));
  }

  // 📌 Gestos mobile
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    touchEndX.current = e.changedTouches[0].clientX;

    if (touchStartX.current - touchEndX.current > 60) next();
    if (touchEndX.current - touchStartX.current > 60) prev();
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{
        background: "rgba(0,0,0,0.92)",
        zIndex: 99999,
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="btn btn-light position-absolute"
          style={{
            top: 20,
            right: 20,
            padding: "6px 10px",
            fontWeight: "bold",
            zIndex: 100000,
          }}
        >
          ✕
        </button>

        {/* Área da imagem */}
        <div
          style={{
            maxWidth: "95vw",
            maxHeight: "80vh",
            overflow: "hidden",
            touchAction: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={imageSrc}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `scale(${scale})`,
              transition: "transform 0.2s ease-out",
            }}
          />
        </div>

        {/* Legenda */}
        {current.caption && (
          <div
            className="text-white mt-3 px-3 py-2"
            style={{
              background: "rgba(0,0,0,0.55)",
              borderRadius: 6,
              maxWidth: "90%",
              textAlign: "center",
              fontSize: "1rem",
              lineHeight: "1.2",
            }}
          >
            {current.caption}
          </div>
        )}

        {/* Controles */}
        <div className="d-flex gap-4 mt-4">
          <button
            className="btn btn-outline-light"
            style={{ padding: "8px 16px", fontSize: "1.2rem" }}
            onClick={prev}
          >
            ◀
          </button>
          <button
            className="btn btn-outline-light"
            style={{ padding: "8px 16px", fontSize: "1.2rem" }}
            onClick={next}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCarousel;
