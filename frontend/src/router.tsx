import { createBrowserRouter } from "react-router-dom";

import Home from "./views/Home";
import TrailerPublic from "./views/TrailerPublic";
import Reserve from "./views/Reserve";

import AdminTrailers from "./views/admin/AdminTrailers";
import AdminTrailerEdit from "./views/admin/AdminTrailerEdit";

// ONBOARDING
import OnboardingStart from "./views/admin/onboarding/OnboardingStart";
import OnboardingRental from "./views/admin/onboarding/OnboardingRental";
import OnboardingTrailer from "./views/admin/onboarding/OnboardingTrailer";
import OnboardingLock from "./views/admin/onboarding/OnboardingLock";
import OnboardingTest from "./views/admin/onboarding/OnboardingTest";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },

  // veřejná část
  { path: "/t/:id", element: <TrailerPublic /> },
  { path: "/t/:id/reserve", element: <Reserve /> },

  // admin
  { path: "/admin/trailers", element: <AdminTrailers /> },
  { path: "/admin/trailers/:id", element: <AdminTrailerEdit /> },

  // onboarding
  { path: "/admin/onboarding", element: <OnboardingStart /> },
  { path: "/admin/onboarding/rental", element: <OnboardingRental /> },
  { path: "/admin/onboarding/trailer", element: <OnboardingTrailer /> },
  { path: "/admin/onboarding/lock", element: <OnboardingLock /> },
  { path: "/admin/onboarding/test", element: <OnboardingTest /> },
]);
