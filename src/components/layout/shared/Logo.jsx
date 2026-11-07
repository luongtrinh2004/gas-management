"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Hook Imports
import useVerticalNav from "@menu/hooks/useVerticalNav";
import { useSettings } from "@core/hooks/useSettings";

const Logo = () => {
  const router = useRouter();
  const { isHovered, isBreakpointReached } = useVerticalNav();
  const { settings } = useSettings();
  const { layout, mode } = settings;

  const isCollapsed =
    layout === "collapsed" && !isHovered && !isBreakpointReached;

  // SSR-safe: không đọc window trong render
  const [isDark, setIsDark] = useState(() => {
    // Ưu tiên dark/light cố định. Với 'system' thì mặc định dùng light khi SSR,
    // rồi sẽ cập nhật sau khi mount để tránh hydration mismatch.
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return false;
  });

  useEffect(() => {
    if (mode === "dark") {
      setIsDark(true);
      return;
    }
    if (mode === "light") {
      setIsDark(false);
      return;
    }
    // mode === 'system'
    const m =
      typeof window !== "undefined"
        ? window.matchMedia?.("(prefers-color-scheme: dark)")
        : null;
    const apply = () => setIsDark(!!m?.matches);
    apply();
    // lắng nghe thay đổi theme hệ thống
    m?.addEventListener?.("change", apply);
    return () => m?.removeEventListener?.("change", apply);
  }, [mode]);

  const logoSrc = isCollapsed
    ? isDark
      ? "/images/logos/logo-icon-light.png"
      : "/images/logos/logo-icon-light.png"
    : isDark
      ? "/images/logos/logo-light.png"
      : "/images/logos/logo-light.png";
  // Giữ đúng tỉ lệ ảnh gốc: logo ngang 2172×373, icon 401×373
  const logoWidth = isCollapsed ? 40 : 190;
  const logoHeight = Math.round(logoWidth * (isCollapsed ? 373 / 401 : 373 / 2172));

  const handleClick = () => {
    router.push("/");
  };

  return (
    <div
      className="flex items-center justify-center cursor-pointer shrink-0"
      style={{ width: logoWidth, height: 42 }}
      onClick={handleClick}
    >
      <Image
        src={logoSrc}
        alt="Gas Management"
        width={logoWidth}
        height={logoHeight}
        style={{ width: logoWidth, height: "auto" }}
        priority
      />
    </div>
  );
};

export default Logo;
