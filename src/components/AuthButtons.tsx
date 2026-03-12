"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import SignInModal from "./SignInModal";

export default function AuthButtons() {
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoaded && isSignedIn) return <UserButton />;

  return <SignInModal />;
}
