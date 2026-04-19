export default function CashierInactivePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Cashier Unavailable</h1>
        <p className="text-muted-foreground">
          Este cajero se encuentra desactivado. Por favor contacte a Administración
          para más información.
        </p>
      </div>
    </div>
  );
}
