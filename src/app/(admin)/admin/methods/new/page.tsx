import { CreateMethodForm } from "./create-method-form";

export default function NewMethodPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create Payment Method</h1>
      <CreateMethodForm />
    </div>
  );
}
