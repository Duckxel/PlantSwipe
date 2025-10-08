import React from "react"

export const BottomBar: React.FC = () => (
  <footer className="max-w-5xl mx-auto mt-10 text-center text-xs opacity-60 px-2 overflow-x-hidden hidden md:block">
    © {new Date().getFullYear()} PlantSwipe. All rights reserved.
  </footer>
)
