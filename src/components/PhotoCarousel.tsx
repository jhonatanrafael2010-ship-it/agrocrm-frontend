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
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const lastTap = useRef(0);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
  const pinchStartDistance = useRef(0);
  const pinchStartScale = useRef(1);

  const current = photos[index];
  const imageSrc = current.url || current.dataUrl;

  // 🔒 Trava o body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function next() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIndex((i) => (i + 1 < photos.length ? i + 1 : 0));
  }

  function prev() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIndex((i) => (i - 1 >= 0 ? i - 1 : photos.length - 1));
  }


  function getDistance(touches: React.TouchList) {
    if (touches.length < 2) return 0;

    const [t1, t2] = [touches[0], touches[1]];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }


  // 🎯 Zoom progressivo no scroll
  function handleWheel(e: React.WheelEvent) {
    const amount = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((s) => Math.min(Math.max(s + amount, 1), 4));
  }

  // 🎯 Gestos SWIPE (trocar fotos)
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
        // PINCH INICIADO
        pinchStartDistance.current = getDistance(e.touches);
        pinchStartScale.current = scale;
        return;
    }

    // Swipe padrão
    touchStartX.current = e.touches[0].clientX;

    // Drag quando já tem zoom
    if (scale > 1) {
        isDragging.current = true;
        dragStart.current = {
        x: e.touches[0].clientX - translate.x,
        y: e.touches[0].clientY - translate.y,
        };
    }
    }


  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
        const newDistance = getDistance(e.touches);
        if (!pinchStartDistance.current) return;

        const ratio = newDistance / pinchStartDistance.current;

        let newScale = pinchStartScale.current * ratio;

        newScale = Math.max(1, Math.min(newScale, 4)); // limites

        setScale(newScale);
        return;
    }

    // Movimentar arrasto com 1 dedo
    if (!isDragging.current || scale === 1) return;

    setTranslate({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
    });
    }


  function handleTouchEnd(e: React.TouchEvent) {
    // Finaliza pinch
    if (e.touches.length < 2) {
        pinchStartDistance.current = 0;
    }

    isDragging.current = false;

    // Swipe só quando zoom = 1
    if (scale === 1) {
        touchEndX.current = e.changedTouches[0].clientX;

        if (touchStartX.current - touchEndX.current > 60) next();
        if (touchEndX.current - touchStartX.current > 60) prev();
    }
    }


  // 🎯 Zoom duplo clique / duplo toque
  function handleDoubleTap() {
    const now = Date.now();

    if (now - lastTap.current < 300) {
      // double tap
      setScale((s) => (s === 1 ? 2 : 1));
      setTranslate({ x: 0, y: 0 });
    }

    lastTap.current = now;
  }

  // 🎯 Arrastar com mouse quando estiver com zoom
  function handleMouseDown(e: React.MouseEvent) {
    if (scale === 1) return;

    isDragging.current = true;
    dragStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || scale === 1) return;

    setTranslate({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }

  function handleMouseUp() {
    isDragging.current = false;
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{
        background: "rgba(0,0,0,0.9)",
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={onClose}
    >
      {/* CONTAINER INTERNO */}
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* BOTÃO FECHAR */}
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

        {/* ÁREA DA IMAGEM */}
        <div
          style={{
            maxWidth: "95vw",
            maxHeight: "80vh",
            overflow: "hidden",
            touchAction: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
          onWheel={handleWheel}
          onTouchStart={(e) => {
            handleTouchStart(e);
            handleDoubleTap();
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isDragging.current ? "none" : "transform 0.2s ease-out",
              borderRadius: 8,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* LEGENDA */}
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

        {/* CONTROLES */}
        <div className="d-flex gap-4 mt-4">
          <button className="btn btn-outline-light" style={{ padding: "8px 16px", fontSize: "1.2rem" }} onClick={prev}>
            ◀
          </button>
          <button className="btn btn-outline-light" style={{ padding: "8px 16px", fontSize: "1.2rem" }} onClick={next}>
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCarousel;
