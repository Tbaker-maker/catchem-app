import "./tokens.css";
import React from "react";
import ReactDOM from "react-dom/client";
import Ticker from "./Ticker.jsx";
import Search from "./Search.jsx";

// Off until VITE_SEARCH_ENABLED=true. No nav link either way.
const searchOn = import.meta.env.VITE_SEARCH_ENABLED === "true";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {searchOn ? <Search /> : null}
    <Ticker />
  </React.StrictMode>
);
