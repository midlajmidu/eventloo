import { useEffect, useState } from "react";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");
    setIsAdmin(Boolean(token && (role === "admin" || role === "super_admin" || !role)));
  }, []);
  return isAdmin;
}

