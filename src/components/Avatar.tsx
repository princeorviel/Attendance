import React from 'react';
import { Plus } from 'lucide-react';
import { Account } from '../types';
import { getAccountColorHue, getLiveStories } from '../utils/hazri';

interface AvatarProps {
  account: Account;
  index: number;
  size?: 'sm' | 'md' | 'lg';
  showAddBadge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  account,
  index,
  size = 'md',
  showAddBadge = false,
  onClick,
  className = '',
}) => {
  const hasLiveStory = getLiveStories(account).length > 0;
  const hue = getAccountColorHue(index);
  const initial = (account.name || '?').trim().charAt(0).toUpperCase();

  const sizeClasses =
    size === 'sm'
      ? 'h-8 w-8 text-sm'
      : size === 'lg'
        ? 'h-14 w-14 text-2xl'
        : 'h-9 w-9 text-base';

  const ringClasses = hasLiveStory
    ? 'ring-2 ring-pink-600 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
    : '';

  const content = account.photo ? (
    <img
      src={account.photo}
      alt={account.name}
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
    />
  ) : (
    <span>{account.emo || initial}</span>
  );

  const sharedClass = `relative inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none ${sizeClasses} ${ringClasses} ${className}`;
  const bgStyle = account.photo
    ? undefined
    : { backgroundColor: `hsl(${hue}, 56%, 46%)` };

  const inner = (
    <>
      <span
        style={bgStyle}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
      >
        {content}
      </span>
      {showAddBadge && !hasLiveStory && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-white bg-indigo-600 text-white dark:border-slate-800"
        >
          <Plus className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${sharedClass} cursor-pointer transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-indigo-600`}
        title={
          hasLiveStory
            ? `${account.name} का Status / Reel देखें`
            : 'Status / Reel लगाएं'
        }
      >
        {inner}
      </button>
    );
  }

  return <span className={sharedClass}>{inner}</span>;
};
