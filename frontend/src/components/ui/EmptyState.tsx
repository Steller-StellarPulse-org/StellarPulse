import React from "react";
import { FiInbox } from "react-icons/fi";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  title,
  description,
  icon: Icon = FiInbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-slate-600" />
      </div>
      <h3 className="font-heading font-semibold text-lg text-slate-300">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 mt-2 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary text-sm mt-5"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
