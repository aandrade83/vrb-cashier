import { CreateUserForm } from "./create-user-form";

export default function NewUserPage() {
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Create User</h1>
      <CreateUserForm />
    </div>
  );
}
