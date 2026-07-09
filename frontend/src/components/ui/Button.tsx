import React from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export default function Button({ variant = "primary", fullWidth = false, className, children, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-2xl font-semibold transition-transform duration-150";
  const variants: Record<Variant, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "bg-transparent text-slate-200 hover:text-white",
  };

  const classes = `${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className ?? ""}`.trim();

  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  );
}
