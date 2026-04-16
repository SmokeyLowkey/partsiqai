"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type LogoVariant = "icon" | "horizontal";

interface ThemeLogoProps {
  variant?: LogoVariant;
  className?: string;
  alt?: string;
}

const LOGO_MAP: Record<LogoVariant, { light: string; dark: string }> = {
  icon: {
    light: "/light-theme-icon-logo-no-text.svg",
    dark: "/dark-theme-icon-logo-no-text.svg",
  },
  horizontal: {
    light: "/partsiq-logos-light-theme-horizontal.svg",
    dark: "/partsiq-logos-dark-theme-horizontal.svg",
  },
};

export function ThemeLogo({ variant = "icon", className = "h-8 w-8", alt = "PartsIQ" }: ThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Before mount, render both with CSS to avoid hydration mismatch + flash
  if (!mounted) {
    return (
      <>
        <img
          src={LOGO_MAP[variant].light}
          alt={alt}
          className={`${className} dark:hidden`}
        />
        <img
          src={LOGO_MAP[variant].dark}
          alt={alt}
          className={`${className} hidden dark:block`}
        />
      </>
    );
  }

  const src = resolvedTheme === "dark"
    ? LOGO_MAP[variant].dark
    : LOGO_MAP[variant].light;

  return <img src={src} alt={alt} className={className} />;
}
