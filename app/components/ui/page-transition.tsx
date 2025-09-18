"use client"

import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{
          duration: 0.15,
          ease: "easeInOut"
        }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
