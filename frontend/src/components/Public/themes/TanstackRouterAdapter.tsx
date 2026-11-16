import React from "react";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";

export const Link = ({ to = "/", search, children, className, style, activeOptions, ...rest }: any) => {
  const { eventId: paramEventId } = useParams();
  const location = useLocation();

  // Extract eventId from URL if not in params
  let eventId = paramEventId;
  if (!eventId) {
    const m = location.pathname.match(/\/events\/(\d+)/);
    if (m) eventId = m[1];
    else eventId = "2";
  }

  // Map to target path
  let targetPath = `/events/${eventId}/public`;
  if (to === "/" || to === "") {
    targetPath = `/events/${eventId}/public`;
  } else if (to === "/results") {
    targetPath = `/events/${eventId}/public/results`;
  } else if (to === "/points-table" || to === "/points" || to === "/standings") {
    targetPath = `/events/${eventId}/public/points`;
  } else if (to === "/schedule") {
    targetPath = `/events/${eventId}/public/schedule`;
  } else if (to === "/verify-badge" || to === "/verify") {
    targetPath = `/events/${eventId}/public/verify`;
  } else if (to === "/admin" || to === "/settings") {
    targetPath = `/events/${eventId}/settings`;
  } else if (typeof to === "string" && to.startsWith("/")) {
    targetPath = `/events/${eventId}/public${to}`;
  } else {
    targetPath = to;
  }

  // Handle search query
  const queryParams = new URLSearchParams(location.search);
  if (search && typeof search === "object") {
    Object.entries(search).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        queryParams.set(k, String(v));
      }
    });
  }
  const queryString = queryParams.toString();
  const finalTo = queryString ? `${targetPath}?${queryString}` : targetPath;

  // Active state
  const isActive = location.pathname === targetPath;
  const computedClassName = typeof className === "function" ? className({ isActive }) : className;

  return (
    <RouterLink
      to={finalTo}
      className={computedClassName}
      style={style}
      data-status={isActive ? "active" : undefined}
      {...rest}
    >
      {children}
    </RouterLink>
  );
};

export default Link;

