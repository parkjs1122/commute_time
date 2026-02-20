"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import Spinner from "@/components/Spinner";

interface UserProfile {
  email: string;
  name: string | null;
  createdAt: string;
}

function DeleteAccountDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          계정 삭제
        </h3>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
          계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 되돌릴 수 없습니다.
          정말 삭제하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/account");
        if (!response.ok)
          throw new Error("사용자 정보를 불러오는 데 실패했습니다.");
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "오류가 발생했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (response.ok) {
        await signOut({ callbackUrl: "/login" });
      } else {
        const data = await response.json();
        setError(data?.error?.message || "계정 삭제에 실패했습니다.");
        setShowDeleteModal(false);
      }
    } catch {
      setError("계정 삭제 중 오류가 발생했습니다.");
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        마이페이지
      </h1>

      {/* 계정 정보 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
          계정 정보
        </h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">
              이메일
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
              {user?.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">
              가입일
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
              {user?.createdAt &&
                new Date(user.createdAt).toLocaleDateString("ko-KR")}
            </dd>
          </div>
        </dl>
      </div>

      {/* 계정 삭제 */}
      <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm dark:border-red-800 dark:bg-gray-800">
        <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          계정 삭제
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          계정을 삭제하면 저장된 모든 경로와 데이터가 영구적으로 삭제됩니다.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          계정 삭제
        </button>
      </div>

      <DeleteAccountDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        isLoading={isDeleting}
      />
    </div>
  );
}
