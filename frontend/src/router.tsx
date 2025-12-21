import { createBrowserRouter } from "react-router-dom";

import Home from "./views/Home";
import TrailerPublic from "./views/TrailerPublic";
import Reserve from "./views/Reserve";

// ADMIN
import AdminTrailerEdit from "./views/admin/AdminTrailerEdit";

export const router = createBrowserRouter([
  // ===== VEŘEJNÉ =====
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/t/:id",
    element: <TrailerPublic />,
  },
  {
    path: "/t/:id/reserve",
    element: <Reserve />,
  },

  // ===== ADMIN =====
  {
    path: "/admin/trailers/:id",
    element: <AdminTrailerEdit />,
  },
]);
