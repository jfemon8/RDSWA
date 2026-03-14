import { motion } from 'motion/react';
import { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  blur?: boolean;
  scale?: boolean;
}

export default function FadeIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  distance = 20,
  className = '',
  once = true,
  blur = false,
  scale = false
}: FadeInProps) {
  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {}
  };

  const initial = {
    opacity: 0,
    ...directionMap[direction],
    ...(blur ? { filter: 'blur(8px)' } : {}),
    ...(scale ? { scale: 0.95 } : {})
  };

  const whileInView = {
    opacity: 1,
    x: 0,
    y: 0,
    ...(blur ? { filter: 'blur(0px)' } : {}),
    ...(scale ? { scale: 1 } : {})
  };

  return (
    <motion.div
      initial={initial}
      whileInView={whileInView}
      viewport={{ once, margin: '-20px' }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {children}
    </motion.div>
  );
}
