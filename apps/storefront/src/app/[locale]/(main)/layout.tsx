import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';

import { Footer, Header } from '@/components/organisms';
import { HetnaHeader } from '@/components/hetna/HetnaHeader';
import { retrieveCustomer } from '@/lib/data/customer';
import { checkRegion } from '@/lib/helpers/check-region';

// El chat (TalkJS) solo se usa si hay sesión; se carga aparte para no
// sumar su JS al bundle inicial de los visitantes anónimos.
const TalkJsProvider = dynamic(() =>
  import('@/components/providers/TalkJs/TalkJsProvider').then(
    (mod) => mod.TalkJsProvider
  )
);

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const APP_ID = process.env.NEXT_PUBLIC_TALKJS_APP_ID;
  const { locale } = await params;

  const user = await retrieveCustomer();
  const regionCheck = await checkRegion(locale);

  if (!regionCheck) {
    return redirect('/');
  }

  if (!APP_ID || !user || !user.id || !user.email)
    return (
      <>
        <HetnaHeader locale={locale} />
        {children}
        <Footer />
      </>
    );

  const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';

  return (
    <TalkJsProvider
      appId={APP_ID}
      userId={user.id}
      userName={userName}
      userEmail={user.email}
    >
      <HetnaHeader locale={locale} />
      {children}
      <Footer />
    </TalkJsProvider>
  );
}
