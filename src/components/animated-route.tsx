import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export function AnimatedRoute({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -15 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
