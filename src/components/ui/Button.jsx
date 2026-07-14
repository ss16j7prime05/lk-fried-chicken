import { motion } from "framer-motion";

export const Button = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark",
    secondary: "bg-secondary text-white",
    outline: "border-2 border-gray-100 hover:border-primary text-gray-700",
    ghost: "bg-transparent hover:bg-gray-100",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`px-6 py-3 min-h-[44px] rounded-2xl font-bold transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};
