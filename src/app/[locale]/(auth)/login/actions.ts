'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const locale = String(formData.get('locale') ?? 'es');
  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: `/${locale}`,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: 'invalidCredentials' };
    throw error;
  }
}
