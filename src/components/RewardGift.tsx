"use client";

import { motion } from "framer-motion";

export default function RewardGift() {
  return (
    <div className="relative h-12 w-12">
      {/* BOX */}
      <motion.div
        className="absolute bottom-0 h-10 w-12 rounded-md bg-[#00AEEF]"
        animate={{ y: [0, -4, 0] }}
        transition={{
          duration: 1,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* LID */}
      <motion.div
        className="absolute top-0 h-4 w-12 rounded-md bg-[#0095cc]"
        animate={{
          y: [-2, -10, -2],
          rotate: [-5, 5, -5],
        }}
        transition={{
          duration: 0.8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* RIBBON */}
      <div className="absolute left-1/2 top-0 h-12 w-1 -translate-x-1/2 rounded bg-white/70" />
    </div>
  );
}

