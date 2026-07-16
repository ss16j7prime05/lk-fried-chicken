import { motion } from "framer-motion";

export const Button = ({
  children,
  variant = "primary",
  className = "",
  loading = false,
  disabled = false,
  ...props
}) => {
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark",
    secondary: "bg-secondary text-white hover:brightness-95",
    danger: "bg-red-500 text-white hover:bg-red-600",
    dark: "bg-gray-900 text-white hover:bg-gray-800",
    outline: "border-2 border-gray-100 hover:border-primary text-gray-700",
    ghost: "bg-transparent hover:bg-gray-100",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`px-6 py-3 min-h-[44px] rounded-2xl font-bold transition-colors duration-150 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.button>
  );
};
