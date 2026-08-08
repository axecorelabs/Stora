"use client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Users } from "lucide-react";

export default function StaffPage() {
  return (
    <DashboardLayout title="Staff Management" subtitle="Manage your team">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="p-4 bg-gray-100 rounded-2xl w-fit mx-auto mb-4">
            <Users className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Staff Management</h3>
          <p className="text-gray-600">This feature is coming soon!</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
