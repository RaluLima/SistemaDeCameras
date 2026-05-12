"use client";
import { useRouter } from "next/navigation";

export function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (href ? router.push(href) : router.back())}
      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Voltar
    </button>
  );
}
