import React, { useState, useRef, useEffect } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { Close as CloseIcon, ChevronLeft, ChevronRight } from "@mui/icons-material";

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
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "rgba(0,0,0,0.95)",
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* CONTAINER INTERNO */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: "100vw",
          maxHeight: "100vh",
        }}
      >
        {/* BOTÃO FECHAR */}
        <IconButton
          onClick={onClose}
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            bgcolor: "white",
            "&:hover": { bgcolor: "grey.200" },
            zIndex: 100000,
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* ÁREA DA IMAGEM */}
        <Box
          sx={{
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
          <Box
            component="img"
            src={imageSrc}
            alt=""
            draggable={false}
            sx={{
              width: "auto",
              height: "auto",
              maxWidth: "95vw",
              maxHeight: "75vh",
              ...(window.innerWidth > window.innerHeight && {
                maxHeight: "70vh",
                maxWidth: "90vw",
              }),
              objectFit: "contain",
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isDragging.current ? "none" : "transform 0.2s ease-out",
              borderRadius: 2,
              userSelect: "none",
            }}
          />
        </Box>

        {/* LEGENDA */}
        {current.caption && (
          <Typography
            sx={{
              color: "white",
              mt: 2,
              px: 2,
              py: 1,
              bgcolor: "rgba(0,0,0,0.55)",
              borderRadius: 1,
              maxWidth: "90%",
              textAlign: "center",
            }}
          >
            {current.caption}
          </Typography>
        )}

        {/* MINIATURAS (THUMBNAILS) */}
        <Box
          sx={{
            width: "100%",
            overflowX: "auto",
            whiteSpace: "nowrap",
            py: 1.5,
            display: "flex",
            justifyContent: "center",
            gap: 1,
          }}
        >
          {photos.map((p, i) => {
            const thumbSrc = p.url || p.dataUrl;
            return (
              <Box
                key={p.id}
                onClick={() => {
                  setScale(1);
                  setTranslate({ x: 0, y: 0 });
                  setIndex(i);
                }}
                sx={{
                  display: "inline-block",
                  border: i === index ? "3px solid" : "2px solid",
                  borderColor: i === index ? "success.main" : "grey.600",
                  borderRadius: 1,
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <Box
                  component="img"
                  src={thumbSrc}
                  sx={{
                    width: 60,
                    height: 60,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </Box>
            );
          })}
        </Box>

        {/* CONTROLES */}
        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <IconButton
            onClick={prev}
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              color: "white",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <ChevronLeft fontSize="large" />
          </IconButton>
          <IconButton
            onClick={next}
            sx={{
              bgcolor: "rgba(255,255,255,0.1)",
              color: "white",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <ChevronRight fontSize="large" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default PhotoCarousel;
