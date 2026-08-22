import "./tokens.css"; // brand tokens — synced from Catchem-data research/brand (source of truth: catchemtcg.com)
import React from "react";
import ReactDOM from "react-dom/client";
import Ticker from "./Ticker.jsx"; // THE TICKER is the opening screen (app-specs-v1 §1); CatchEm.jsx prototype preserved unmodified

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Ticker />
  </React.StrictMode>
);
