"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import useVerticalNav from "@menu/hooks/useVerticalNav";
import { useSession } from "@components/SessionProvider";
import { api } from "@/utils/api";
import { resolveAvatar } from "@/utils/getDefaultAvatar";
import { ROLES } from "@/server/constants";

const NavUser = () => {
  const router = useRouter();
  const session = useSession();
  const verticalNavOptions = useVerticalNav();
  const { isCollapsed, isHovered } = verticalNavOptions;
  const isCollapsedNotHovered = isCollapsed && !isHovered;

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

  const userName = session?.name || "";
  const userEmail = ROLES[session?.role] || "";

  return (
    <>
      <Box
        sx={{
          mt: "auto",
          pt: 1,
          px: 1.5,
          pb: 3,
          flexShrink: 0,
        }}
      >
        <Box
          onClick={handleClick}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1,
            borderRadius: 1,
            cursor: "pointer",
            transition: "background-color 0.15s ease",
            "&:hover": {
              bgcolor: "action.hover",
            },
            ...(isCollapsedNotHovered && {
              justifyContent: "center",
              p: 0.5,
            }),
          }}
        >
          <Tooltip
            title={isCollapsedNotHovered ? userName : ""}
            placement="right"
          >
            <Avatar
              src={resolveAvatar(session)}
              alt={userName}
              sx={{ width: 36, height: 36, flexShrink: 0 }}
            />
          </Tooltip>

          {!isCollapsedNotHovered && (
            <>
              <Box
                sx={{
                  minWidth: 0,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: "text.primary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {userName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {userEmail}
                </Typography>
              </Box>

              <Box
                component="i"
                className="tabler-dots-vertical"
                sx={{
                  color: "text.secondary",
                  fontSize: "1.25rem",
                  flexShrink: 0,
                  opacity: 0.7,
                  "&:hover": { opacity: 1 },
                }}
              />
            </>
          )}
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: isCollapsedNotHovered ? "bottom" : "top",
          horizontal: isCollapsedNotHovered ? "right" : "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: isCollapsedNotHovered ? "left" : "left",
        }}
        slotProps={{
          paper: {
            sx: {
              width: isCollapsedNotHovered
                ? 200
                : anchorEl
                  ? `${anchorEl.clientWidth}px`
                  : 236,
              minWidth: isCollapsedNotHovered
                ? 200
                : anchorEl
                  ? `${anchorEl.clientWidth}px`
                  : 236,
              mb: 1,
              borderRadius: 2,
              boxShadow:
                "var(--mui-customShadows-md, 0 4px 18px rgba(0,0,0,0.12))",
            },
          },
        }}
      >
        <MenuItem
          onClick={handleLogout}
          sx={{ gap: 1.5, py: 1.25, px: 2, color: "error.main" }}
        >
          <i className="tabler-logout text-lg" />
          <Typography
            variant="body2"
            color="error.main"
            sx={{ fontWeight: 500 }}
          >
            Đăng xuất
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default NavUser;
