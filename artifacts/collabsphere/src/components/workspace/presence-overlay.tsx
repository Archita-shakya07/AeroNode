import { CursorState } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import { MousePointer2 } from "lucide-react";

export default function PresenceOverlay({ cursors, currentUserId }: { cursors: Record<number, CursorState>, currentUserId: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {Object.values(cursors).map(cursor => {
          if (cursor.userId === currentUserId) return null; // Don't render own cursor
          
          return (
            <motion.div
              key={cursor.userId}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: `calc(${cursor.x}vw)`,
                y: `calc(${cursor.y}vh)` 
              }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", damping: 50, stiffness: 400, mass: 0.5 }}
              className="absolute top-0 left-0 flex flex-col items-start drop-shadow-md"
              style={{
                // Convert percentage back to viewport units relative to the container
                // We use vw/vh in animate because it works well, but actually we need % of the parent container
                // Since this container is absolute inset-0, % works perfectly.
              }}
            >
              {/* Pointer Icon SVG tinted to user's color */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={cursor.avatarColor}
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-lg -ml-1 -mt-1"
                style={{ transform: "rotate(-20deg)" }}
              >
                <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
              </svg>

              {/* Name Tag */}
              <div 
                className="px-2 py-1 ml-4 mt-1 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: cursor.avatarColor }}
              >
                {cursor.name}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
