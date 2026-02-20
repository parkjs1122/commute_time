"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import Spinner from "@/components/Spinner";
import Dialog from "@/components/Dialog";
import ErrorBanner from "@/components/ErrorBanner";
import PasswordInput from "@/components/PasswordInput";
import { useToast } from "@/components/ToastProvider";

interface UserProfile {
  email: string;
  name: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== newPasswordConfirm) {
      setPasswordError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        toast("success", "비밀번호가 변경되었습니다.");
        setCurrentPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
      } else {
        const data = await response.json();
        setPasswordError(
          data?.error?.message || "비밀번호 변경에 실패했습니다."
        );
      }
    } catch {
      setPasswordError("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (response.ok) {
        await signOut({ callbackUrl: "/login" });
      } else {
        const data = await response.json();
        toast("error", data?.error?.message || "계정 삭제에 실패했습니다.");
        setShowDeleteModal(false);
      }
    } catch {
      toast("error", "계정 삭제 중 오류가 발생했습니다.");
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
        <ErrorBanner message={error} />
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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

      {/* 비밀번호 변경 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
          비밀번호 변경
        </h2>

        {passwordError && (
          <div className="mb-4">
            <ErrorBanner message={passwordError} onClose={() => setPasswordError(null)} />
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              현재 비밀번호
            </label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              새 비밀번호
            </label>
            <PasswordInput
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="8자 이상 입력해주세요"
            />
          </div>
          <div>
            <label
              htmlFor="newPasswordConfirm"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              새 비밀번호 확인
            </label>
            <PasswordInput
              id="newPasswordConfirm"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
              placeholder="새 비밀번호를 다시 입력해주세요"
            />
          </div>
          <button
            type="submit"
            disabled={isChangingPassword}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
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

      {/* 계정 삭제 다이얼로그 */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        closeOnBackdrop={!isDeleting}
        labelId="delete-account-title"
      >
        <h3
          id="delete-account-title"
          className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          계정 삭제
        </h3>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
          계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 되돌릴 수 없습니다.
          정말 삭제하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteModal(false)}
            disabled={isDeleting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
