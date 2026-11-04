import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import './HeroPhotoBackdrop.css';

// Art direction keeps the landmarks in view as a wide hero becomes a portrait crop.
const PHOTOS = [
  { src: '/celina-community-downtown.png', desktop: '50% 55%', mobile: '32% 50%' },
  { src: '/celina-community-shops.png', desktop: '50% 54%', mobile: '52% 50%' },
  { src: '/celina-community-square.png', desktop: '50% 42%', mobile: '80% 50%' },
  { src: '/celina-community-pavilion.png', desktop: '50% 0%', mobile: '56% 50%' },
  { src: '/celina-community-bobcat-field.png', desktop: '50% 90%', mobile: '35% 50%' },
  { src: '/celina-community-stadium.png', desktop: '50% 60%', mobile: '50% 50%' },
  { src: '/celina-community-restaurants.png', desktop: '50% 40%', mobile: '50% 50%' },
];

export default function HeroPhotoBackdrop() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let ready = false;
    let elapsed = false;
    const nextIndex = (index + 1) % PHOTOS.length;
    const nextImage = new Image();
    const advance = () => {
      if (!cancelled && ready && elapsed) setIndex(nextIndex);
    };
    nextImage.onload = () => {
      // Decode the next frame before starting its fade so a slow download never flashes blank.
      void nextImage.decode().catch(() => undefined).then(() => { ready = true; advance(); });
    };
    nextImage.onerror = () => { /* Keep the currently visible photo on a network failure. */ };
    nextImage.src = PHOTOS[nextIndex].src;
    const timer = window.setTimeout(() => { elapsed = true; advance(); }, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [index, reducedMotion]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (reducedMotion) { layer.style.transform = 'none'; layer.style.setProperty('--hero-photo-offset', '0px'); return; }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;
        const limit = window.innerWidth < 640 ? 0 : 16;
        const offset = Math.max(-limit, Math.min(limit, -rect.top * 0.12));
        layer.style.setProperty('--hero-photo-offset', `${offset}px`);
        layer.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [reducedMotion]);

  const photo = PHOTOS[index];
  return (
    <div ref={viewportRef} className="celina-hero-photo-viewport" aria-hidden="true">
      <div ref={layerRef} className="celina-hero-photo-layer">
        <AnimatePresence initial={false}>
          <motion.img
            key={photo.src}
            src={photo.src}
            alt=""
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className={`celina-hero-photo${photo.src.includes('pavilion') ? ' celina-hero-photo--roof' : ''}`}
            style={{ '--photo-desktop': photo.desktop, '--photo-mobile': photo.mobile } as CSSProperties}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.78 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 1.1, ease: 'easeInOut' }}
            onError={(event) => {
              if (!event.currentTarget.dataset.fallback) {
                event.currentTarget.dataset.fallback = 'true';
                event.currentTarget.src = '/celina-water-tower-bg.jpg';
              }
            }}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
