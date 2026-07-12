// Shared Permission (SSOT, Phase 4.3) — one role -> capability matrix for the whole
// system. Reuses the existing role field (users/{uid}.role via useAuth); no new
// collection, no new auth service. Every guard/component checks capabilities through
// the named helpers or the usePermissions() hook, so role logic lives in ONE place
// (no duplicate role checking, hooks, or constants). Route-level role matching stays
// in ProtectedRoute (unchanged) — this adds fine-grained action permissions on top.
import { useMemo } from "react";
import { useAuth } from "./AuthContext";

export const ROLES = { CUSTOMER: "customer", STORE: "store", RIDER: "rider", ADMIN: "admin" };

// action -> roles allowed. Single source of truth; every helper reads this matrix.
const PERMISSIONS = {
  read:           ["customer", "store", "rider", "admin"],
  write:          ["customer", "store", "rider", "admin"],
  updateStatus:   ["store", "rider", "admin"],
  assignRider:    ["rider", "admin"],
  approvePayment: ["store", "admin"],
  refund:         ["admin"],
  manageUsers:    ["admin"],
  manageStore:    ["store", "admin"],
  viewAnalytics:  ["store", "admin"],
};

// Generic gate. All named helpers below delegate here — no duplicated role checks.
export const can = (role, action) => (PERMISSIONS[action] || []).includes(role);

export const canRead           = (role) => can(role, "read");
export const canWrite          = (role) => can(role, "write");
export const canUpdateStatus   = (role) => can(role, "updateStatus");
export const canAssignRider    = (role) => can(role, "assignRider");
export const canApprovePayment = (role) => can(role, "approvePayment");
export const canRefund         = (role) => can(role, "refund");
export const canManageUsers    = (role) => can(role, "manageUsers");
export const canManageStore    = (role) => can(role, "manageStore");
export const canViewAnalytics  = (role) => can(role, "viewAnalytics");

// React hook: capabilities for the current authenticated role. Reuses useAuth (the
// existing Firebase Auth session + role), so there is no extra fetch or duplicate hook.
export function usePermissions() {
  const { role } = useAuth();
  return useMemo(() => ({
    role,
    can: (action) => can(role, action),
    canRead: canRead(role),
    canWrite: canWrite(role),
    canUpdateStatus: canUpdateStatus(role),
    canAssignRider: canAssignRider(role),
    canApprovePayment: canApprovePayment(role),
    canRefund: canRefund(role),
    canManageUsers: canManageUsers(role),
    canManageStore: canManageStore(role),
    canViewAnalytics: canViewAnalytics(role),
  }), [role]);
}
