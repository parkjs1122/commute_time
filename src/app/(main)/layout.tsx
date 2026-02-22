"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import SessionProvider from "@/components/SessionProvider";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useState, useEffect, useRef } from "react";

function NavBar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  const navItems = [
    { href: "/", label: "대시보드" },
    { href: "/routes", label: "경로 관리" },
    { href: "/statistics", label: "통계" },
    { href: "/profile", label: "마이페이지" },
  ];

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  }

  // Calculate menu height for animation
  useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(mobileMenuOpen ? menuRef.current.scrollHeight : 0);
    }
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="text-lg font-bold text-gray-900 dark:text-gray-100"
          >
            출퇴근 시간
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="ml-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              로그아웃
            </button>
          </div>

          {/* Mobile: theme toggle + menu button */}
          <div className="flex items-center gap-1 sm:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation with slide animation */}
        <div
          ref={menuRef}
          className="overflow-hidden transition-all duration-200 ease-in-out sm:hidden"
          style={{ maxHeight: menuHeight }}
        >
          <div className="border-t border-gray-200 pb-3 pt-2 dark:border-gray-700">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
