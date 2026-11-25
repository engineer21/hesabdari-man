import React from 'react';
import type { AppSession, View } from '../types';
import { canAccessView } from '../utils/permissions';
import { Home, Landmark, TrendingUp, TrendingDown, MoreHorizontal, Plus, Users } from 'lucide-react';
import { cn } from './ui';

interface BottomNavProps {
  activeView: View;
  onViewChange: (view: View) => void;
  onFabClick: () => void;
  session?: AppSession | null;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      'relative flex h-full w-full flex-col items-center justify-center transition-colors',
      isActive ? 'text-white' : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
    )}
  >
    <span
      className={cn(
        'flex min-w-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-1.5 transition-all duration-200',
        isActive &&
          'bg-gradient-to-b from-[#1a78ff] to-[#0b56e5] text-white shadow-[0_8px_20px_-6px_rgba(13,99,245,0.65)]'
      )}
    >
      <span>{icon}</span>
      <span className="whitespace-nowrap text-[10px] font-bold leading-none">{label}</span>
    </span>
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onViewChange,
  onFabClick,
  session,
}) => {
  const can = (view: View) => !session || canAccessView(session, view);

  const leftView: View | null = can('banks') ? 'banks' : can('income') ? 'income' : null;
  const rightView: View | null = can('persons') ? 'persons' : can('expense') ? 'expense' : null;

  const moreViews: View[] = [
    'income',
    'expense',
    'transfers',
    'reports',
    'account-ledger-report',
    'trial-balance-report',
    'persons-report',
    'treasury-report',
    'chartOfAccounts',
    'access',
    'settings',
    'settingsBusiness',
    'settingsPassword',
    'settingsBackup',
    'profile',
  ].filter((v) => v !== leftView && v !== rightView) as View[];

  return (
    <footer className="safe-bottom fixed bottom-0 left-0 right-0 z-30 h-[4.5rem] print:hidden md:hidden">
      <div className="relative mx-auto h-full max-w-lg px-2">
        <div className="absolute inset-x-2 bottom-1.5 h-[3.85rem] rounded-[1.5rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-elevated)]/92 shadow-[0_10px_32px_-10px_rgba(10,40,100,0.22)] backdrop-blur-xl dark:shadow-[0_10px_32px_-8px_rgba(0,0,0,0.6)]" />
        <div className="relative grid h-full grid-cols-5 items-center px-1.5 pb-1.5">
          <NavItem
            label="خانه"
            icon={<Home size={19} strokeWidth={activeView === 'dashboard' ? 2.3 : 1.85} />}
            isActive={activeView === 'dashboard'}
            onClick={() => onViewChange('dashboard')}
          />
          {leftView ? (
            <NavItem
              label={leftView === 'banks' ? 'حساب‌ها' : 'درآمد'}
              icon={
                leftView === 'banks' ? (
                  <Landmark size={19} strokeWidth={activeView === 'banks' ? 2.3 : 1.85} />
                ) : (
                  <TrendingUp size={19} strokeWidth={activeView === 'income' ? 2.3 : 1.85} />
                )
              }
              isActive={activeView === leftView}
              onClick={() => onViewChange(leftView)}
            />
          ) : (
            <div />
          )}

          {/* Glowing Center FAB (matches all 7 mobile mockups) */}
          <div className="relative flex h-full items-center justify-center">
            <button
              type="button"
              onClick={onFabClick}
              aria-label="ثبت سریع"
              className="relative -mt-4 flex h-[3.2rem] w-[3.2rem] items-center justify-center rounded-full bg-gradient-to-br from-[#2789ff] via-[#0d63f5] to-[#00a6c7] text-white shadow-[0_10px_24px_-4px_rgba(13,99,245,0.6)] ring-4 ring-[color:var(--surface-solid)] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
            >
              <Plus size={25} strokeWidth={2.5} />
            </button>
          </div>

          {rightView ? (
            <NavItem
              label={rightView === 'persons' ? 'اشخاص' : 'هزینه'}
              icon={
                rightView === 'persons' ? (
                  <Users size={19} strokeWidth={activeView === 'persons' ? 2.3 : 1.85} />
                ) : (
                  <TrendingDown size={19} strokeWidth={activeView === 'expense' ? 2.3 : 1.85} />
                )
              }
              isActive={activeView === rightView}
              onClick={() => onViewChange(rightView)}
            />
          ) : (
            <div />
          )}

          <NavItem
            label="بیشتر"
            icon={<MoreHorizontal size={20} strokeWidth={moreViews.includes(activeView) ? 2.4 : 1.9} />}
            isActive={moreViews.includes(activeView)}
            onClick={() => onViewChange('settings')}
          />
        </div>
      </div>
    </footer>
  );
};

export default BottomNav;
