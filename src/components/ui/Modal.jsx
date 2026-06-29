import { motion, AnimatePresence } from "framer-motion";

export const Modal = ({
  open,
  onClose,
  children,
  className = "",
}) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: .95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .95, y: 20 }}
            transition={{ duration: .2 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-6"
          >
            <div
              onClick={(e)=>e.stopPropagation()}
              className={`bg-white rounded-3xl shadow-premium w-full max-w-xl ${className}`}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
