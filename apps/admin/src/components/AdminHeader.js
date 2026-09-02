"use client";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";

function initialsFor(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

// Same fixed-header shape as apps/dashboard's own DashboardHeader.js --
// title/subtitle per page, a user menu with sign-out. No notification
// bell (no notification system in this app) and no "Account Settings"
// link (no profile page yet).
export default function AdminHeader({ title, subtitle, isSidebarCollapsed = false, onOpenMobileMenu }) {
  const { user, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await signOut();
  };

  return (
    <header className={`fixed top-0 left-0 right-0 bg-white px-4 lg:px-6 py-5 border-b border-gray-200 z-20 transition-[left] duration-300 ${isSidebarCollapsed ? "lg:left-20" : "lg:left-64"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="hidden sm:block text-sm text-gray-500 mt-1 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 bg-gray-50 rounded-xl px-3 py-2 hover:bg-gray-100 transition-all duration-200"
          >
            <div className="w-8 h-8 bg-brand-800 rounded-lg flex items-center justify-center">
              <span className="text-sm font-medium text-white">{initialsFor(user?.name)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="hidden sm:inline text-sm font-medium text-gray-900">{user?.name}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-800 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-medium text-white">{initialsFor(user?.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
