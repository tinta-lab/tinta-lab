'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Self-registration is disabled — accounts are created by administrator
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/auth/login'); }, [router]);
  return null;
}
