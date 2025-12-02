import React, { useState, useRef } from "react";

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

  function next() {
    setScale(1);
    setIndex((i) => (i + 1 < photos.length ? i + 1 : 0));
  }

  function prev() {
    setScale(1);
    setIndex((i) => (i - 1 >= 0 ? i - 1 : photos.length - 1));
  }

  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return;
    const newScale = Math.min(Math.max(scale + (e.deltaY > 0 ? -0.1 : 0.1), 1), 4);
    setScale(newScale);
  }

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
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ background: "rgba(0,0,0,0.9)", zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="d-flex flex-column justify-content-center align-items-center h-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BOTÃO FECHAR */}
        <button
          onClick={onClose}
          className="btn btn-light position-absolute"
          style={{ top: 20, right: 20 }}
        >
          ✕
        </button>

        {/* FOTO */}
        <div
          style={{
            maxWidth: "90%",
            maxHeight: "70%",
            overflow: "hidden",
            touchAction: "none",
          }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={imageSrc}
            alt=""
            style={{
              width: "100%",
              height: "auto",
              transform: `scale(${scale})`,
              transition: "transform 0.2s",
            }}
          />
        </div>

        {/* LEGENDA */}
        {current.caption && (
          <div
            className="text-white mt-3 px-3 py-2"
            style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 6,
              maxWidth: "90%",
              textAlign: "center",
              fontSize: "0.9rem",
            }}
          >
            {current.caption}
          </div>
        )}

        {/* CONTROLES */}
        <div className="d-flex gap-4 mt-3">
          <button className="btn btn-outline-light" onClick={prev}>
            ◀
          </button>
          <button className="btn btn-outline-light" onClick={next}>
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCarousel;
