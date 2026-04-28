"use client";

import React, { useState, useCallback } from 'react';
import { getAvatarColor, getUserInitials } from '@/lib/avatar-utils';
import Image from 'next/image';

interface ProfileAvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export const ProfileAvatar = React.memo(function ProfileAvatar({
  name,
  src,
  size = 'md',
  className = '',
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = React.useMemo(() => getUserInitials(name), [name]);
  const bgColor = React.useMemo(() => getAvatarColor(name), [name]);
  const handleImageError = useCallback(() => setImageError(true), []);

  if (!src || imageError) {
    return (
      <div className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-medium shrink-0 ${className}`}>
        {initials}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden shrink-0 ${className}`}>
      <Image
        src={src}
        alt={`${name}'s profile`}
        className="w-full h-full object-cover"
        onError={handleImageError}
        width={100}
        height={100}
        loading="lazy"
      />
    </div>
  );
});
