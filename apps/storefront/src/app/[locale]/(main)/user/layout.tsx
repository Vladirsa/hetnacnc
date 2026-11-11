export default function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="-mt-6 bg-[radial-gradient(900px_500px_at_100%_-10%,rgba(217,96,11,0.07),transparent_60%),radial-gradient(700px_500px_at_-10%_110%,rgba(20,32,51,0.06),transparent_60%)] bg-[#F6F4EF] pb-4">
      {children}
    </div>
  )
}
