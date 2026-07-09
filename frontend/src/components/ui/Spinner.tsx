import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  const borderClasses = { sm: "border-2", md: "border-2", lg: "border-[3px]" };

  return (
    <div
      className={`${sizeClasses[size]} ${borderClasses[size]} border-primary-500/30 border-t-primary-500 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
