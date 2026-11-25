import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Code2,
  ExternalLink,
  FileText,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
} from 'lucide-react';
import { FormSheet, cn } from './ui';

interface AboutModalProps {
  onClose: () => void;
}

const ABOLFAZL_PHOTO = '/about-profile.png';
const FARZAD_PHOTO = '/about-farzad.png';
const RESUME_URL = 'https://resume.esmaily-soft.ir/';

const LinkedInGlyph = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className ?? 'h-4 w-4'}
    aria-hidden
  >
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

type ContactItem = {
  id: string;
  label: string;
  value: string;
  href: string;
  icon?: LucideIcon;
  customIcon?: React.ReactNode;
  tone: string;
};

type PersonCard = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
  photoClass?: string;
  RoleIcon: LucideIcon;
  accent: string;
  ring: string;
  soft: string;
  contacts: ContactItem[];
};

const people: PersonCard[] = [
  {
    id: 'farzad',
    name: 'فرزاد فرش‌فروش',
    role: 'سفارش‌دهنده',
    bio: 'ایده‌پرداز و سفارش‌دهنده نرم‌افزار حسابداری من؛ همراه در مسیر ساخت محصول.',
    photo: FARZAD_PHOTO,
    photoClass: 'object-cover object-[center_18%]',
    RoleIcon: Briefcase,
    accent: 'text-amber-700 dark:text-amber-300',
    ring: 'from-amber-400 via-orange-300 to-rose-300',
    soft: 'bg-amber-500/10 border-amber-200/60 dark:border-amber-400/20',
    contacts: [
      {
        id: 'phone',
        label: 'تماس',
        value: '0912 644 5848',
        href: 'tel:+989126445848',
        icon: Phone,
        tone: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
      },
      {
        id: 'whatsapp',
        label: 'واتساپ',
        value: '0912 644 5848',
        href: 'https://wa.me/989126445848',
        icon: MessageCircle,
        tone: 'bg-green-500/12 text-green-700 dark:text-green-300',
      },
      {
        id: 'telegram',
        label: 'تلگرام',
        value: '0912 644 5848',
        href: 'https://t.me/+989126445848',
        icon: Send,
        tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
      },
    ],
  },
  {
    id: 'abolfazl',
    name: 'ابوالفضل اسماعیلی',
    role: 'تولیدکننده و برنامه‌نویس',
    bio: 'طراح و توسعه‌دهنده نرم‌افزار با بیش از ۱۵ سال تجربه در موبایل، وب و سیستم‌های حسابداری.',
    photo: ABOLFAZL_PHOTO,
    photoClass: 'object-cover object-top',
    RoleIcon: Code2,
    accent: 'text-violet-700 dark:text-violet-300',
    ring: 'from-violet-400 via-fuchsia-400 to-cyan-300',
    soft: 'bg-violet-500/10 border-violet-200/60 dark:border-violet-400/20',
    contacts: [
      {
        id: 'phone',
        label: 'تماس',
        value: '0915 921 5771',
        href: 'tel:+989159215771',
        icon: Phone,
        tone: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
      },
      {
        id: 'whatsapp',
        label: 'واتساپ',
        value: 'پیام در واتساپ',
        href: 'https://wa.me/989159215771',
        icon: MessageCircle,
        tone: 'bg-green-500/12 text-green-700 dark:text-green-300',
      },
      {
        id: 'telegram',
        label: 'تلگرام',
        value: 'Engineer3663',
        href: 'https://t.me/Engineer3663',
        icon: Send,
        tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
      },
      {
        id: 'linkedin',
        label: 'لینکدین',
        value: 'Abolfazl Esmaeili',
        href: 'https://www.linkedin.com/in/abolfazl-esmaeili-76ba8186/',
        customIcon: <LinkedInGlyph />,
        tone: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',
      },
      {
        id: 'resume',
        label: 'رزومه',
        value: 'مشاهده رزومه',
        href: RESUME_URL,
        icon: FileText,
        tone: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
      },
    ],
  },
];

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <FormSheet
      isOpen={true}
      onClose={onClose}
      title="درباره ما"
      size="lg"
      bodyClassName="!p-0 lg:!p-0"
    >
      <div className="about-modal overflow-hidden">
        <section className="relative overflow-hidden px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
          <div aria-hidden className="about-hero-bg pointer-events-none absolute inset-0" />
          <div
            aria-hidden
            className="about-orb pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full bg-[color:var(--brand)]/20 blur-3xl"
          />
          <div
            aria-hidden
            className="about-orb about-orb-delayed pointer-events-none absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl"
          />

          <div className="about-reveal relative mx-auto max-w-xl text-center">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-1)]/80 px-3 py-1 text-[11px] font-bold text-[color:var(--brand)] shadow-sm backdrop-blur">
              <Sparkles size={12} />
              تیم محصول
            </span>
            <h3 className="text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-[1.75rem]">
              حسابداری من
            </h3>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
              ساخته‌شده با همکاری{' '}
              <span className="font-bold text-[color:var(--ink)]">فرزاد فرش‌فروش</span>
              {' '}و{' '}
              <span className="font-bold text-[color:var(--ink)]">ابوالفضل اسماعیلی</span>
            </p>
          </div>

          <div className="about-reveal about-reveal-delay-1 relative mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            {people.map((person) => {
              const RoleIcon = person.RoleIcon;
              return (
                <article
                  key={person.id}
                  className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--surface-1)]/90 p-5 shadow-[var(--shadow-sm)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:p-6"
                >
                  <div className="relative flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      <div
                        aria-hidden
                        className={cn(
                          'about-photo-glow absolute inset-0 scale-[1.12] rounded-full bg-gradient-to-br opacity-50 blur-lg',
                          person.ring
                        )}
                      />
                      <div
                        className={cn(
                          'relative rounded-full bg-gradient-to-br p-[3px] shadow-[0_14px_32px_rgba(15,23,42,0.14)]',
                          person.ring
                        )}
                      >
                        <div className="overflow-hidden rounded-full bg-[color:var(--surface-1)] ring-2 ring-white/70 dark:ring-white/10">
                          <img
                            src={person.photo}
                            alt={person.name}
                            width={128}
                            height={128}
                            className={cn(
                              'block h-[7.25rem] w-[7.25rem] sm:h-32 sm:w-32',
                              person.photoClass
                            )}
                            decoding="async"
                          />
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold',
                        person.soft,
                        person.accent
                      )}
                    >
                      <RoleIcon size={12} />
                      {person.role}
                    </span>

                    <h4 className="mt-3 text-xl font-black text-[color:var(--ink)]">
                      {person.name}
                    </h4>
                    <p className="mt-2 max-w-[18rem] text-[13px] leading-6 text-[color:var(--muted)]">
                      {person.bio}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-1 flex-col justify-end">
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[color:var(--line)] to-transparent" />
                      <span className="text-[10px] font-bold text-[color:var(--muted)]">ارتباط</span>
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[color:var(--line)] to-transparent" />
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                      {person.contacts.map((item, index) => (
                        <a
                          key={item.id}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${item.label}: ${item.value}`}
                          style={{ animationDelay: `${140 + index * 40}ms` }}
                          className={cn(
                            'about-contact group inline-flex items-center gap-2 rounded-2xl border border-[color:var(--line)]',
                            'bg-[color:var(--surface-2)]/70 px-3 py-2 text-[12px] font-bold text-[color:var(--ink)]',
                            'transition duration-250 hover:border-[color:var(--brand)]/30 hover:bg-[color:var(--surface-1)]',
                            'hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-xl transition group-hover:scale-105',
                              item.tone
                            )}
                          >
                            {item.customIcon ??
                              (item.icon ? <item.icon size={14} strokeWidth={2} /> : null)}
                          </span>
                          <span
                            className="max-w-[9.5rem] truncate"
                            dir={
                              item.id === 'phone' ||
                              item.id === 'whatsapp' ||
                              item.id === 'telegram' ||
                              item.id === 'linkedin'
                                ? 'ltr'
                                : undefined
                            }
                          >
                            {item.id === 'resume' ? item.label : item.value}
                          </span>
                          <ExternalLink className="h-3 w-3 opacity-35 transition group-hover:opacity-70" />
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <style>{`
        .about-hero-bg {
          background:
            radial-gradient(ellipse 75% 55% at 50% 0%, color-mix(in srgb, var(--brand) 16%, transparent), transparent 62%),
            radial-gradient(ellipse 45% 40% at 95% 85%, rgba(245, 158, 11, 0.10), transparent 55%),
            linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 80%, transparent) 0%, transparent 100%);
        }
        .about-orb {
          animation: about-orb-float 8s ease-in-out infinite;
        }
        .about-orb-delayed {
          animation-delay: -4s;
        }
        @keyframes about-orb-float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
          50% { transform: translate(10px, -12px) scale(1.06); opacity: 1; }
        }
        .about-photo-glow {
          animation: about-glow 3.4s ease-in-out infinite;
        }
        @keyframes about-glow {
          0%, 100% { opacity: 0.35; transform: scale(1.08); }
          50% { opacity: 0.65; transform: scale(1.16); }
        }
        .about-reveal {
          animation: about-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .about-reveal-delay-1 { animation-delay: 70ms; }
        @keyframes about-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .about-contact {
          animation: about-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .about-orb,
          .about-photo-glow,
          .about-reveal,
          .about-contact {
            animation: none !important;
          }
        }
      `}</style>
    </FormSheet>
  );
};

export default AboutModal;
