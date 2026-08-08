const variantClasses = {
  primary:
    "bg-brand-800 text-white hover:bg-brand-700 hover:shadow-[0_10px_30px_-10px_rgba(198,161,91,0.6)] focus-visible:ring-brand-800/30",
  secondary:
    "bg-white text-brand-800 border border-gray-200 hover:border-brand-800 hover:bg-brand-50 focus-visible:ring-brand-800/20",
  ghost:
    "bg-transparent text-brand-800 hover:bg-brand-50 focus-visible:ring-brand-800/20",
};

const sizeClasses = {
  sm: "text-sm px-3 py-2 rounded-lg gap-1.5",
  md: "text-sm px-4 py-3 rounded-xl gap-2",
  lg: "text-base px-6 py-3.5 rounded-xl gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
