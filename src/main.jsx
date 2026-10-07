import "./tokens.css";
import React from "react";
import ReactDOM from "react-dom/client";
import Ticker from "./Ticker.jsx";
import Search from "./Search.jsx";
import VideoEntry from "./video/VideoEntry.jsx";

// Off until VITE_SEARCH_ENABLED=true. No nav link either way.
const searchOn = import.meta.env.VITE_SEARCH_ENABLED === "true";
// Off until VITE_VIDEO_ENABLED=true. Production stays off until QA passes.
const videoOn = import.meta.env.VITE_VIDEO_ENABLED === "true";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {searchOn ? <Search /> : null}
    <Ticker />
    {videoOn ? <VideoEntry /> : null}
  </React.StrictMode>
);
