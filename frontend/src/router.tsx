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
  { path: "/t/:id", element: <TrailerPublic /> },
  { path: "/t/:id/reserve", element: <Reserve /> },

  { path: "/admin/trailers", element: <AdminTrailers /> },
  { path: "/admin/trailers/:id", element: <AdminTrailerEdit /> },

  // ONBOARDING FLOW
  { path: "/admin/onboarding/start", element: <OnboardingStart /> },
  { path: "/admin/onboarding/rental", element: <OnboardingRental /> },
  { path: "/admin/onboarding/trailer", element: <OnboardingTrailer /> },
  { path: "/admin/onboarding/lock/:trailerId", element: <OnboardingLock /> },
  { path: "/admin/onboarding/test/:trailerId", element: <OnboardingTest /> },
]);
