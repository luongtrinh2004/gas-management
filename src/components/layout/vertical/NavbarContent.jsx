"use client";

// Third-party Imports
import classnames from "classnames";

// Component Imports
import NavToggle from "./NavToggle";
import ModeDropdown from "@components/layout/shared/ModeDropdown";
import UserDropdown from "@components/layout/shared/UserDropdown";
import NotificationBell from "@components/layout/shared/NotificationBell";

// Util Imports
import { verticalLayoutClasses } from "@layouts/utils/layoutClasses";

const NavbarContent = () => {
  return (
    <div
      className={classnames(
        verticalLayoutClasses.navbarContent,
        "flex items-center justify-between gap-3 is-full",
      )}
    >
      <div className="flex items-center gap-3 shrink-0">
        <NavToggle />
        <ModeDropdown />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <UserDropdown />
      </div>
    </div>
  );
};

export default NavbarContent;
