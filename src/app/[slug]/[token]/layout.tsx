// Root layout for all cashier-scoped routes: /{slug}/{token}/...
// The middleware has already validated slug + token and injected x-cashier-id.
// This layout simply renders children — role layouts are nested below.

export default function CashierRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
