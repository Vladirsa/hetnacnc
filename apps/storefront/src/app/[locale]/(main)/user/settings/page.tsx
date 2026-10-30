import { LoginForm, ProfileDetails } from "@/components/molecules"
import { UserNavigation } from "@/components/molecules"
import { ProfilePassword } from "@/components/molecules/ProfileDetails/ProfilePassword"
import { retrieveCustomer } from "@/lib/data/customer"

export default async function ReviewsPage() {
  const user = await retrieveCustomer()

  if (!user) return <LoginForm />

  return (
    <main className="container" data-testid="profile-settings-page">
      <div className="grid grid-cols-1 md:grid-cols-4 mt-6 gap-5 md:gap-8">
        <UserNavigation />
        <div className="md:col-span-3" data-testid="profile-settings-container">
          <h1 className="mb-6 text-[26px] font-extrabold text-[#142033]">Datos y contraseña</h1>
          <ProfileDetails user={user} />
          <ProfilePassword user={user} />
        </div>
      </div>
    </main>
  )
}
