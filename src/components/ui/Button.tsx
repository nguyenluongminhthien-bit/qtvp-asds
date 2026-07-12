import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:bg-blue-800',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20 active:bg-red-800',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 active:bg-emerald-800',
  outline: 'border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800',
  ghost: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5',
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed';
  
  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon && <span className="inline-flex items-center">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
    </button>
  );
};

export default Button;
