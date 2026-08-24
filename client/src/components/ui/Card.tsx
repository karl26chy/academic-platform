import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/** Panel blanco con borde suave: contenedor base de toda la interfaz. */
export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-white shadow-sm border border-gray-200 p-4 sm:p-6 rounded-2xl ${className}`}>
    {children}
  </div>
);

interface CardTitleProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, icon, className = 'mb-4' }) => (
  <h3 className={`text-lg font-bold text-gray-900 flex items-center gap-2 ${className}`}>
    {icon}
    {children}
  </h3>
);

export const EmptyMessage: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = 'text-sm text-gray-500 py-4 text-center',
}) => <p className={className}>{children}</p>;
